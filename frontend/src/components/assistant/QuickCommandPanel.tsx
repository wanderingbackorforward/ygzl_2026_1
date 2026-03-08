import React from 'react'
import type { Role } from './types'
import { quickCommands } from './config'

interface QuickCommandPanelProps {
  currentRole: Role
  onCommandClick: (prompt: string) => void
}

export default function QuickCommandPanel({ currentRole, onCommandClick }: QuickCommandPanelProps) {
  // 筛选当前角色的快捷指令
  const filteredCommands = quickCommands.filter(cmd => cmd.role === currentRole)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-cyan-500/20 px-4 py-3">
        <h3 className="text-base font-medium text-cyan-200">快捷指令</h3>
        <p className="mt-1 text-xs text-slate-400">点击快速填充问题</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {filteredCommands.map(cmd => (
            <button
              key={cmd.id}
              type="button"
              className="w-full rounded-lg border border-cyan-500/20 bg-slate-800/30 p-3 text-left transition-all hover:border-cyan-500/40 hover:bg-slate-800/50"
              onClick={() => onCommandClick(cmd.prompt)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{cmd.icon}</span>
                <span className="text-sm font-medium text-slate-200">{cmd.title}</span>
              </div>
            </button>
          ))}
        </div>

        {filteredCommands.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            当前角色暂无快捷指令
          </div>
        )}
      </div>

      {/* 页面上下文信息 */}
      <div className="border-t border-cyan-500/20 p-4">
        <h4 className="mb-2 text-xs font-medium text-slate-400">页面上下文</h4>
        <div className="rounded bg-slate-800/30 p-2 text-xs text-slate-500">
          当前页面的数据会自动传递给 AI
        </div>
      </div>
    </div>
  )
}
