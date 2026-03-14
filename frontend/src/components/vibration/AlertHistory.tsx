/**
 * 报警记录列表组件
 * 最近10条记录，时间倒序
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { AlertRecord } from '@/utils/vibration/types'

interface AlertHistoryProps {
  alerts: AlertRecord[]
  maxCount?: number
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({
  alerts,
  maxCount = 10
}) => {
  // 取最近的记录
  const recentAlerts = alerts.slice(0, maxCount)

  // 格式化时间
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // 等级配置
  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'warn':
        return { color: 'text-yellow-400', icon: '~', label: '预警' }
      case 'alert':
        return { color: 'text-orange-400', icon: '!', label: '报警' }
      case 'stop':
        return { color: 'text-red-500', icon: '✕', label: '停工' }
      default:
        return { color: 'text-slate-400', icon: '·', label: '正常' }
    }
  }

  if (recentAlerts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-400">
        暂无报警记录
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {recentAlerts.map((alert) => {
        const config = getLevelConfig(alert.level)

        return (
          <div
            key={alert.id}
            className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs"
          >
            {/* 时间 */}
            <span className="font-mono text-slate-400">
              {formatTime(alert.timestamp)}
            </span>

            {/* 通道 */}
            <span className="font-semibold text-white">
              CH{alert.channelId}
            </span>

            {/* PPV */}
            <span className={cn('font-bold', config.color)}>
              {alert.ppv.toFixed(1)}
            </span>

            {/* 等级图标 */}
            <span className={cn('font-bold', config.color)}>
              {config.icon}
            </span>
          </div>
        )
      })}
    </div>
  )
}
