import { create } from 'zustand'
import { apiGet, apiPost } from '../lib/api'

export interface Insight {
  id: string
  created_at: string
  insight_type: 'patrol_summary' | 'anomaly' | 'resolution'
  severity: 'info' | 'warning' | 'critical'
  point_id: string | null
  title: string
  body: string | null
  evidence: Record<string, unknown> | null
  suggestion: string | null
  acknowledged: boolean
  dismissed: boolean
}

export interface BadgeInfo {
  has_unread: boolean
  count: number
  max_severity: 'info' | 'warning' | 'critical'
}

interface AgentState {
  // 数据
  insights: Insight[]
  badge: BadgeInfo
  loading: boolean
  lastFetchTime: number

  // 操作
  fetchInsights: () => Promise<void>
  fetchBadge: () => Promise<void>
  acknowledge: (id: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  insights: [],
  badge: { has_unread: false, count: 0, max_severity: 'info' },
  loading: false,
  lastFetchTime: 0,

  fetchInsights: async () => {
    // 防抖：30秒内不重复拉取
    const now = Date.now()
    if (now - get().lastFetchTime < 30_000) return

    set({ loading: true })
    try {
      const data = await apiGet<Insight[]>('/agent/insights?limit=50')
      set({ insights: data || [], lastFetchTime: now })
    } catch (e) {
      console.warn('[Agent] fetch insights failed:', e)
    } finally {
      set({ loading: false })
    }
  },

  fetchBadge: async () => {
    try {
      const data = await apiGet<BadgeInfo>('/agent/badge')
      set({ badge: data || { has_unread: false, count: 0, max_severity: 'info' } })
    } catch {
      // 静默失败，不影响用户
    }
  },

  acknowledge: async (id: string) => {
    try {
      await apiPost('/agent/acknowledge', { insight_id: id })
      // 本地更新
      set(state => ({
        insights: state.insights.map(i =>
          i.id === id ? { ...i, acknowledged: true } : i
        ),
        badge: {
          ...state.badge,
          count: Math.max(0, state.badge.count - 1),
          has_unread: state.badge.count > 1,
        },
      }))
    } catch (e) {
      console.warn('[Agent] acknowledge failed:', e)
    }
  },

  dismiss: async (id: string) => {
    try {
      await apiPost('/agent/dismiss', { insight_id: id })
      set(state => ({
        insights: state.insights.map(i =>
          i.id === id ? { ...i, dismissed: true, acknowledged: true } : i
        ),
        badge: {
          ...state.badge,
          count: Math.max(0, state.badge.count - 1),
          has_unread: state.badge.count > 1,
        },
      }))
    } catch (e) {
      console.warn('[Agent] dismiss failed:', e)
    }
  },
}))
