import React, { useState } from 'react'
import type { Conversation } from './types'

interface ExportPanelProps {
  conversation: Conversation | null
}

export default function ExportPanel({ conversation }: ExportPanelProps) {
  const [exportFormat, setExportFormat] = useState<'markdown' | 'txt' | 'json'>('markdown')
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState<string>('')
  const [summaryError, setSummaryError] = useState('')

  // 生成对话总结
  const generateSummary = async () => {
    if (!conversation) return

    setGenerating(true)
    try {
      console.log('[DEBUG] 发送总结请求:', {
        conversation_id: conversation.id,
        messages_count: conversation.messages?.length
      })

      // 调用后端API生成总结
      const response = await fetch('/api/assistant/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          messages: conversation.messages
        })
      })

      console.log('[DEBUG] 响应状态:', response.status, response.statusText)

      const data = await response.json()
      console.log('[DEBUG] 响应数据:', data)

      if (!response.ok) {
        console.error('[DEBUG] API错误:', data)
        throw new Error(data.message || '生成总结失败')
      }

      setSummary(data.data?.summary || data.summary || '总结生成失败')
      setSummaryError('')
    } catch (err) {
      console.error('生成总结失败:', err)
      setSummary('')
      setSummaryError(`总结接口不可用：${err instanceof Error ? err.message : '网络错误'}。不会用客户端内容代写总结。`)
    } finally {
      setGenerating(false)
    }
  }

  // 导出为 Markdown
  const exportAsMarkdown = () => {
    return summary
  }

  // 导出为纯文本
  const exportAsText = () => {
    const content = summary
    // 移除 Markdown 格式
    return content
      .replace(/^#+\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
  }

  // 导出为 JSON
  const exportAsJSON = () => {
    if (!conversation) return ''
    return JSON.stringify({
      id: conversation.id,
      title: conversation.title,
      role: conversation.role,
      createdAt: conversation.createdAt,
      messageCount: conversation.messages?.length || 0,
      summary: summary
    }, null, 2)
  }

  // 获取导出内容
  const getExportContent = () => {
    switch (exportFormat) {
      case 'markdown':
        return exportAsMarkdown()
      case 'txt':
        return exportAsText()
      case 'json':
        return exportAsJSON()
      default:
        return ''
    }
  }

  // 下载文件
  const handleDownload = () => {
    if (!conversation) return

    const content = getExportContent()
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conversation.title}_${Date.now()}.${exportFormat === 'markdown' ? 'md' : exportFormat}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 复制到剪贴板
  const handleCopy = async () => {
    const content = getExportContent()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 分享（生成分享链接）
  const handleShare = () => {
    if (!conversation) return

    const shareUrl = `${window.location.origin}/assistant/share/${conversation.id}`
    navigator.clipboard.writeText(shareUrl)
    alert('分享链接已复制到剪贴板')
  }

  const getRoleLabel = (role: string) => {
    const roleMap = {
      researcher: '科研人员',
      worker: '施工人员',
      reporter: '项目汇报'
    }
    return roleMap[role as keyof typeof roleMap] || role
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-600 px-4 py-3">
          <h3 className="text-lg font-bold text-white">导出与分享</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 text-5xl">📤</div>
            <div className="text-base text-white">请先选择一个对话</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white">导出与分享</h3>
        <p className="mt-1 text-sm text-white">保存或分享对话内容</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* 对话信息 */}
        <div className="mb-4 rounded-xl border border-slate-500 bg-slate-800 p-4">
          <div className="text-base font-bold text-white">{conversation.title}</div>
          <div className="mt-2 flex items-center gap-4 text-sm text-white">
            <span>消息数: {conversation.messages?.length || 0}</span>
            <span>角色: {getRoleLabel(conversation.role)}</span>
          </div>
        </div>

        {/* 生成总结按钮 */}
        {!summary && (
          <button
            type="button"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 text-base font-bold text-white transition-all hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={generateSummary}
            disabled={generating}
          >
            {generating ? (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>生成总结中...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>生成对话总结</span>
              </>
            )}
          </button>
        )}

        {/* 总结错误 */}
        {summaryError && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-200">
            {summaryError}
          </div>
        )}

        {/* 总结预览 */}
        {summary && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-base font-bold text-white">对话总结</h4>
              <button
                type="button"
                className="rounded-lg bg-slate-700 px-3 py-1 text-sm font-medium text-white hover:bg-slate-600"
                onClick={generateSummary}
                disabled={generating}
              >
                重新生成
              </button>
            </div>
            <div className="max-h-60 overflow-auto rounded-xl border border-slate-500 bg-slate-900 p-4">
              <pre className="whitespace-pre-wrap text-sm text-white">
                {summary}
              </pre>
            </div>
          </div>
        )}

        {/* 导出格式选择 */}
        <div className="mb-4">
          <h4 className="mb-2 text-base font-bold text-white">导出格式</h4>
          <div className="grid grid-cols-3 gap-2">
            {(['markdown', 'txt', 'json'] as const).map(format => (
              <button
                key={format}
                type="button"
                className={`rounded-xl border px-3 py-2.5 text-base font-semibold transition-all ${
                  exportFormat === format
                    ? 'border-cyan-400 bg-cyan-600 text-white'
                    : 'border-slate-500 bg-slate-800 text-white hover:border-cyan-400 hover:bg-slate-700'
                }`}
                onClick={() => setExportFormat(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 text-base font-bold text-white transition-all hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleDownload}
            disabled={!summary}
          >
            <span>📥</span>
            <span>下载总结</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-500 bg-slate-700 px-4 py-3.5 text-base font-bold text-white transition-all hover:bg-slate-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleCopy}
            disabled={!summary}
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? '已复制' : '复制总结'}</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-500 bg-slate-700 px-4 py-3.5 text-base font-bold text-white transition-all hover:bg-slate-600 active:scale-95"
            onClick={handleShare}
          >
            <span>🔗</span>
            <span>生成分享链接</span>
          </button>
        </div>
      </div>
    </div>
  )
}
