import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { assistantApi } from './api'
import type { Conversation, Message, Role } from './types'

interface ConversationViewProps {
  conversationId: string
  role: Role
  pagePath: string
  pageContext: any
  quickPrompt?: string
  onQuickPromptUsed?: () => void
}

export default function ConversationView({
  conversationId,
  role,
  pagePath,
  pageContext,
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

  // 动态加载动画
  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '.' : prev + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [loading])

  // 加载对话详情
  useEffect(() => {
    loadConversation()
  }, [conversationId])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  // 处理快捷指令
  useEffect(() => {
    console.log('[ConversationView] quickPrompt 变化:', quickPrompt)
    if (quickPrompt) {
      console.log('[ConversationView] 填充输入框:', quickPrompt)
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
      console.error('加载对话失败:', err)
      setError('加载对话失败')
    }
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || loading) return

    console.log('[ConversationView] 开始发送消息:', content)
    setLoading(true)
    setError('')

    // 立即显示用户消息
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: content,
      contentType: 'text',
      createdAt: new Date().toISOString()
    }

    console.log('[ConversationView] 立即显示临时用户消息:', tempUserMessage)
    setConversation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...(prev.messages || []), tempUserMessage],
      }
    })

    setInput('')

    try {
      console.log('[ConversationView] 调用 API 发送消息...')
      const { userMessage, assistantMessage } = await assistantApi.sendMessage(
        conversationId,
        content,
        role,
        pagePath,
        pageContext
      )

      console.log('[ConversationView] API 返回成功，替换临时消息')
      // 替换临时消息为真实消息
      setConversation(prev => {
        if (!prev) return prev
        const messagesWithoutTemp = prev.messages.filter(m => m.id !== tempUserMessage.id)
        return {
          ...prev,
          messages: [...messagesWithoutTemp, userMessage, assistantMessage],
        }
      })
    } catch (err: any) {
      console.error('[ConversationView] 发送消息失败:', err)
      setError(err.message || '发送消息失败')
      // 发送失败时移除临时消息
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
      {/* 消息列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="mb-2 text-4xl">💬</div>
              <div>开始对话吧！输入问题后回车或点击发送</div>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-cyan-500/20 text-cyan-100'
                  : 'bg-slate-800/50 text-slate-100'
              }`}
            >
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              ) : (
                <div className="prose prose-invert max-w-none prose-headings:text-cyan-100 prose-p:text-slate-100 prose-a:text-cyan-300 prose-code:text-slate-100">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: props => <h1 className="mb-3 text-lg font-semibold text-cyan-100" {...props} />,
                      h2: props => <h2 className="mb-3 text-lg font-semibold text-cyan-100" {...props} />,
                      h3: props => <h3 className="mb-2 text-base font-semibold text-cyan-100" {...props} />,
                      p: props => <p className="mb-3 leading-relaxed text-slate-100" {...props} />,
                      ul: props => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
                      ol: props => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
                      li: props => <li className="text-slate-100" {...props} />,
                      a: props => (
                        <a
                          className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-200"
                          target="_blank"
                          rel="noreferrer"
                          {...props}
                        />
                      ),
                      code: props => (
                        <code className="rounded bg-white/5 px-1.5 py-1 text-[13px] text-slate-100" {...props} />
                      ),
                      pre: props => (
                        <pre
                          className="mb-3 overflow-auto rounded border border-white/10 bg-black/40 p-3 text-[13px] text-slate-100"
                          {...props}
                        />
                      ),
                      blockquote: props => (
                        <blockquote className="mb-2 border-l-2 border-cyan-500/40 pl-3 text-slate-200" {...props} />
                      ),
                      table: props => (
                        <table className="mb-2 w-full table-auto border-collapse text-[12px]" {...props} />
                      ),
                      th: props => (
                        <th className="border border-white/10 bg-white/5 px-2 py-1 text-left text-slate-100" {...props} />
                      ),
                      td: props => (
                        <td className="border border-white/10 px-2 py-1 text-slate-100" {...props} />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-3 text-rose-300">
            {error}
          </div>
        )}

        {/* 加载动画 */}
        {loading && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-lg bg-slate-800/50 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '300ms' }} />
                <span className="ml-1 text-sm">AI 正在思考{dots}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-cyan-500/20 px-4 py-3">
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
            className="h-12 flex-1 rounded bg-white/5 px-4 text-base text-slate-100 placeholder:text-slate-500 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
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
