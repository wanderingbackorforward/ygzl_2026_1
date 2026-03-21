import { useEffect } from 'react'
import { useAgentStore } from '../stores/agentStore'

/**
 * Agent 数据拉取 hook。
 * 在组件挂载时拉取 insights 和 badge，之后每 60 秒刷新 badge。
 */
export function useAgent() {
  const { fetchInsights, fetchBadge, insights, badge, loading } = useAgentStore()

  useEffect(() => {
    fetchInsights()
    fetchBadge()

    // 每 60 秒刷新 badge（轻量接口）
    const timer = setInterval(() => {
      fetchBadge()
    }, 60_000)

    return () => clearInterval(timer)
  }, [fetchInsights, fetchBadge])

  // 最新的巡检摘要
  const latestPatrol = insights.find(i => i.insight_type === 'patrol_summary')

  // 未读异常 insights
  const unreadAnomalies = insights.filter(
    i => i.insight_type === 'anomaly' && !i.acknowledged && !i.dismissed
  )

  return { latestPatrol, unreadAnomalies, badge, loading, insights }
}
