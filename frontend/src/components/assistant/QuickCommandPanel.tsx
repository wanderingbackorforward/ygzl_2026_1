import React, { useMemo, useState } from 'react'
import type { AssistantMode, ModuleKey, Role } from './types'
import { quickCommands } from './config'

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

  // 筛选当前角色 + 当前模块 + 当前模式的快捷指令
  const filteredCommands = useMemo(() => {
    return quickCommands.filter(cmd => {
      // 角色筛选
      if (cmd.role !== currentRole) return false

      // 模块筛选
      if (cmd.modules && !cmd.modules.includes(currentModule)) return false

      // 模式筛选
      if (cmd.mode && cmd.mode !== 'both' && cmd.mode !== currentMode) return false

      // 搜索筛选
      if (searchText) {
        const search = searchText.toLowerCase()
        const matchTitle = cmd.title.toLowerCase().includes(search)
        const matchDesc = cmd.description?.toLowerCase().includes(search)
        const matchTags = cmd.tags?.some(tag => tag.toLowerCase().includes(search))
        if (!matchTitle && !matchDesc && !matchTags) return false
      }

      // 分类筛选
      if (selectedCategory !== 'all' && cmd.category !== selectedCategory) return false

      return true
    })
  }, [currentRole, currentModule, currentMode, searchText, selectedCategory])

  // 提取所有分类
  const categories = useMemo(() => {
    const cats = new Set<string>()
    quickCommands.forEach(cmd => {
      if (cmd.category) cats.add(cmd.category)
    })
    return ['all', ...Array.from(cats)]
  }, [])

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

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="shrink-0 border-b border-slate-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white">快捷指令</h3>
        <p className="mt-1 text-sm text-white">
          {disabled ? 'AI 回复中，请稍候...' : `当前模式：${currentMode === 'chat' ? 'Chat（知识问答）' : 'Agent（智能分析）'}`}
        </p>
      </div>

      {/* 搜索栏 */}
      <div className="shrink-0 border-b border-slate-600 p-4">
        <input
          type="text"
          placeholder="搜索指令..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {/* 分类筛选 */}
      <div className="shrink-0 border-b border-slate-600 p-4">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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

      {/* 指令列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedCategory === 'all' ? (
          // 分组显示
          Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category} className="mb-6">
              <h4 className="mb-3 text-sm font-bold text-cyan-400">{category}</h4>
              <div className="space-y-3">
                {commands.map(cmd => (
                  <CommandCard
                    key={cmd.id}
                    command={cmd}
                    disabled={disabled}
                    onClick={() => !disabled && onCommandClick(cmd.prompt)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          // 单分类显示
          <div className="space-y-3">
            {filteredCommands.map(cmd => (
              <CommandCard
                key={cmd.id}
                command={cmd}
                disabled={disabled}
                onClick={() => !disabled && onCommandClick(cmd.prompt)}
              />
            ))}
          </div>
        )}

        {filteredCommands.length === 0 && (
          <div className="py-8 text-center text-base text-white">
            {searchText ? '未找到匹配的指令' : '当前角色/模式暂无快捷指令'}
          </div>
        )}
      </div>

      {/* 页面上下文信息 */}
      <div className="shrink-0 border-t border-slate-600 p-4">
        <h4 className="mb-2 text-sm font-bold text-white">模式说明</h4>
        <div className="space-y-2 text-xs text-white">
          <div className="rounded-lg bg-slate-800 p-2">
            <span className="font-semibold text-cyan-400">Chat 模式：</span>
            基于知识库回答问题，不查询实时数据
          </div>
          <div className="rounded-lg bg-slate-800 p-2">
            <span className="font-semibold text-purple-400">Agent 模式：</span>
            自动调用工具查询真实数据并生成分析
          </div>
        </div>
      </div>
    </div>
  )
}

// 指令卡片组件
function CommandCard({
  command,
  disabled,
  onClick
}: {
  command: typeof quickCommands[0]
  disabled?: boolean
  onClick: () => void
}) {
  const modeColor = command.mode === 'agent'
    ? 'text-purple-400'
    : command.mode === 'chat'
    ? 'text-cyan-400'
    : 'text-slate-400'

  return (
    <button
      type="button"
      disabled={disabled}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        disabled
          ? 'cursor-not-allowed border-slate-600 bg-slate-800 opacity-50'
          : 'border-slate-500 bg-slate-800 hover:border-cyan-400 hover:bg-slate-700'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{command.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">{command.title}</span>
            {command.mode && command.mode !== 'both' && (
              <span className={`text-xs font-medium ${modeColor}`}>
                {command.mode === 'agent' ? 'Agent' : 'Chat'}
              </span>
            )}
          </div>
          {command.description && (
            <p className="mt-1 text-xs text-slate-300">{command.description}</p>
          )}
          {command.tags && command.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {command.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
