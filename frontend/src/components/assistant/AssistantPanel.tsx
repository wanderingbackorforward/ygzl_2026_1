import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageContext } from '../../hooks/usePageContext'
import { assistantApi } from './api'
import type { Conversation, Role } from './types'
import ConversationList from './ConversationList'
import ConversationView from './ConversationView'
import QuickCommandPanel from './QuickCommandPanel'
import RoleSwitcher from './RoleSwitcher'

interface AssistantPanelProps {
  onClose: () => void
}

export default function AssistantPanel({ onClose }: AssistantPanelProps) {
  const location = useLocation()
  const pageContext = usePageContext()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<Role>('researcher')
  const [loading, setLoading] = useState(true)
  const [showQuickPanel, setShowQuickPanel] = useState(true)

  // 加载对话列表
  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    try {
      setLoading(true)
      const convs = await assistantApi.getConversations()
      setConversations(convs)

      // 如果没有对话，自动创建一个
      if (convs.length === 0) {
        const newConv = await assistantApi.createConversation('新对话', currentRole)
        setConversations([newConv])
        setCurrentConvId(newConv.id)
      } else {
        // 默认选中第一个对话
        setCurrentConvId(convs[0].id)
        setCurrentRole(convs[0].role)
      }
    } catch (error) {
      console.error('加载对话列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateConversation() {
    try {
      const newConv = await assistantApi.createConversation('新对话', currentRole)
      setConversations(prev => [newConv, ...prev])
      setCurrentConvId(newConv.id)
    } catch (error) {
      console.error('创建对话失败:', error)
    }
  }

  async function handleDeleteConversation(convId: string) {
    try {
      await assistantApi.deleteConversation(convId)
      setConversations(prev => prev.filter(c => c.id !== convId))

      // 如果删除的是当前对话，切换到第一个对话
      if (convId === currentConvId) {
        const remaining = conversations.filter(c => c.id !== convId)
        if (remaining.length > 0) {
          setCurrentConvId(remaining[0].id)
        } else {
          // 没有对话了，创建一个新的
          handleCreateConversation()
        }
      }
    } catch (error) {
      console.error('删除对话失败:', error)
    }
  }

  async function handleRenameConversation(convId: string, newTitle: string) {
    try {
      await assistantApi.updateConversation(convId, { title: newTitle })
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, title: newTitle } : c))
      )
    } catch (error) {
      console.error('重命名对话失败:', error)
    }
  }

  function handleRoleChange(role: Role) {
    setCurrentRole(role)
    // 如果当前对话存在，更新对话的角色
    if (currentConvId) {
      assistantApi.updateConversation(currentConvId, { role }).catch(console.error)
      setConversations(prev =>
        prev.map(c => (c.id === currentConvId ? { ...c, role } : c))
      )
    }
  }

  function handleQuickCommand(prompt: string) {
    // 快捷指令会传递给 ConversationView 组件
    // 这里通过 key 强制重新渲染来传递 prompt
    // 实际实现中可以用 ref 或状态管理
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
        {/* 左侧栏 - 对话列表 */}
        <div className="flex w-60 shrink-0 flex-col border-r border-cyan-500/20 bg-slate-900/50">
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

          <div className="flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              currentConvId={currentConvId}
              onSelect={setCurrentConvId}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversation}
            />
          </div>
        </div>

        {/* 中间栏 - 对话视图 */}
        <div className="flex flex-1 flex-col">
          {/* 顶部工具栏 */}
          <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/20 px-4 py-3">
            <div className="flex items-center gap-4">
              <RoleSwitcher currentRole={currentRole} onChange={handleRoleChange} />
              <div className="text-sm text-slate-400">
                {currentConversation?.title || '新对话'}
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
                {showQuickPanel ? '隐藏快捷面板' : '显示快捷面板'}
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

          {/* 对话内容 */}
          {currentConvId && (
            <ConversationView
              conversationId={currentConvId}
              role={currentRole}
              pagePath={location.pathname}
              pageContext={pageContext}
            />
          )}
        </div>

        {/* 右侧栏 - 快捷面板 */}
        {showQuickPanel && (
          <div className="w-72 border-l border-cyan-500/20 bg-slate-900/50">
            <QuickCommandPanel
              currentRole={currentRole}
              onCommandClick={handleQuickCommand}
            />
          </div>
        )}
      </div>
    </div>
  )
}
