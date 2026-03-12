import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { assistantApi } from './api'
import AgentSteps from './AgentSteps'
import KnowledgeGraphViz from './KnowledgeGraphViz'
import PaperReferences from './PaperReferences'
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
}

// Model tag color mapping
function getModelBadge(model?: string, provider?: string): { label: string; color: string } {
  const m = (model || provider || '').toLowerCase()
  if (m.includes('claude')) {
    return { label: 'Claude', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' }
  }
  if (m.includes('deepseek')) {
    return { label: 'DeepSeek', color: 'bg-green-500/20 text-green-300 border-green-500/30' }
  }
  if (m.includes('fallback')) {
    return { label: 'DeepSeek (fallback)', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }
  }
  return { label: model || 'AI', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' }
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
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dots, setDots] = useState('.')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Loading animation
  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '.' : prev + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [loading])

  // Load conversation details
  useEffect(() => {
    loadConversation()
  }, [conversationId])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  // Handle quick prompt
  useEffect(() => {
    if (quickPrompt) {
      setInput(quickPrompt)
      inputRef.current?.focus()
      onQuickPromptUsed?.()
    }
  }, [quickPrompt, onQuickPromptUsed])

  async function loadConversation() {
    try {
      const conv = await assistantApi.getConversation(conversationId)
      setConversation(conv)
    } catch (err) {
      console.error('Failed to load conversation:', err)
      setError('Failed to load conversation')
    }
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || loading) return

    setLoading(true)
    setError('')

    // Show user message immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: content,
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
        content,
        role,
        pagePath,
        pageContext,
        provider,
        mode
      )

      // Attach model info and agent metadata to assistant message
      const kgViz = result.kgVisualization || undefined
      const papersData = result.papers || undefined
      const papersQ = result.papersQuery || undefined
      console.log('[DEBUG] Agent response:', {
        sentMode: mode,
        hasKgViz: !!kgViz,
        kgNodes: kgViz?.nodes?.length ?? 0,
        kgEdges: kgViz?.edges?.length ?? 0,
        papersCount: papersData?.length ?? 0,
        papersQuery: papersQ,
        agentSteps: result.agentSteps?.length ?? 0,
        toolNames: result.agentSteps?.map((s: any) => s.tool_name) ?? [],
        resultKeys: Object.keys(result),
        _debugErrors: (result as any)._debugErrors,
      })

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

      // Replace temp message with real messages
      setConversation(prev => {
        if (!prev) return prev
        const messagesWithoutTemp = prev.messages.filter(m => m.id !== tempUserMessage.id)
        return {
          ...prev,
          messages: [...messagesWithoutTemp, result.userMessage, assistantMsg],
        }
      })
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError(err.message || 'Failed to send message')
      // Remove temp message on failure
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
  }

  const messages = conversation?.messages || []

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-slate-300">
            <div className="text-center">
              <div className="mb-3 text-5xl">💬</div>
              <div className="text-base">开始对话吧！输入问题后回车或点击发送</div>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const badge = msg.role === 'assistant' ? getModelBadge(msg.model, msg.provider) : null
          return (
            <div
              key={msg.id}
              className={`mb-5 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/30 text-white'
                    : 'bg-slate-800 text-gray-100'
                }`}
              >
                {/* Model badge for AI messages */}
                {badge && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    {msg.metadata?.mode === 'agent' && (
                      <span className="inline-block rounded border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 text-[11px] font-medium text-purple-300">
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

                {/* Knowledge Graph visualization */}
                {msg.role === 'assistant' && msg.metadata?.kg_visualization && (
                  <KnowledgeGraphViz
                    nodes={msg.metadata.kg_visualization.nodes}
                    edges={msg.metadata.kg_visualization.edges}
                    stats={msg.metadata.kg_visualization.stats}
                  />
                )}

                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words text-base leading-relaxed">{msg.content}</div>
                ) : (
                  <div className="prose prose-invert prose-base max-w-none prose-headings:text-white prose-p:text-gray-100 prose-a:text-cyan-300 prose-code:text-gray-100">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: props => <h1 className="mb-4 text-xl font-bold text-white" {...props} />,
                        h2: props => <h2 className="mb-3 text-lg font-bold text-white" {...props} />,
                        h3: props => <h3 className="mb-2 text-base font-semibold text-white" {...props} />,
                        p: props => <p className="mb-3 text-base leading-7 text-gray-100" {...props} />,
                        ul: props => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-base" {...props} />,
                        ol: props => <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-base" {...props} />,
                        li: props => <li className="text-base leading-7 text-gray-100" {...props} />,
                        a: props => (
                          <a
                            className="text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 hover:text-cyan-200"
                            target="_blank"
                            rel="noreferrer"
                            {...props}
                          />
                        ),
                        code: props => (
                          <code className="rounded bg-slate-700 px-1.5 py-0.5 text-sm text-gray-100" {...props} />
                        ),
                        pre: props => (
                          <pre
                            className="mb-4 overflow-auto rounded-lg border border-slate-600 bg-slate-900 p-4 text-sm text-gray-100"
                            {...props}
                          />
                        ),
                        blockquote: props => (
                          <blockquote className="mb-3 border-l-3 border-cyan-400 pl-4 text-base text-gray-200" {...props} />
                        ),
                        table: props => (
                          <table className="mb-3 w-full table-auto border-collapse text-sm" {...props} />
                        ),
                        th: props => (
                          <th className="border border-slate-600 bg-slate-700 px-3 py-2 text-left text-sm font-semibold text-white" {...props} />
                        ),
                        td: props => (
                          <td className="border border-slate-600 px-3 py-2 text-sm text-gray-100" {...props} />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Paper references (after answer) */}
                {msg.role === 'assistant' && msg.metadata?.papers && msg.metadata.papers.length > 0 && (
                  <PaperReferences
                    papers={msg.metadata.papers}
                    query={msg.metadata.papers_query}
                  />
                )}
              </div>
            </div>
          )
        })}

        {error && (
          <div className="mb-5 rounded-lg bg-rose-500/20 px-5 py-4 text-base text-rose-200">
            {error}
          </div>
        )}

        {/* Loading animation */}
        {loading && (
          <div className="mb-5 flex justify-start">
            <div className="rounded-2xl bg-slate-800 px-5 py-4">
              <div className="flex items-center gap-2 text-slate-300">
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: '0ms' }} />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: '150ms' }} />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: '300ms' }} />
                <span className="ml-1 text-base">{mode === 'agent' ? 'Agent 正在分析' : 'AI 正在思考'}{dots}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3">
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
            className="h-12 flex-1 rounded-xl bg-slate-800 px-5 text-base text-white placeholder:text-slate-400 outline-none ring-1 ring-slate-600 focus:ring-cyan-500"
            placeholder="输入问题..."
            disabled={loading}
          />
          <button
            type="button"
            className="h-12 rounded bg-cyan-500 px-6 text-base font-medium text-slate-950 hover:bg-cyan-400 active:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
