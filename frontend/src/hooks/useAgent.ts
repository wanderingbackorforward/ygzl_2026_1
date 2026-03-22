import { useEffect } from 'react'
import { useAgentStore } from '../stores/agentStore'
import { apiGet } from '../lib/api'

/**
 * Agent 数据拉取 hook。
 * 免费版无 Cron，改为：页面打开时触发一次巡检，再拉结果。
 */
export function useAgent() {
  const { fetchInsights, fetchBadge, insights, badge, loading } = useAgentStore()

  useEffect(() => {
    // 页面打开时触发一次巡检（替代 Vercel Cron）
    apiGet('/agent/patrol').catch(() => {})

    // 等巡检完成后拉结果（给后端 3 秒处理时间）
    const loadTimer = setTimeout(() => {
      fetchInsights()
      fetchBadge()
    }, 3000)

    // 每 5 分钟重新巡检一次（页面保持打开时）
    const patrolTimer = setInterval(() => {
      apiGet('/agent/patrol').catch(() => {})
      setTimeout(() => {
        fetchInsights()
        fetchBadge()
      }, 3000)
    }, 5 * 60_000)

    return () => {
      clearTimeout(loadTimer)
      clearInterval(patrolTimer)
    }
  }, [fetchInsights, fetchBadge])

  // 最新的巡检摘要
  const latestPatrol = insights.find(i => i.insight_type === 'patrol_summary')

  // 未读异常 insights
  const unreadAnomalies = insights.filter(
    i => i.insight_type === 'anomaly' && !i.acknowledged && !i.dismissed
  )

  return { latestPatrol, unreadAnomalies, badge, loading, insights }
}
