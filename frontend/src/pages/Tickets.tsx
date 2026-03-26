import React, { useState, useEffect, useMemo } from 'react'
import { apiGet, apiPost, apiPatch } from '../lib/api'
import { useLocation, useNavigate } from 'react-router-dom'

type TicketStatus = 'PENDING' | 'IN_PROGRESS' | 'SUSPENDED' | 'RESOLVED' | 'CLOSED' | 'REJECTED'
type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface Ticket {
  id: number
  ticket_number: string
  title: string
  description?: string
  ticket_type: string
  status: TicketStatus
  priority: TicketPriority
  creator_name?: string
  assignee_name?: string
  monitoring_point_id?: string
  created_at: string
  updated_at?: string
  comments?: Comment[]
}

interface Comment {
  id: number
  author_name: string
  content: string
  created_at: string
}

interface TicketStats {
  total: number
  by_status: Record<string, number>
  today_created: number
  overdue: number
}

interface TicketConfig {
  types?: Record<string, { name: string; description?: string }>
  status?: Record<string, { name: string; color?: string }>
  priority?: Record<string, { name: string; color?: string }>
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  SUSPENDED: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/40',
  CLOSED: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/40',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  LOW: 'bg-green-500/20 text-green-400 border-green-500/40',
}

interface CreateTicketDrawerProps {
  config: TicketConfig
  template: string | null
  onClose: () => void
  onSuccess: () => void
}

function CreateTicketDrawer({ config, template, onClose, onSuccess }: CreateTicketDrawerProps) {
  const [mode, setMode] = useState<'quick' | 'manual'>(template ? 'manual' : 'quick')
  const [quickInput, setQuickInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    ticket_type: template || '',
    priority: 'MEDIUM' as TicketPriority,
    description: '',
    monitoring_point_id: '',
    current_value: null as number | null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 模板预填充
  useEffect(() => {
    if (template) {
      const typeName = config.types?.[template]?.name || ''
      setFormData((prev) => ({
        ...prev,
        ticket_type: template,
        title: `${typeName}告警`,
        priority: 'HIGH',
      }))
    }
  }, [template, config])

  async function handleQuickParse() {
    if (!quickInput.trim()) {
      setError('请输入内容')
      return
    }

    try {
      setParsing(true)
      setError('')
      const parsed = await apiPost<typeof formData>('/tickets/parse-quick-input', {
        input: quickInput,
      })
      setFormData(parsed)
      setMode('manual')
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败')
    } finally {
      setParsing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError('请输入工单标题')
      return
    }
    if (!formData.ticket_type) {
      setError('请选择工单类型')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      await apiPost('/tickets', {
        ...formData,
        creator_id: 'current_user',
        creator_name: '当前用户',
        send_email: false,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-96 flex-col bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">新建工单</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* 快速创建模式 */}
            {mode === 'quick' && (
              <div>
                <div className="mb-3 text-sm text-slate-300">
                  💡 输入一句话快速创建工单，例如：
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <div>• "DB-001 沉降 15mm"</div>
                    <div>• "裂缝异常 DB-002"</div>
                    <div>• "温度超限 35度 DB-003"</div>
                  </div>
                </div>
                <textarea
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleQuickParse()
                    }
                  }}
                  rows={4}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="输入问题描述..."
                />
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMode('manual')}
                    className="text-xs text-slate-400 hover:text-cyan-400"
                  >
                    切换到手动填写
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickParse}
                    disabled={parsing}
                    className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {parsing ? '解析中...' : 'AI 解析 (Ctrl+Enter)'}
                  </button>
                </div>
              </div>
            )}

            {/* 手动填写模式 */}
            {mode === 'manual' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-slate-300">手动填写</div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('quick')
                      setFormData({
                        title: '',
                        ticket_type: '',
                        priority: 'MEDIUM',
                        description: '',
                        monitoring_point_id: '',
                        current_value: null,
                      })
                    }}
                    className="text-xs text-slate-400 hover:text-cyan-400"
                  >
                    返回快速创建
                  </button>
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    标题 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="简要描述问题"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    类型 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.ticket_type}
                    onChange={(e) => setFormData({ ...formData, ticket_type: e.target.value })}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">请选择类型</option>
                    {config.types &&
                      Object.entries(config.types).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-white">优先级</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    {config.priority &&
                      Object.entries(config.priority).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-white">监测点</label>
                  <input
                    type="text"
                    value={formData.monitoring_point_id}
                    onChange={(e) => setFormData({ ...formData, monitoring_point_id: e.target.value })}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="监测点编号（可选）"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-white">详细描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="详细描述问题情况..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-700 px-6 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {submitting ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Tickets() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [config, setConfig] = useState<TicketConfig>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [quickTemplate, setQuickTemplate] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
    loadStats()
    loadTickets()
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    if (!pageNotice) return undefined
    const timer = window.setTimeout(() => setPageNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [pageNotice])

  async function loadConfig() {
    try {
      const [types, status, priority] = await Promise.all([
        apiGet<Record<string, any>>('/tickets/config/types'),
        apiGet<Record<string, any>>('/tickets/config/status'),
        apiGet<Record<string, any>>('/tickets/config/priority'),
      ])
      setConfig({ types, status, priority })
    } catch (err) {
      console.error('Failed to load config:', err)
    }
  }

  async function loadStats() {
    try {
      const data = await apiGet<TicketStats>('/tickets/statistics')
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  async function loadTickets() {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: '1', limit: '100' })
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (searchQuery) params.set('search', searchQuery)

      const result = await apiGet<{ tickets: Ticket[] }>(`/tickets?${params}`)
      setTickets(result.tickets || [])
    } catch (err) {
      console.error('Failed to load tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets
    const q = searchQuery.toLowerCase()
    return tickets.filter(
      (t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    )
  }, [tickets, searchQuery])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const ticketIdText = params.get('ticketId')
    const created = params.get('created')
    const ticketId = ticketIdText ? Number(ticketIdText) : NaN

    if (!ticketIdText || Number.isNaN(ticketId)) return

    const matched = tickets.find((ticket) => ticket.id === ticketId)
    if (matched) {
      setSelectedTicket(matched)
      if (created === '1') {
        setPageNotice(`已定位到新工单 ${matched.ticket_number}`)
        navigate(`/tickets?ticketId=${ticketId}`, { replace: true })
      }
      return
    }

    let cancelled = false
    apiGet<Ticket>(`/tickets/${ticketId}`)
      .then((ticket) => {
        if (cancelled) return
        setSelectedTicket(ticket)
        if (created === '1') {
          setPageNotice(`已定位到新工单 ${ticket.ticket_number}`)
          navigate(`/tickets?ticketId=${ticketId}`, { replace: true })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load ticket by id:', err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [tickets, location.search, navigate])

  function getStatusName(status: string) {
    return config.status?.[status]?.name || status
  }

  function getTypeName(type: string) {
    return config.types?.[type]?.name || type
  }

  function getPriorityName(priority: string) {
    return config.priority?.[priority]?.name || priority
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString('zh-CN')
  }

  async function handleStatusChange(ticketId: number, newStatus: TicketStatus) {
    try {
      await apiPatch(`/tickets/${ticketId}/status`, {
        status: newStatus,
        user_id: 'current_user',
        user_role: 'admin',
        send_email: false,
      })
      await loadTickets()
      await loadStats()
      if (selectedTicket?.id === ticketId) {
        const updated = await apiGet<Ticket>(`/tickets/${ticketId}`)
        setSelectedTicket(updated)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('更新状态失败')
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {pageNotice && (
        <div className="shrink-0 border-b border-green-500/20 bg-green-500/10 px-6 py-2 text-sm text-green-200">
          <i className="fas fa-circle-check mr-2" />
          {pageNotice}
        </div>
      )}
      {/* 顶栏：统计徽章 + 快捷按钮 + 新建按钮 */}
      <div className="shrink-0 border-b border-cyan-500/20 bg-slate-900/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white">工单</h1>
            {stats && (
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-yellow-400">
                  待处理 {stats.by_status?.PENDING || 0}
                </span>
                <span className="rounded border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-blue-400">
                  处理中 {stats.by_status?.IN_PROGRESS || 0}
                </span>
                {(stats.overdue || 0) > 0 && (
                  <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-400">
                    逾期 {stats.overdue}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 快捷模板按钮 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setQuickTemplate('SETTLEMENT_ALERT')
                  setShowCreateDrawer(true)
                }}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white hover:border-cyan-500 hover:bg-slate-700"
                title="快速创建沉降告警工单"
              >
                沉降
              </button>
              <button
                onClick={() => {
                  setQuickTemplate('CRACK_ALERT')
                  setShowCreateDrawer(true)
                }}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white hover:border-cyan-500 hover:bg-slate-700"
                title="快速创建裂缝异常工单"
              >
                裂缝
              </button>
              <button
                onClick={() => {
                  setQuickTemplate('TEMPERATURE_ALERT')
                  setShowCreateDrawer(true)
                }}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white hover:border-cyan-500 hover:bg-slate-700"
                title="快速创建温度告警工单"
              >
                温度
              </button>
              <button
                onClick={() => {
                  setQuickTemplate('VIBRATION_ALERT')
                  setShowCreateDrawer(true)
                }}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white hover:border-cyan-500 hover:bg-slate-700"
                title="快速创建振动异常工单"
              >
                振动
              </button>
            </div>
            <div className="h-4 w-px bg-slate-600"></div>
            <button
              onClick={() => {
                setQuickTemplate(null)
                setShowCreateDrawer(true)
              }}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
            >
              + 新建工单
            </button>
          </div>
        </div>
      </div>

      {/* 搜索筛选栏 */}
      <div className="shrink-0 border-b border-slate-700/50 bg-slate-900/30 px-6 py-2.5">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="搜索工单..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-400 outline-none focus:border-cyan-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
          >
            <option value="">所有状态</option>
            {config.status &&
              Object.entries(config.status).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.name}
                </option>
              ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
          >
            <option value="">所有优先级</option>
            {config.priority &&
              Object.entries(config.priority).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* 主内容：左侧列表 + 右侧详情 */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧工单列表 */}
        <div className="min-h-0 w-96 shrink-0 overflow-y-auto border-r border-slate-700/50 bg-slate-900/20">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">加载中...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400">暂无工单</div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`cursor-pointer border-b border-slate-700/30 px-4 py-3 transition-colors hover:bg-slate-800/40 ${
                  selectedTicket?.id === ticket.id ? 'bg-slate-800/60' : ''
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-cyan-400">{ticket.ticket_number}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs ${
                      STATUS_COLORS[ticket.status] || 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {getStatusName(ticket.status)}
                  </span>
                </div>
                <div className="mb-1.5 text-sm font-medium text-white">{ticket.title}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span
                    className={`rounded border px-1.5 py-0.5 ${
                      PRIORITY_COLORS[ticket.priority] || 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {getPriorityName(ticket.priority)}
                  </span>
                  <span>{formatDate(ticket.created_at)}</span>
                  {ticket.assignee_name && <span>· {ticket.assignee_name}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右侧详情面板 */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-900/10 p-6">
          {selectedTicket ? (
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="mb-1 text-xs font-medium text-cyan-400">{selectedTicket.ticket_number}</div>
                  <h2 className="text-xl font-semibold text-white">{selectedTicket.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded border border-slate-700/50 bg-slate-800/30 p-3">
                  <div className="mb-1 text-xs text-slate-400">状态</div>
                  <div className="text-sm font-medium text-white">{getStatusName(selectedTicket.status)}</div>
                </div>
                <div className="rounded border border-slate-700/50 bg-slate-800/30 p-3">
                  <div className="mb-1 text-xs text-slate-400">优先级</div>
                  <div className="text-sm font-medium text-white">{getPriorityName(selectedTicket.priority)}</div>
                </div>
                <div className="rounded border border-slate-700/50 bg-slate-800/30 p-3">
                  <div className="mb-1 text-xs text-slate-400">类型</div>
                  <div className="text-sm font-medium text-white">{getTypeName(selectedTicket.ticket_type)}</div>
                </div>
                <div className="rounded border border-slate-700/50 bg-slate-800/30 p-3">
                  <div className="mb-1 text-xs text-slate-400">创建时间</div>
                  <div className="text-sm font-medium text-white">{formatDate(selectedTicket.created_at)}</div>
                </div>
              </div>

              {selectedTicket.description && (
                <div className="mb-4 rounded border border-slate-700/50 bg-slate-800/30 p-4">
                  <div className="mb-2 text-xs font-medium text-slate-400">描述</div>
                  <div className="text-sm text-white">{selectedTicket.description}</div>
                </div>
              )}

              <div className="flex gap-2">
                {selectedTicket.status === 'PENDING' && (
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'IN_PROGRESS')}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    开始处理
                  </button>
                )}
                {selectedTicket.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'RESOLVED')}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
                  >
                    标记解决
                  </button>
                )}
                {selectedTicket.status === 'RESOLVED' && (
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'CLOSED')}
                    className="rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-500"
                  >
                    关闭工单
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              选择一个工单查看详情
            </div>
          )}
        </div>
      </div>

      {/* 创建工单抽屉 */}
      {showCreateDrawer && (
        <CreateTicketDrawer
          config={config}
          template={quickTemplate}
          onClose={() => {
            setShowCreateDrawer(false)
            setQuickTemplate(null)
          }}
          onSuccess={() => {
            setShowCreateDrawer(false)
            setQuickTemplate(null)
            loadTickets()
            loadStats()
          }}
        />
      )}
    </div>
  )
}
