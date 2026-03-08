import React, { useState } from 'react'
import type { Conversation } from './types'
import { roleConfig } from './config'

interface ConversationListProps {
  conversations: Conversation[]
  currentConvId: string | null
  onSelect: (convId: string) => void
  onDelete: (convId: string) => void
  onRename: (convId: string, newTitle: string) => void
}

export default function ConversationList({
  conversations,
  currentConvId,
  onSelect,
  onDelete,
  onRename,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  function handleStartEdit(conv: Conversation) {
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  function handleSaveEdit(convId: string) {
    if (editTitle.trim()) {
      onRename(convId, editTitle.trim())
    }
    setEditingId(null)
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditTitle('')
  }

  function handleDelete(convId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm('确定要删除这个对话吗？')) {
      onDelete(convId)
    }
  }

  // 按时间分组
  const grouped = groupConversationsByTime(conversations)

  return (
    <div className="h-full">
      {Object.entries(grouped).map(([group, convs]) => (
        <div key={group} className="mb-4">
          <div className="px-4 py-2 text-xs font-medium text-slate-500">{group}</div>
          {convs.map(conv => {
            const isActive = conv.id === currentConvId
            const isEditing = editingId === conv.id
            const roleInfo = roleConfig[conv.role]

            return (
              <div
                key={conv.id}
                className={`group relative cursor-pointer px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-200'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
                onClick={() => !isEditing && onSelect(conv.id)}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit(conv.id)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="flex-1 rounded bg-white/10 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-cyan-500/50"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                      onClick={() => handleSaveEdit(conv.id)}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-300"
                      onClick={handleCancelEdit}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm leading-none">{roleInfo.icon}</span>
                      <div className="flex-1 truncate text-sm font-medium">{conv.title}</div>
                    </div>
                    {conv.lastMessage && (
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {conv.lastMessage}
                      </div>
                    )}

                    {/* 悬停操作按钮 */}
                    <div className="absolute right-2 top-3 hidden gap-1 group-hover:flex">
                      <button
                        type="button"
                        className="rounded p-1 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-300"
                        onClick={e => {
                          e.stopPropagation()
                          handleStartEdit(conv)
                        }}
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-xs text-slate-400 hover:bg-white/10 hover:text-rose-400"
                        onClick={e => handleDelete(conv.id, e)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {conversations.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          暂无对话，点击右上角 + 创建新对话
        </div>
      )}
    </div>
  )
}

function groupConversationsByTime(conversations: Conversation[]): Record<string, Conversation[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const groups: Record<string, Conversation[]> = {
    今天: [],
    昨天: [],
    最近7天: [],
    更早: [],
  }

  conversations.forEach(conv => {
    const date = new Date(conv.updatedAt)
    if (date >= today) {
      groups['今天'].push(conv)
    } else if (date >= yesterday) {
      groups['昨天'].push(conv)
    } else if (date >= sevenDaysAgo) {
      groups['最近7天'].push(conv)
    } else {
      groups['更早'].push(conv)
    }
  })

  // 移除空分组
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key]
    }
  })

  return groups
}
