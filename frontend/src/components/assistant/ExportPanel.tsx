import React, { useState } from 'react'
import type { Conversation } from './types'

interface ExportPanelProps {
  conversation: Conversation | null
}

export default function ExportPanel({ conversation }: ExportPanelProps) {
  const [exportFormat, setExportFormat] = useState<'markdown' | 'txt' | 'json'>('markdown')
  const [copied, setCopied] = useState(false)

  // 导出为 Markdown
  const exportAsMarkdown = () => {
    if (!conversation) return ''

    let content = `# ${conversation.title}\n\n`
    content += `**角色**: ${getRoleLabel(conversation.role)}\n`
    content += `**创建时间**: ${new Date(conversation.createdAt).toLocaleString('zh-CN')}\n`
    content += `**消息数**: ${conversation.messages?.length || 0}\n\n`
    content += `---\n\n`

    conversation.messages?.forEach((msg, index) => {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手'
      content += `## ${role}\n\n`
      content += `${msg.content}\n\n`
      if (index < conversation.messages.length - 1) {
        content += `---\n\n`
      }
    })

    return content
  }

  // 导出为纯文本
  const exportAsText = () => {
    if (!conversation) return ''

    let content = `${conversation.title}\n`
    content += `${'='.repeat(conversation.title.length)}\n\n`
    content += `角色: ${getRoleLabel(conversation.role)}\n`
    content += `创建时间: ${new Date(conversation.createdAt).toLocaleString('zh-CN')}\n`
    content += `消息数: ${conversation.messages?.length || 0}\n\n`

    conversation.messages?.forEach((msg, index) => {
      const role = msg.role === 'user' ? '[用户]' : '[AI助手]'
      content += `${role}\n${msg.content}\n\n`
    })

    return content
  }

  // 导出为 JSON
  const exportAsJSON = () => {
    if (!conversation) return ''
    return JSON.stringify(conversation, null, 2)
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
        <div className="border-b border-cyan-500/20 px-4 py-3">
          <h3 className="text-base font-medium text-cyan-200">导出与分享</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-sm text-slate-500">
            <div className="mb-2 text-4xl">📤</div>
            <div>请先选择一个对话</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-cyan-500/20 px-4 py-3">
        <h3 className="text-base font-medium text-cyan-200">导出与分享</h3>
        <p className="mt-1 text-xs text-slate-400">保存或分享对话内容</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* 对话信息 */}
        <div className="mb-4 rounded-lg border border-cyan-500/20 bg-slate-800/30 p-3">
          <div className="text-sm font-medium text-slate-200">{conversation.title}</div>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
            <span>消息数: {conversation.messages?.length || 0}</span>
            <span>角色: {getRoleLabel(conversation.role)}</span>
          </div>
        </div>

        {/* 导出格式选择 */}
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-slate-300">导出格式</h4>
          <div className="grid grid-cols-3 gap-2">
            {(['markdown', 'txt', 'json'] as const).map(format => (
              <button
                key={format}
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                  exportFormat === format
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                    : 'border-cyan-500/20 bg-slate-800/30 text-slate-300 hover:border-cyan-500/40 hover:bg-slate-800/50'
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/30 active:scale-95"
            onClick={handleDownload}
          >
            <span>📥</span>
            <span>下载文件</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-slate-800/30 px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800/50 active:scale-95"
            onClick={handleCopy}
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? '已复制' : '复制内容'}</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-slate-800/30 px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800/50 active:scale-95"
            onClick={handleShare}
          >
            <span>🔗</span>
            <span>生成分享链接</span>
          </button>
        </div>

        {/* 预览 */}
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-medium text-slate-300">内容预览</h4>
          <div className="max-h-60 overflow-auto rounded-lg border border-cyan-500/20 bg-black/40 p-3">
            <pre className="whitespace-pre-wrap text-xs text-slate-300">
              {getExportContent().slice(0, 500)}
              {getExportContent().length > 500 && '\n\n... (内容过长，已截断)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
