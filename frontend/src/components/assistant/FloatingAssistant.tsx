import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiPost } from '../../lib/api'

type AssistantResponse = {
  answerMarkdown: string
  model?: string
}

export default function FloatingAssistant() {
  const location = useLocation()
  const pagePath = useMemo(() => location.pathname, [location.pathname])

  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answerMarkdown, setAnswerMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
    return
  }, [open])

  async function handleAsk() {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError('')
    try {
      const data = await apiPost<AssistantResponse>('/assistant/chat', { question: q, pagePath })
      setAnswerMarkdown(data.answerMarkdown || '')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-[1100] h-12 w-12 rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400 active:bg-cyan-600"
        onClick={() => setOpen(v => !v)}
        aria-label="打开悬浮小助手"
      >
        <span className="block text-xl leading-none">?</span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[1100] w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-cyan-500/30 bg-slate-950/90 shadow-2xl shadow-cyan-500/10 backdrop-blur">
          <div className="flex items-center justify-between border-b border-cyan-500/20 px-3 py-2">
            <div className="text-sm font-medium text-cyan-200">悬浮小助手</div>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              关闭
            </button>
          </div>

          <div className="max-h-[50vh] overflow-auto px-3 py-3 text-sm text-slate-100">
            {!answerMarkdown && !error && (
              <div className="text-slate-400">输入问题后回车或点击发送。</div>
            )}
            {error && <div className="text-rose-300">{error}</div>}
            {answerMarkdown && (
              <div className="break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: props => <h1 className="mb-2 text-base font-semibold text-cyan-100" {...props} />,
                    h2: props => <h2 className="mb-2 text-base font-semibold text-cyan-100" {...props} />,
                    h3: props => <h3 className="mb-2 text-sm font-semibold text-cyan-100" {...props} />,
                    p: props => <p className="mb-2 leading-relaxed text-slate-100" {...props} />,
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
                      <code className="rounded bg-white/5 px-1 py-0.5 text-[12px] text-slate-100" {...props} />
                    ),
                    pre: props => (
                      <pre
                        className="mb-2 overflow-auto rounded border border-white/10 bg-black/40 p-2 text-[12px] text-slate-100"
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
                  {answerMarkdown}
                </ReactMarkdown>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-cyan-500/20 px-3 py-2">
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAsk()
              }}
              className="h-10 flex-1 rounded bg-white/5 px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
              placeholder="问我一个问题…"
              disabled={loading}
            />
            <button
              type="button"
              className="h-10 rounded bg-cyan-500 px-3 text-sm font-medium text-slate-950 hover:bg-cyan-400 active:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleAsk}
              disabled={loading || !question.trim()}
            >
              {loading ? '…' : '发送'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
