import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageContext } from '../../hooks/usePageContext'
import { assistantApi } from './api'
import type { Conversation, Provider, ProviderInfo, Role } from './types'
import ConversationList from './ConversationList'
import ConversationView from './ConversationView'
import QuickCommandPanel from './QuickCommandPanel'
import StatisticsPanel from './StatisticsPanel'
import ExportPanel from './ExportPanel'
import RoleSwitcher from './RoleSwitcher'

interface AssistantPanelProps {
  onClose: () => void
}

const PROVIDER_OPTIONS: { id: Provider; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto', desc: 'Claude 优先，失败回退 DeepSeek' },
  { id: 'claude', label: 'Claude', desc: 'Anthropic Claude' },
  { id: 'deepseek', label: 'DeepSeek', desc: 'DeepSeek Chat' },
]

export default function AssistantPanel({ onClose }: AssistantPanelProps) {
  const location = useLocation()
  const pageContext = usePageContext()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<Role>('researcher')
  const [currentProvider, setCurrentProvider] = useState<Provider>('auto')
  const [loading, setLoading] = useState(true)
  const [showQuickPanel, setShowQuickPanel] = useState(true)
  const [quickPrompt, setQuickPrompt] = useState<string>('')
  const [rightPanelMode, setRightPanelMode] = useState<'quick' | 'stats' | 'export'>('quick')
  const [fullConversation, setFullConversation] = useState<Conversation | null>(null)
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([])

  // Load conversation list
  useEffect(() => {
    loadConversations()
    loadProviders()
  }, [location.pathname])

  // Load full conversation when switching to export panel
  useEffect(() => {
    if (rightPanelMode === 'export' && currentConvId) {
      loadFullConversation(currentConvId)
    }
  }, [rightPanelMode, currentConvId])

  async function loadProviders() {
    try {
      const data = await assistantApi.getProviders()
      setAvailableProviders(data.providers)
    } catch (err) {
      console.error('Failed to load providers:', err)
    }
  }

  async function loadFullConversation(convId: string) {
    try {
      const conv = await assistantApi.getConversation(convId)
      setFullConversation(conv)
    } catch (error) {
      console.error('Failed to load full conversation:', error)
    }
  }

  async function loadConversations() {
    try {
      setLoading(true)
      const convs = await assistantApi.getConversations(100, location.pathname)
      setConversations(convs)

      if (convs.length === 0) {
        const newConv = await assistantApi.createConversation('New conversation', currentRole, location.pathname)
        setConversations([newConv])
        setCurrentConvId(newConv.id)
      } else {
        setCurrentConvId(convs[0].id)
        setCurrentRole(convs[0].role)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateConversation() {
    try {
      const newConv = await assistantApi.createConversation('New conversation', currentRole, location.pathname)
      setConversations(prev => [newConv, ...prev])
      setCurrentConvId(newConv.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  async function handleDeleteConversation(convId: string) {
    try {
      await assistantApi.deleteConversation(convId)
      setConversations(prev => prev.filter(c => c.id !== convId))

      if (convId === currentConvId) {
        const remaining = conversations.filter(c => c.id !== convId)
        if (remaining.length > 0) {
          setCurrentConvId(remaining[0].id)
        } else {
          handleCreateConversation()
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  async function handleRenameConversation(convId: string, newTitle: string) {
    try {
      await assistantApi.updateConversation(convId, { title: newTitle })
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, title: newTitle } : c))
      )
    } catch (error) {
      console.error('Failed to rename conversation:', error)
    }
  }

  function handleRoleChange(role: Role) {
    setCurrentRole(role)
    if (currentConvId) {
      assistantApi.updateConversation(currentConvId, { role }).catch(console.error)
      setConversations(prev =>
        prev.map(c => (c.id === currentConvId ? { ...c, role } : c))
      )
    }
  }

  function handleQuickCommand(prompt: string) {
    setQuickPrompt(prompt)
  }

  const currentConversation = conversations.find(c => c.id === currentConvId)

  if (loading) {
    return (
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="text-lg text-cyan-200">加载中...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex h-[85vh] w-[90vw] max-w-[1400px] overflow-hidden rounded-xl border border-cyan-500/30 bg-slate-950/95 shadow-2xl shadow-cyan-500/20">
        {/* Left sidebar - conversation list */}
        <div className="flex w-60 shrink-0 flex-col border-r border-cyan-500/20 bg-slate-900/50">
          {/* Title bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/20 p-4">
            <h2 className="text-base font-medium text-cyan-200">对话列表</h2>
            <button
              type="button"
              className="rounded p-2 text-cyan-400 hover:bg-white/10 active:scale-95"
              onClick={handleCreateConversation}
              title="新建对话"
            >
              <span className="text-xl leading-none">+</span>
            </button>
          </div>

          {/* Scrollable conversation list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              currentConvId={currentConvId}
              onSelect={setCurrentConvId}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversation}
            />
          </div>
        </div>

        {/* Middle - conversation view */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/20 px-4 py-3">
            <div className="flex items-center gap-4">
              <RoleSwitcher currentRole={currentRole} onChange={handleRoleChange} />

              {/* Model selector */}
              <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-slate-900/60 p-0.5">
                {PROVIDER_OPTIONS.map(opt => {
                  const isAvailable = opt.id === 'auto' || availableProviders.some(p => p.id === opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!isAvailable}
                      title={opt.desc}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                        currentProvider === opt.id
                          ? opt.id === 'claude'
                            ? 'bg-orange-500/30 text-orange-200 shadow-sm'
                            : opt.id === 'deepseek'
                              ? 'bg-green-500/30 text-green-200 shadow-sm'
                              : 'bg-cyan-500/30 text-cyan-200 shadow-sm'
                          : isAvailable
                            ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            : 'cursor-not-allowed text-slate-600'
                      }`}
                      onClick={() => setCurrentProvider(opt.id)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="text-sm text-slate-400">
                {currentConversation?.title || 'New conversation'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 active:scale-95"
                onClick={handleCreateConversation}
                title="新建对话"
              >
                + 新建对话
              </button>
              <button
                type="button"
                className="rounded px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                onClick={() => setShowQuickPanel(!showQuickPanel)}
              >
                {showQuickPanel ? '隐藏侧边栏' : '显示侧边栏'}
              </button>
              <button
                type="button"
                className="rounded px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                onClick={onClose}
              >
                关闭
              </button>
            </div>
          </div>

          {/* Conversation content */}
          <div className="min-h-0 flex-1">
            {currentConvId && (
              <ConversationView
                conversationId={currentConvId}
                role={currentRole}
                pagePath={location.pathname}
                pageContext={pageContext}
                provider={currentProvider}
                quickPrompt={quickPrompt}
                onQuickPromptUsed={() => setQuickPrompt('')}
              />
            )}
          </div>
        </div>

        {/* Right sidebar - multi-function panel */}
        {showQuickPanel && (
          <div className="flex w-72 flex-col border-l border-cyan-500/20 bg-slate-900/50">
            {/* Panel tab buttons */}
            <div className="flex shrink-0 border-b border-cyan-500/20">
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm transition-colors ${
                  rightPanelMode === 'quick'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
                onClick={() => setRightPanelMode('quick')}
              >
                快捷指令
              </button>
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm transition-colors ${
                  rightPanelMode === 'stats'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
                onClick={() => setRightPanelMode('stats')}
              >
                统计
              </button>
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm transition-colors ${
                  rightPanelMode === 'export'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
                onClick={() => setRightPanelMode('export')}
              >
                导出
              </button>
            </div>

            {/* Panel content */}
            <div className="min-h-0 flex-1">
              {rightPanelMode === 'quick' && (
                <QuickCommandPanel
                  currentRole={currentRole}
                  onCommandClick={handleQuickCommand}
                />
              )}
              {rightPanelMode === 'stats' && (
                <StatisticsPanel conversations={conversations} />
              )}
              {rightPanelMode === 'export' && (
                <ExportPanel conversation={fullConversation} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
