import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageContext } from '../../hooks/usePageContext'
import { assistantApi } from './api'
import { pathToModule } from './config'
import type { AssistantMode, Conversation, Provider, ProviderInfo, Role } from './types'
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
  const [currentMode, setCurrentMode] = useState<AssistantMode>('chat')
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
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950">
        <div className="text-2xl font-medium text-white">加载中...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-950">
      <div className="relative flex h-full w-full overflow-hidden bg-slate-950">
        {/* Left sidebar - conversation list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-600 bg-slate-900">
          {/* Title bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-600 p-4">
            <h2 className="text-lg font-bold text-white">对话列表</h2>
            <button
              type="button"
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-lg font-bold text-white hover:bg-cyan-500 active:scale-95"
              onClick={handleCreateConversation}
              title="新建对话"
            >
              +
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
          <div className="flex shrink-0 items-center justify-between border-b border-slate-600 px-5 py-3">
            <div className="flex items-center gap-4">
              <RoleSwitcher currentRole={currentRole} onChange={handleRoleChange} />

              {/* Model selector */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-500 bg-slate-800 p-1">
                {PROVIDER_OPTIONS.map(opt => {
                  const isAvailable = opt.id === 'auto' || availableProviders.some(p => p.id === opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!isAvailable}
                      title={opt.desc}
                      className={`rounded-md px-3 py-1.5 text-base font-semibold transition-all ${
                        currentProvider === opt.id
                          ? opt.id === 'claude'
                            ? 'bg-orange-600 text-white shadow-sm'
                            : opt.id === 'deepseek'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-cyan-600 text-white shadow-sm'
                          : isAvailable
                            ? 'text-white hover:bg-slate-600'
                            : 'cursor-not-allowed text-slate-600'
                      }`}
                      onClick={() => setCurrentProvider(opt.id)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {/* Mode toggle: Chat / Agent */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-500 bg-slate-800 p-1">
                <button
                  type="button"
                  title="普通对话模式"
                  className={`rounded-md px-3 py-1.5 text-base font-semibold transition-all ${
                    currentMode === 'chat'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-white hover:bg-slate-600'
                  }`}
                  onClick={() => setCurrentMode('chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  title="Agent 模式：自主调用工具查询真实数据"
                  className={`rounded-md px-3 py-1.5 text-base font-semibold transition-all ${
                    currentMode === 'agent'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-white hover:bg-slate-600'
                  }`}
                  onClick={() => setCurrentMode('agent')}
                >
                  Agent
                </button>
              </div>

              <div className="text-base font-medium text-white">
                {currentConversation?.title || 'New conversation'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-cyan-600 px-4 py-2 text-base font-semibold text-white hover:bg-cyan-500 active:scale-95"
                onClick={handleCreateConversation}
                title="新建对话"
              >
                + 新建对话
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-700 px-4 py-2 text-base font-medium text-white hover:bg-slate-600"
                onClick={() => setShowQuickPanel(!showQuickPanel)}
              >
                {showQuickPanel ? '隐藏侧边栏' : '显示侧边栏'}
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-700 px-4 py-2 text-base font-medium text-white hover:bg-slate-600"
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
                mode={currentMode}
                quickPrompt={quickPrompt}
                onQuickPromptUsed={() => setQuickPrompt('')}
              />
            )}
          </div>
        </div>

        {/* Right sidebar - multi-function panel */}
        {showQuickPanel && (
          <div className="flex w-80 flex-col border-l border-slate-600 bg-slate-900">
            {/* Panel tab buttons */}
            <div className="flex shrink-0 border-b border-slate-600">
              <button
                type="button"
                className={`flex-1 px-4 py-3 text-base font-semibold transition-colors ${
                  rightPanelMode === 'quick'
                    ? 'bg-cyan-600 text-white'
                    : 'text-white hover:bg-slate-700'
                }`}
                onClick={() => setRightPanelMode('quick')}
              >
                快捷指令
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-3 text-base font-semibold transition-colors ${
                  rightPanelMode === 'stats'
                    ? 'bg-cyan-600 text-white'
                    : 'text-white hover:bg-slate-700'
                }`}
                onClick={() => setRightPanelMode('stats')}
              >
                统计
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-3 text-base font-semibold transition-colors ${
                  rightPanelMode === 'export'
                    ? 'bg-cyan-600 text-white'
                    : 'text-white hover:bg-slate-700'
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
                  currentModule={pathToModule(location.pathname)}
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
