/**
 * 施工建议卡片组件
 * 图标 + 单句话 + 颜色编码
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { ConstructionAdvice } from '@/utils/vibration/types'

interface ConstructionAdviceCardProps {
  advice: ConstructionAdvice
}

export const ConstructionAdviceCard: React.FC<ConstructionAdviceCardProps> = ({
  advice
}) => {
  return (
    <div className="space-y-4">
      {/* 主建议 */}
      <div className={cn(
        'flex items-center gap-4 rounded-lg border p-4',
        advice.level === 'safe' && 'border-green-500/30 bg-green-500/10',
        advice.level === 'warn' && 'border-yellow-500/30 bg-yellow-500/10',
        advice.level === 'alert' && 'border-orange-500/30 bg-orange-500/10',
        advice.level === 'stop' && 'border-red-500/30 bg-red-500/10'
      )}>
        {/* 图标 */}
        <div className="text-5xl">
          {advice.icon}
        </div>

        {/* 文字 */}
        <div className="flex-1">
          <div className={cn(
            'text-xl font-bold',
            advice.color
          )}>
            {advice.message}
          </div>
          {advice.level !== 'safe' && (
            <div className="mt-1 text-sm text-slate-300">
              建议采取以下措施
            </div>
          )}
        </div>
      </div>

      {/* 具体措施 */}
      {advice.actions.length > 0 && (
        <div className="space-y-2">
          {advice.actions.map((action, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3"
            >
              <span className="text-cyan-400 font-bold">→</span>
              <span className="flex-1 text-sm text-white">{action}</span>
            </div>
          ))}
        </div>
      )}

      {/* GB 规范提示 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
        <div className="flex items-start gap-2 text-xs text-slate-300">
          <span className="text-cyan-400">ℹ</span>
          <div>
            <div className="font-semibold text-cyan-400 mb-1">GB 6722-2014 规范</div>
            <div className="leading-relaxed">
              {advice.level === 'safe' && '振动水平在安全范围内，继续保持常规监测频次。'}
              {advice.level === 'warn' && '振动水平接近预警阈值，建议降低爆破参数并加密监测频次。'}
              {advice.level === 'alert' && '振动水平超过报警阈值，必须暂停爆破作业并检查周围建筑。'}
              {advice.level === 'stop' && '振动水平超过停工阈值，必须立即停工并启动应急评审程序。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
