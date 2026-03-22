import { useEffect, useRef } from 'react'
import { useAgentStore } from '../stores/agentStore'
import { apiGet } from '../lib/api'

/**
 * Agent 数据拉取 hook。
 * 修复：立即拉已有数据展示，后台触发巡检完成后再刷新。
 */
export function useAgent() {
  const { fetchInsights, fetchBadge, insights, badge, loading } = useAgentStore()
  const patrolTriggered = useRef(false)

  useEffect(() => {
    // 立即拉已有 insights（上次巡检的结果）
    fetchInsights()
    fetchBadge()

    // 后台触发巡检，完成后刷新
    if (!patrolTriggered.current) {
      patrolTriggered.current = true
      apiGet('/agent/patrol')
        .then(() => {
          // 巡检完成，刷新数据
          // 重置防抖时间戳让 fetchInsights 能再次执行
          useAgentStore.setState({ lastFetchTime: 0 })
          fetchInsights()
          fetchBadge()
        })
        .catch(() => {})
    }

    // 每 5 分钟重新巡检
    const timer = setInterval(() => {
      apiGet('/agent/patrol')
        .then(() => {
          useAgentStore.setState({ lastFetchTime: 0 })
          fetchInsights()
          fetchBadge()
        })
        .catch(() => {})
    }, 5 * 60_000)

    return () => clearInterval(timer)
  }, [fetchInsights, fetchBadge])

  const latestPatrol = insights.find(i => i.insight_type === 'patrol_summary')
  const unreadAnomalies = insights.filter(
    i => i.insight_type === 'anomaly' && !i.acknowledged && !i.dismissed
  )

  return { latestPatrol, unreadAnomalies, badge, loading, insights }
}
