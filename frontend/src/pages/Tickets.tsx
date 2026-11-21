import React, { useState, useEffect, useMemo } from 'react'
import { apiGet, apiPost, apiPut } from '../lib/api'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader, KpiCard, DataPanel, StateView } from '../components/common/ui'

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
  allowed_transitions?: TicketStatus[]
  comments?: Comment[]
}

function transitionAction(
  from: TicketStatus,
  to: TicketStatus,
): { label: string; tone: 'primary' | 'ok' | 'warn' | 'danger' | 'muted' } {
  if (to === 'IN_PROGRESS') {
    return {
      label: from === 'PENDING' ? '开始处理' : from === 'SUSPENDED' ? '恢复处理' : '重新打开',
      tone: 'primary',
    }
  }
  if (to === 'RESOLVED') return { label: '标记解决', tone: 'ok' }
  if (to === 'CLOSED') return { label: '关闭工单', tone: 'muted' }
  if (to === 'SUSPENDED') return { label: '挂起', tone: 'warn' }
  return { label: '拒绝工单', tone: 'danger' }
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

const STATUS_CHIP: Record<TicketStatus, string> = {
  PENDING: 'ds-chip--warn',
  IN_PROGRESS: 'ds-chip--info',
  SUSPENDED: '',
  RESOLVED: 'ds-chip--ok',
  CLOSED: '',
  REJECTED: 'ds-chip--danger',
}

const PRIORITY_CHIP: Record<TicketPriority, string> = {
  CRITICAL: 'ds-chip--danger',
  HIGH: 'ds-chip--warn',
  MEDIUM: 'ds-chip--info',
  LOW: 'ds-chip--ok',
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
                  className="ds-input w-full"
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
                    className="ds-btn ds-btn--primary"
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
                    className="ds-input w-full"
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
                    className="ds-input w-full"
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
                    className="ds-input w-full"
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
                    className="ds-input w-full"
                    placeholder="监测点编号（可选）"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-white">详细描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="ds-input w-full"
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
                className="ds-btn flex-1"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="ds-btn ds-btn--primary flex-1"
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
  const [systemStatus, setSystemStatus] = useState<{ counts: { settlement_abnormal: number } } | null>(null)
  const [config, setConfig] = useState<TicketConfig>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [quickTemplate, setQuickTemplate] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [loadErrors, setLoadErrors] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const notePart = (label: string, failed: boolean) =>
    setLoadErrors(prev => (
      failed
        ? (prev.includes(label) ? prev : [...prev, label])
        : prev.filter(item => item !== label)
    ))

  useEffect(() => {
    loadConfig()
    loadStats()
    loadTickets()
    loadSystemStatus()
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    if (!pageNotice) return undefined
    const timer = window.setTimeout(() => setPageNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [pageNotice])

  useEffect(() => {
    if (!actionError) return undefined
    const timer = window.setTimeout(() => setActionError(null), 4000)
    return () => window.clearTimeout(timer)
  }, [actionError])

  async function loadConfig() {
    try {
      const [types, status, priority] = await Promise.all([
        apiGet<Record<string, any>>('/tickets/config/types'),
        apiGet<Record<string, any>>('/tickets/config/status'),
        apiGet<Record<string, any>>('/tickets/config/priority'),
      ])
      setConfig({ types, status, priority })
      notePart('工单配置', false)
    } catch (err) {
      console.error('Failed to load config:', err)
      notePart('工单配置', true)
    }
  }

  async function loadSystemStatus() {
    try {
      const data = await apiGet<{ counts: { settlement_abnormal: number } }>('/status/summary')
      setSystemStatus(data)
      notePart('系统状态', false)
    } catch (err) {
      console.error('Failed to load system status:', err)
      notePart('系统状态', true)
    }
  }

  async function loadStats() {
    try {
      const data = await apiGet<TicketStats>('/tickets/statistics')
      setStats(data)
      notePart('工单统计', false)
    } catch (err) {
      console.error('Failed to load stats:', err)
      notePart('工单统计', true)
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
      notePart('工单列表', false)
    } catch (err) {
      console.error('Failed to load tickets:', err)
      notePart('工单列表', true)
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
          setActionError('按工单号定位失败，列表可能与链接不一致')
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
      await apiPut(`/tickets/${ticketId}/status`, {
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
      setActionError('更新状态失败，请稍后重试')
    }
  }

  const listState = loading
    ? 'loading'
    : loadErrors.includes('工单列表')
      ? 'error'
      : filteredTickets.length === 0
        ? 'empty'
        : 'ready'

  return (
    <div className="ds-page">
      {pageNotice && (
        <div className="shrink-0 border-b border-green-500/20 bg-green-500/10 px-6 py-2 text-sm text-green-200">
          <i className="fas fa-circle-check mr-2" />
          {pageNotice}
        </div>
      )}
      {actionError && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-6 py-2 text-sm text-red-200">
          <i className="fas fa-exclamation-triangle mr-2" />
          {actionError}
        </div>
      )}
      {loadErrors.length > 0 && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-6 py-2 text-sm text-red-200">
          <i className="fas fa-exclamation-triangle mr-2" />
          以下接口不可用：{loadErrors.join('、')}。页面数字不完整。
          <button
            type="button"
            className="ml-3 underline hover:text-white"
            onClick={() => { loadConfig(); loadStats(); loadTickets(); loadSystemStatus() }}
          >
            重试
          </button>
        </div>
      )}

      <PageHeader
        eyebrow="TICKETS · 工单闭环"
        title="工单"
        description="异常点位 → 建单 → 处置 → 归档，一条链路追到底"
        meta={
          <>
            {systemStatus && (
              <span className="ds-chip ds-chip--info">
                监测点异常 {systemStatus.counts.settlement_abnormal}
              </span>
            )}
            {stats && (
              <span className="ds-chip ds-chip--warn">待处理 {stats.by_status?.PENDING || 0}</span>
            )}
            {stats && (
              <span className="ds-chip ds-chip--accent">处理中 {stats.by_status?.IN_PROGRESS || 0}</span>
            )}
            {stats && (stats.overdue || 0) > 0 && (
              <span className="ds-chip ds-chip--danger">逾期 {stats.overdue}</span>
            )}
          </>
        }
        actions={
          <>
            <div className="ds-toolbar" style={{ gap: 6 }}>
              {[
                { type: 'SETTLEMENT_ALERT', label: '沉降', title: '快速创建沉降告警工单' },
                { type: 'CRACK_ALERT', label: '裂缝', title: '快速创建裂缝异常工单' },
                { type: 'TEMPERATURE_ALERT', label: '温度', title: '快速创建温度告警工单' },
                { type: 'VIBRATION_ALERT', label: '振动', title: '快速创建振动异常工单' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="ds-btn"
                  title={item.title}
                  onClick={() => {
                    setQuickTemplate(item.type)
                    setShowCreateDrawer(true)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={() => {
                setQuickTemplate(null)
                setShowCreateDrawer(true)
              }}
            >
              + 新建工单
            </button>
          </>
        }
      />

      <div className="ds-page__body">
        {stats && (
          <div className="ds-kpi-grid">
            <KpiCard
              compact
              label="待处理"
              value={stats.by_status?.PENDING || 0}
              unit="单"
              tone={(stats.by_status?.PENDING || 0) > 0 ? 'warn' : 'ok'}
              sub="待首次响应"
            />
            <KpiCard
              compact
              label="处理中"
              value={stats.by_status?.IN_PROGRESS || 0}
              unit="单"
              tone="info"
              sub="已派单未闭环"
            />
            <KpiCard
              compact
              label="逾期"
              value={stats.overdue || 0}
              unit="单"
              tone={(stats.overdue || 0) > 0 ? 'danger' : 'ok'}
              sub="超过处理时限"
            />
            <KpiCard compact label="今日新建" value={stats.today_created || 0} unit="单" sub="当日 0 点后" />
          </div>
        )}

        <div className="ds-toolbar" style={{ flexShrink: 0 }}>
          <input
            type="text"
            className="ds-input ds-input--flex"
            placeholder="搜索工单号 / 标题 / 描述…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="ds-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            className="ds-input"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
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

        <div className="ds-split">
          <DataPanel
            className="ds-split__side"
            title="工单列表"
            icon="fa-ticket"
            subtitle={`${filteredTickets.length} 条`}
            state={listState}
            emptyText="暂无工单"
            emptyHint={
              searchQuery || statusFilter || priorityFilter
                ? '当前筛选条件下没有记录，清空筛选再试'
                : '还没有工单，右上角可直接新建'
            }
            errorText="工单列表接口不可用"
            onRetry={loadTickets}
            scroll
          >
            {filteredTickets.map((ticket) => (
              <button
                type="button"
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`ds-list-item ${selectedTicket?.id === ticket.id ? 'ds-list-item--active' : ''}`.trim()}
              >
                <div className="ds-list-item__top">
                  <span className="ds-list-item__no">{ticket.ticket_number}</span>
                  <span className={`ds-chip ${STATUS_CHIP[ticket.status] || ''}`.trim()}>
                    {getStatusName(ticket.status)}
                  </span>
                </div>
                <div className="ds-list-item__title">{ticket.title}</div>
                <div className="ds-list-item__meta">
                  <span className={`ds-chip ${PRIORITY_CHIP[ticket.priority] || ''}`.trim()}>
                    {getPriorityName(ticket.priority)}
                  </span>
                  <span>{formatDate(ticket.created_at)}</span>
                  {ticket.assignee_name && <span>· {ticket.assignee_name}</span>}
                </div>
              </button>
            ))}
          </DataPanel>

          <DataPanel
            className="ds-split__main"
            title="工单详情"
            icon="fa-file-lines"
            subtitle={selectedTicket ? selectedTicket.ticket_number : undefined}
            scroll
          >
            {selectedTicket ? (
              <div style={{ padding: 'var(--ds-space-3) 14px' }}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="ds-list-item__no">{selectedTicket.ticket_number}</div>
                    <h2 className="ds-page-header__title" style={{ marginTop: 2 }}>
                      {selectedTicket.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="ds-btn"
                    onClick={() => setSelectedTicket(null)}
                  >
                    关闭
                  </button>
                </div>

                <div className="ds-meta-grid mb-3">
                  <div className="ds-meta">
                    <div className="ds-meta__label">状态</div>
                    <div className="ds-meta__value">{getStatusName(selectedTicket.status)}</div>
                  </div>
                  <div className="ds-meta">
                    <div className="ds-meta__label">优先级</div>
                    <div className="ds-meta__value">{getPriorityName(selectedTicket.priority)}</div>
                  </div>
                  <div className="ds-meta">
                    <div className="ds-meta__label">类型</div>
                    <div className="ds-meta__value">{getTypeName(selectedTicket.ticket_type)}</div>
                  </div>
                  <div className="ds-meta">
                    <div className="ds-meta__label">创建时间</div>
                    <div className="ds-meta__value">{formatDate(selectedTicket.created_at)}</div>
                  </div>
                  {selectedTicket.monitoring_point_id && (
                    <div className="ds-meta">
                      <div className="ds-meta__label">监测点位</div>
                      <button
                        type="button"
                        onClick={() => navigate(`/advanced?point=${encodeURIComponent(selectedTicket.monitoring_point_id!)}&from=tickets`)}
                        className="ds-meta__value"
                        style={{
                          padding: 0,
                          background: 'none',
                          border: 'none',
                          color: 'var(--ds-accent-text)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {selectedTicket.monitoring_point_id} · 回到点位
                      </button>
                    </div>
                  )}
                </div>

                {selectedTicket.description && (
                  <div className="ds-meta mb-3">
                    <div className="ds-meta__label">描述</div>
                    <div style={{ marginTop: 4, fontSize: 'var(--ds-fs-small)', color: 'var(--ds-text)' }}>
                      {selectedTicket.description}
                    </div>
                  </div>
                )}

                <div className="ds-toolbar">
                  {(selectedTicket.allowed_transitions || []).map((next) => {
                    const action = transitionAction(selectedTicket.status, next)
                    return (
                      <button
                        key={next}
                        type="button"
                        onClick={() => handleStatusChange(selectedTicket.id, next)}
                        className={`ds-btn ds-btn--${action.tone}`}
                      >
                        {action.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <StateView
                kind="nodata"
                title="选择一个工单查看详情"
                hint="左侧列表点选后，可查看描述、关联点位与处置动作"
                compact
              />
            )}
          </DataPanel>
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
