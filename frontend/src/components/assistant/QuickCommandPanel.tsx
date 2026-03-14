import React, { useMemo, useState } from 'react'
import type { AssistantMode, ModuleKey, Role } from './types'
import { quickCommands, roleConfig } from './config'

interface QuickCommandPanelProps {
  currentRole: Role
  currentModule: ModuleKey
  currentMode: AssistantMode
  onCommandClick: (prompt: string) => void
  disabled?: boolean
}

export default function QuickCommandPanel({
  currentRole,
  currentModule,
  currentMode,
  onCommandClick,
  disabled
}: QuickCommandPanelProps) {
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // 第一层：模块 + 模式筛选（不受分类和搜索影响，用于生成可选分类列表）
  const baseCommands = useMemo(() => {
    return quickCommands.filter(cmd => {
      // 模块筛选：modules 未定义 = 通用指令，所有模块可见
      if (cmd.modules && !cmd.modules.includes(currentModule)) return false

      // 模式筛选：mode 未定义或 'both' = 两种模式可见
      if (cmd.mode && cmd.mode !== 'both' && cmd.mode !== currentMode) return false

      return true
    })
  }, [currentModule, currentMode])

  // 从当前可见指令中提取分类（只显示有内容的分类）
  const categories = useMemo(() => {
    const cats = new Set<string>()
    baseCommands.forEach(cmd => {
      if (cmd.category) cats.add(cmd.category)
    })
    return ['all', ...Array.from(cats)]
  }, [baseCommands])

  // 当选中的分类不在可选列表中时自动重置
  useMemo(() => {
    if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
      setSelectedCategory('all')
    }
  }, [categories, selectedCategory])

  // 第二层：在 baseCommands 基础上加搜索 + 分类筛选
  const filteredCommands = useMemo(() => {
    return baseCommands.filter(cmd => {
      // 搜索筛选
      if (searchText) {
        const search = searchText.toLowerCase()
        const matchTitle = cmd.title.toLowerCase().includes(search)
        const matchDesc = cmd.description?.toLowerCase().includes(search)
        const matchTags = cmd.tags?.some(tag => tag.toLowerCase().includes(search))
        const matchCategory = cmd.category?.toLowerCase().includes(search)
        if (!matchTitle && !matchDesc && !matchTags && !matchCategory) return false
      }

      // 分类筛选
      if (selectedCategory !== 'all' && cmd.category !== selectedCategory) return false

      return true
    })
  }, [baseCommands, searchText, selectedCategory])

  // 按分类分组
  const groupedCommands = useMemo(() => {
    const groups: Record<string, typeof filteredCommands> = {}
    filteredCommands.forEach(cmd => {
      const cat = cmd.category || '其他'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(cmd)
    })
    return groups
  }, [filteredCommands])

  const modeLabel = currentMode === 'chat' ? 'Chat' : 'Agent'
  const modeDesc = currentMode === 'chat' ? '知识问答' : '智能分析'
  const roleLabel = roleConfig[currentRole]?.label || currentRole

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="shrink-0 border-b border-slate-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white">快捷指令</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
            currentMode === 'agent' ? 'bg-purple-600 text-white' : 'bg-cyan-600 text-white'
          }`}>
            {modeLabel}
          </span>
          <span className="text-sm text-white">{modeDesc}</span>
          <span className="text-sm text-slate-400">|</span>
          <span className="text-sm text-white">{roleLabel}</span>
        </div>
        {disabled && (
          <p className="mt-1 text-sm text-yellow-400">AI 回复中，请稍候...</p>
        )}
      </div>

      {/* 搜索栏 */}
      <div className="shrink-0 border-b border-slate-600 px-4 py-3">
        <input
          type="text"
          placeholder="搜索指令..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {/* 分类筛选 - 只显示有内容的分类 */}
      {categories.length > 1 && (
        <div className="shrink-0 border-b border-slate-600 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 指令列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedCategory === 'all' && !searchText ? (
          // 分组显示
          Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category} className="mb-5">
              <h4 className="mb-2 text-sm font-bold text-cyan-400">{category}</h4>
              <div className="space-y-2">
                {commands.map(cmd => (
                  <CommandCard
                    key={cmd.id}
                    command={cmd}
                    currentRole={currentRole}
                    disabled={disabled}
                    onClick={() => !disabled && onCommandClick(cmd.prompt)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          // 平铺显示
          <div className="space-y-2">
            {filteredCommands.map(cmd => (
              <CommandCard
                key={cmd.id}
                command={cmd}
                currentRole={currentRole}
                disabled={disabled}
                onClick={() => !disabled && onCommandClick(cmd.prompt)}
              />
            ))}
          </div>
        )}

        {filteredCommands.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-base text-white">
              {searchText ? '未找到匹配的指令' : '当前模块暂无快捷指令'}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              试试切换模式或搜索关键词
            </p>
          </div>
        )}
      </div>

      {/* 底部：模式说明 */}
      <div className="shrink-0 border-t border-slate-600 px-4 py-3">
        <div className="flex gap-2 text-xs text-white">
          <div className="flex-1 rounded bg-slate-800 px-2 py-1.5">
            <span className="font-semibold text-cyan-400">Chat</span> 知识问答
          </div>
          <div className="flex-1 rounded bg-slate-800 px-2 py-1.5">
            <span className="font-semibold text-purple-400">Agent</span> 查数据分析
          </div>
        </div>
      </div>
    </div>
  )
}

// 指令卡片组件
function CommandCard({
  command,
  currentRole,
  disabled,
  onClick
}: {
  command: typeof quickCommands[0]
  currentRole: Role
  disabled?: boolean
  onClick: () => void
}) {
  const isRoleMatch = command.role === currentRole
  const modeColor = command.mode === 'agent'
    ? 'text-purple-400'
    : command.mode === 'chat'
    ? 'text-cyan-400'
    : 'text-slate-400'

  // 非当前角色的指令稍微淡化显示但仍可点击
  const roleLabel = roleConfig[command.role]?.label

  return (
    <button
      type="button"
      disabled={disabled}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        disabled
          ? 'cursor-not-allowed border-slate-600 bg-slate-800 opacity-50'
          : isRoleMatch
          ? 'border-slate-500 bg-slate-800 hover:border-cyan-400 hover:bg-slate-700'
          : 'border-slate-600 bg-slate-800/60 hover:border-slate-400 hover:bg-slate-700'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none">{command.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{command.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {command.mode && command.mode !== 'both' && (
              <span className={`text-xs font-medium ${modeColor}`}>
                {command.mode === 'agent' ? 'Agent' : 'Chat'}
              </span>
            )}
            {!isRoleMatch && roleLabel && (
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                {roleLabel}
              </span>
            )}
          </div>
          {command.description && (
            <p className="mt-1 text-xs text-slate-300">{command.description}</p>
          )}
        </div>
      </div>
    </button>
  )
}
