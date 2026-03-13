import React from 'react'
import type { ModuleKey, Role } from './types'
import { quickCommands } from './config'

interface QuickCommandPanelProps {
  currentRole: Role
  currentModule: ModuleKey
  onCommandClick: (prompt: string) => void
  disabled?: boolean
}

export default function QuickCommandPanel({ currentRole, currentModule, onCommandClick, disabled }: QuickCommandPanelProps) {
  // 筛选当前角色 + 当前模块的快捷指令
  const filteredCommands = quickCommands.filter(cmd => {
    if (cmd.role !== currentRole) return false
    // modules 未定义 = 通用指令，所有模块可见
    if (!cmd.modules) return true
    return cmd.modules.includes(currentModule)
  })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white">快捷指令</h3>
        <p className="mt-1 text-sm text-white">
          {disabled ? 'AI 回复中，请稍候...' : '点击自动发送给 AI'}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {filteredCommands.map(cmd => (
            <button
              key={cmd.id}
              type="button"
              disabled={disabled}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                disabled
                  ? 'border-slate-600 bg-slate-800 opacity-50 cursor-not-allowed'
                  : 'border-slate-500 bg-slate-800 hover:border-cyan-400 hover:bg-slate-700'
              }`}
              onClick={() => !disabled && onCommandClick(cmd.prompt)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">{cmd.icon}</span>
                <span className="text-base font-semibold text-white">{cmd.title}</span>
              </div>
            </button>
          ))}
        </div>

        {filteredCommands.length === 0 && (
          <div className="py-8 text-center text-base text-white">
            当前角色暂无快捷指令
          </div>
        )}
      </div>

      {/* 页面上下文信息 */}
      <div className="border-t border-slate-600 p-4">
        <h4 className="mb-2 text-sm font-bold text-white">页面上下文</h4>
        <div className="rounded-lg bg-slate-800 p-3 text-sm text-white">
          当前页面的数据会自动传递给 AI
        </div>
      </div>
    </div>
  )
}
