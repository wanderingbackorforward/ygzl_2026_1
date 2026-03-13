import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { assistantApi } from './api'
import AgentSteps from './AgentSteps'
import KnowledgeGraphViz from './KnowledgeGraphViz'
import PaperReferences from './PaperReferences'
import StreamingProgress from './StreamingProgress'
import type { AgentStep, AssistantMode, Conversation, Message, Provider, Role } from './types'

interface ConversationViewProps {
  conversationId: string
  role: Role
  pagePath: string
  pageContext: any
  provider: Provider
  mode: AssistantMode
  quickPrompt?: string
  onQuickPromptUsed?: () => void
  onLoadingChange?: (loading: boolean) => void
}

// Model tag color mapping
function getModelBadge(model?: string, provider?: string): { label: string; color: string } {
  const m = (model || provider || '').toLowerCase()
  if (m.includes('claude')) {
    return { label: 'Claude', color: 'bg-orange-600 text-white border-orange-500' }
  }
  if (m.includes('deepseek')) {
    return { label: 'DeepSeek', color: 'bg-green-600 text-white border-green-500' }
  }
  if (m.includes('fallback')) {
    return { label: 'DeepSeek (fallback)', color: 'bg-yellow-600 text-white border-yellow-500' }
  }
  return { label: model || 'AI', color: 'bg-slate-600 text-white border-slate-500' }
}

export default function ConversationView({
  conversationId,
  role,
  pagePath,
  pageContext,
  provider,
  mode,
  quickPrompt,
  onQuickPromptUsed,
  onLoadingChange,
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingStartTime, setLoadingStartTime] = useState(0)
  // Track which message is currently loading enrichment data
  const [enrichingMsgId, setEnrichingMsgId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load conversation details
  useEffect(() => {
    loadConversation()
  }, [conversationId])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading])

  // Handle quick prompt - auto send
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return

    setLoading(true)
    setLoadingStartTime(Date.now())
    setError('')

    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      contentType: 'text',
      createdAt: new Date().toISOString()
    }

    setConversation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...(prev.messages || []), tempUserMessage],
      }
    })

    setInput('')

    try {
      const result = await assistantApi.sendMessage(
        conversationId,
        content.trim(),
        role,
        pagePath,
        pageContext,
        provider,
        mode
      )

      const kgViz = result.kgVisualization || undefined
      const papersData = result.papers || undefined
      const papersQ = result.papersQuery || undefined

      const assistantMsg: Message = {
        ...result.assistantMessage,
        model: result.model,
        provider: result.provider,
        metadata: {
          ...(result.assistantMessage.metadata || {}),
          mode: mode,
          tool_steps: result.agentSteps,
          total_iterations: result.agentIterations,
          total_duration_ms: result.agentDurationMs,
          kg_visualization: kgViz,
          papers: papersData,
          papers_query: papersQ,
        },
      }

      setConversation(prev => {
        if (!prev) return prev
        const messagesWithoutTemp = prev.messages.filter(m => m.id !== tempUserMessage.id)
        return {
          ...prev,
          messages: [...messagesWithoutTemp, result.userMessage, assistantMsg],
        }
      })

      asyncEnrich(
        assistantMsg.id,
        content.trim(),
        kgViz,
        papersData || []
      )
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError(err.message || 'Failed to send message')
      setConversation(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.filter(m => m.id !== tempUserMessage.id),
        }
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [conversationId, role, pagePath, pageContext, provider, mode, loading])

  useEffect(() => {
    if (quickPrompt) {
      sendMessage(quickPrompt)
      onQuickPromptUsed?.()
    }
  }, [quickPrompt])

  async function loadConversation() {
    try {
      const conv = await assistantApi.getConversation(conversationId)
      setConversation(conv)
    } catch (err) {
      console.error('Failed to load conversation:', err)
      setError('Failed to load conversation')
    }
  }

  // Helper: update a specific message's metadata in conversation state
  function updateMessageMetadata(msgId: string, patch: Record<string, any>) {
    setConversation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        messages: prev.messages.map(m =>
          m.id === msgId
            ? { ...m, metadata: { ...(m.metadata || {}), ...patch } }
            : m
        ),
      }
    })
  }

  // Async enrichment: load KG and papers AFTER main response, in parallel
  async function asyncEnrich(msgId: string, userContent: string, existingKg: any, existingPapers: any[]) {
    setEnrichingMsgId(msgId)
    const needKg = !existingKg
    const needPapers = !existingPapers || existingPapers.length === 0

    if (!needKg && !needPapers) {
      setEnrichingMsgId(null)
      return
    }

    console.log('[asyncEnrich] Starting:', { needKg, needPapers, msgId })

    // Fire both requests in parallel
    const promises: Promise<void>[] = []

    if (needKg) {
      promises.push(
        assistantApi.enrichKG().then(kgViz => {
          if (kgViz) {
            console.log('[asyncEnrich] KG loaded:', kgViz.nodes?.length, 'nodes')
            updateMessageMetadata(msgId, { kg_visualization: kgViz })
          }
        })
      )
    }

    if (needPapers) {
      promises.push(
        assistantApi.enrichPapers(userContent).then(result => {
          if (result && result.papers.length > 0) {
            console.log('[asyncEnrich] Papers loaded:', result.papers.length)
            updateMessageMetadata(msgId, {
              papers: result.papers,
              papers_query: result.query,
            })
          }
        })
      )
    }

    await Promise.allSettled(promises)
    setEnrichingMsgId(null)
    console.log('[asyncEnrich] Complete')
  }

  function handleSend() {
    const content = input.trim()
    if (!content) return
    sendMessage(content)
  }

  const messages = conversation?.messages || []

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-6xl">💬</div>
              <div className="text-xl text-white">开始对话吧！输入问题后回车或点击发送</div>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const badge = msg.role === 'assistant' ? getModelBadge(msg.model, msg.provider) : null
          const isEnriching = msg.id === enrichingMsgId
          return (
            <div
              key={msg.id}
              className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-6 py-5 ${
                  msg.role === 'user'
                    ? 'bg-cyan-700 text-white'
                    : 'bg-slate-700 text-white'
                }`}
              >
                {/* Model badge for AI messages */}
                {badge && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`inline-block rounded-md border px-2 py-1 text-sm font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                    {msg.metadata?.mode === 'agent' && (
                      <span className="inline-block rounded-md border border-purple-400 bg-purple-600 px-2 py-1 text-sm font-bold text-white">
                        Agent
                      </span>
                    )}
                  </div>
                )}

                {/* Agent steps (before answer) */}
                {msg.role === 'assistant' && msg.metadata?.tool_steps && msg.metadata.tool_steps.length > 0 && (
                  <AgentSteps
                    steps={msg.metadata.tool_steps}
                    totalIterations={msg.metadata.total_iterations}
                    totalDurationMs={msg.metadata.total_duration_ms}
                  />
                )}

                {/* Knowledge Graph visualization (before answer) */}
                {msg.role === 'assistant' && msg.metadata?.kg_visualization && (
                  <KnowledgeGraphViz
                    nodes={msg.metadata.kg_visualization.nodes}
                    edges={msg.metadata.kg_visualization.edges}
                    stats={msg.metadata.kg_visualization.stats}
                  />
                )}

                {/* Paper references (before answer) */}
                {msg.role === 'assistant' && msg.metadata?.papers && msg.metadata.papers.length > 0 && (
                  <PaperReferences
                    papers={msg.metadata.papers}
                    query={msg.metadata.papers_query}
                  />
                )}

                {/* Async enrichment loading indicator */}
                {msg.role === 'assistant' && isEnriching && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-600/50 px-4 py-2 text-sm text-white">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    正在加载知识图谱和学术论文...
                  </div>
                )}

                {/* Answer text (last) */}
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words text-lg leading-8">{msg.content}</div>
                ) : (
                  <div className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-white prose-a:text-cyan-300 prose-code:text-white prose-strong:text-white">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: props => <h1 className="mb-4 text-2xl font-bold text-white" {...props} />,
                        h2: props => <h2 className="mb-4 text-xl font-bold text-white" {...props} />,
                        h3: props => <h3 className="mb-3 text-lg font-bold text-white" {...props} />,
                        p: props => <p className="mb-4 text-lg leading-8 text-white" {...props} />,
                        ul: props => <ul className="mb-4 list-disc space-y-2 pl-6 text-lg" {...props} />,
                        ol: props => <ol className="mb-4 list-decimal space-y-2 pl-6 text-lg" {...props} />,
                        li: props => <li className="text-lg leading-8 text-white" {...props} />,
                        strong: props => <strong className="font-bold text-white" {...props} />,
                        a: props => (
                          <a
                            className="font-medium text-cyan-300 underline decoration-cyan-400 underline-offset-2 hover:text-cyan-200"
                            target="_blank"
                            rel="noreferrer"
                            {...props}
                          />
                        ),
                        code: props => (
                          <code className="rounded-md bg-slate-900 px-2 py-1 text-base font-mono text-emerald-300" {...props} />
                        ),
                        pre: props => (
                          <pre
                            className="mb-4 overflow-auto rounded-xl border border-slate-500 bg-slate-900 p-5 text-base text-emerald-300"
                            {...props}
                          />
                        ),
                        blockquote: props => (
                          <blockquote className="mb-4 border-l-4 border-cyan-400 pl-5 text-lg text-slate-200" {...props} />
                        ),
                        table: props => (
                          <table className="mb-4 w-full table-auto border-collapse text-base" {...props} />
                        ),
                        th: props => (
                          <th className="border border-slate-500 bg-slate-600 px-4 py-2.5 text-left text-base font-bold text-white" {...props} />
                        ),
                        td: props => (
                          <td className="border border-slate-500 px-4 py-2.5 text-base text-white" {...props} />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {error && (
          <div className="mb-6 rounded-xl bg-rose-700 px-6 py-4 text-lg font-medium text-white">
            {error}
          </div>
        )}

        {/* Streaming progress indicator */}
        {loading && (
          <StreamingProgress mode={mode} startTime={loadingStartTime} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-600 px-8 py-5">
        <div className="flex items-center gap-4">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="h-14 flex-1 rounded-xl bg-slate-800 px-6 text-lg text-white placeholder:text-slate-400 outline-none ring-2 ring-slate-500 focus:ring-cyan-500"
            placeholder="输入问题..."
            disabled={loading}
          />
          <button
            type="button"
            className="h-14 rounded-xl bg-cyan-600 px-8 text-lg font-bold text-white hover:bg-cyan-500 active:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                发送中
              </span>
            ) : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
