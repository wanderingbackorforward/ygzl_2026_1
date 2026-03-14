/**
 * Hero PPV 组件
 * 72px 动态变色数字 + 呼吸动画 + 安全状态指示器
 * 乔布斯原则：1秒决策，视觉冲击力
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { SafetyLevel } from '@/utils/vibration/types'

interface HeroPPVProps {
  ppv: number
  level: SafetyLevel
  score: number
  alertCount: number
  exceedRatio: number
}

export const HeroPPV: React.FC<HeroPPVProps> = ({
  ppv,
  level,
  score,
  alertCount,
  exceedRatio
}) => {
  // 状态配置
  const statusConfig = {
    safe: {
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      icon: '🛡️',
      label: '安全运行',
      animation: ''
    },
    caution: {
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      icon: '⚠️',
      label: '注意监测',
      animation: 'animate-pulse'  // 黄色脉动
    },
    danger: {
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      icon: '🛑',
      label: '立即停工',
      animation: 'animate-ping'  // 红色呼吸
    }
  }

  const config = statusConfig[level]

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      {/* Hero PPV 数字 */}
      <div className="relative">
        {/* 呼吸动画背景（仅危险时显示） */}
        {level === 'danger' && (
          <div className="absolute inset-0 -m-8 bg-red-500/20 rounded-full animate-ping" />
        )}

        {/* 主数字 */}
        <div className={cn(
          'text-7xl font-bold transition-all duration-500 relative z-10',
          config.color,
          config.animation
        )}>
          {ppv.toFixed(2)}
          <span className="text-3xl ml-2 text-slate-300">mm/s</span>
        </div>
      </div>

      {/* 安全状态指示器 */}
      <div className={cn(
        'flex items-center gap-3 px-6 py-2 rounded-full text-lg font-semibold transition-all duration-300',
        config.bgColor,
        config.color
      )}>
        <span className="text-2xl">{config.icon}</span>
        <span>{config.label}</span>
      </div>

      {/* 内联徽章（评分/报警/超限率） */}
      <div className="flex items-center gap-6 text-sm text-slate-200">
        {/* 安全评分 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">安全评分</span>
          <span className={cn(
            'font-bold text-lg',
            score >= 80 && 'text-green-400',
            score >= 60 && score < 80 && 'text-yellow-400',
            score < 60 && 'text-red-400'
          )}>
            {score}
          </span>
        </div>

        {/* 分隔符 */}
        <div className="w-px h-4 bg-slate-600" />

        {/* 报警次数 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">报警</span>
          <span className={cn(
            'font-bold text-lg',
            alertCount === 0 && 'text-green-400',
            alertCount > 0 && alertCount <= 3 && 'text-yellow-400',
            alertCount > 3 && 'text-red-400'
          )}>
            {alertCount}
          </span>
        </div>

        {/* 分隔符 */}
        <div className="w-px h-4 bg-slate-600" />

        {/* 超限率 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">超限率</span>
          <span className={cn(
            'font-bold text-lg',
            exceedRatio <= 2 && 'text-green-400',
            exceedRatio > 2 && exceedRatio <= 5 && 'text-yellow-400',
            exceedRatio > 5 && 'text-red-400'
          )}>
            {exceedRatio.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}
