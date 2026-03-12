import React, { useMemo } from 'react'
import type { Conversation } from './types'

interface StatisticsPanelProps {
  conversations: Conversation[]
}

export default function StatisticsPanel({ conversations }: StatisticsPanelProps) {
  // 计算统计数据
  const stats = useMemo(() => {
    const totalConversations = conversations.length
    const totalMessages = conversations.reduce((sum, conv) => sum + (conv.messageCount || 0), 0)

    // 按角色分组
    const roleStats = conversations.reduce((acc, conv) => {
      acc[conv.role] = (acc[conv.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // 今天的对话数
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayConversations = conversations.filter(conv => {
      const convDate = new Date(conv.createdAt)
      return convDate >= today
    }).length

    // 本周的对话数
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekConversations = conversations.filter(conv => {
      const convDate = new Date(conv.createdAt)
      return convDate >= weekAgo
    }).length

    return {
      totalConversations,
      totalMessages,
      roleStats,
      todayConversations,
      weekConversations,
      avgMessagesPerConv: totalConversations > 0 ? (totalMessages / totalConversations).toFixed(1) : '0'
    }
  }, [conversations])

  const roleConfig = {
    researcher: { label: '科研人员', icon: '🔬', color: '#8b5cf6' },
    worker: { label: '施工人员', icon: '👷', color: '#f59e0b' },
    reporter: { label: '项目汇报', icon: '📈', color: '#10b981' },
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white">使用统计</h3>
        <p className="mt-1 text-sm text-slate-300">对话数据概览</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* 总体统计 */}
        <div className="mb-4">
          <h4 className="mb-3 text-base font-bold text-white">总体数据</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-500 bg-slate-800 p-4">
              <div className="text-3xl font-bold text-cyan-400">{stats.totalConversations}</div>
              <div className="mt-1 text-sm font-medium text-slate-200">总对话数</div>
            </div>
            <div className="rounded-xl border border-slate-500 bg-slate-800 p-4">
              <div className="text-3xl font-bold text-cyan-400">{stats.totalMessages}</div>
              <div className="mt-1 text-sm font-medium text-slate-200">总消息数</div>
            </div>
            <div className="rounded-xl border border-slate-500 bg-slate-800 p-4">
              <div className="text-3xl font-bold text-cyan-400">{stats.todayConversations}</div>
              <div className="mt-1 text-sm font-medium text-slate-200">今日对话</div>
            </div>
            <div className="rounded-xl border border-slate-500 bg-slate-800 p-4">
              <div className="text-3xl font-bold text-cyan-400">{stats.avgMessagesPerConv}</div>
              <div className="mt-1 text-sm font-medium text-slate-200">平均消息数</div>
            </div>
          </div>
        </div>

        {/* 时间统计 */}
        <div className="mb-4">
          <h4 className="mb-3 text-base font-bold text-white">时间分布</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-500 bg-slate-800 p-4">
              <span className="text-base text-white">今天</span>
              <span className="text-xl font-bold text-cyan-400">{stats.todayConversations}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-500 bg-slate-800 p-4">
              <span className="text-base text-white">最近7天</span>
              <span className="text-xl font-bold text-cyan-400">{stats.weekConversations}</span>
            </div>
          </div>
        </div>

        {/* 角色分布 */}
        <div>
          <h4 className="mb-3 text-base font-bold text-white">角色分布</h4>
          <div className="space-y-2">
            {Object.entries(roleConfig).map(([role, config]) => {
              const count = stats.roleStats[role] || 0
              const percentage = stats.totalConversations > 0
                ? ((count / stats.totalConversations) * 100).toFixed(0)
                : '0'

              return (
                <div
                  key={role}
                  className="rounded-xl border border-slate-500 bg-slate-800 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{config.icon}</span>
                      <span className="text-base font-medium text-white">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-cyan-400">{count}</span>
                      <span className="text-sm text-slate-300">({percentage}%)</span>
                    </div>
                  </div>
                  {/* 进度条 */}
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-600">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: config.color
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 空状态 */}
        {stats.totalConversations === 0 && (
          <div className="py-8 text-center text-base text-slate-300">
            暂无对话数据
          </div>
        )}
      </div>
    </div>
  )
}
