/**
 * 通道概览列表组件
 * 紧凑行布局：PPV + 主频 + 状态图标
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { ChannelInfo, AlertLevel } from '@/utils/vibration/types'

interface ChannelListProps {
  channels: ChannelInfo[]
  selectedChannelId: number | null
  onChannelClick: (channelId: number) => void
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  selectedChannelId,
  onChannelClick
}) => {
  // 状态图标配置
  const getStatusIcon = (level: AlertLevel) => {
    switch (level) {
      case 'safe':
        return { icon: '✓', color: 'text-green-400', bg: 'bg-green-500/20' }
      case 'warn':
        return { icon: '~', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
      case 'alert':
        return { icon: '!', color: 'text-orange-400', bg: 'bg-orange-500/20' }
      case 'stop':
        return { icon: '✕', color: 'text-red-500', bg: 'bg-red-500/20' }
    }
  }

  return (
    <div className="space-y-2">
      {channels.map((channel) => {
        const statusConfig = getStatusIcon(channel.alertLevel)
        const isSelected = selectedChannelId === channel.channelId

        return (
          <button
            key={channel.channelId}
            onClick={() => onChannelClick(channel.channelId)}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-left transition-all',
              isSelected
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600 hover:bg-slate-750'
            )}
          >
            <div className="flex items-center justify-between">
              {/* 左侧：通道号 */}
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-sm font-semibold',
                  isSelected ? 'text-cyan-400' : 'text-white'
                )}>
                  CH{channel.channelId}
                </span>

                {/* 状态图标 */}
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  statusConfig.bg,
                  statusConfig.color
                )}>
                  {statusConfig.icon}
                </div>
              </div>

              {/* 右侧：PPV + 主频 */}
              <div className="flex items-center gap-4 text-xs">
                {/* PPV */}
                <div className="text-right">
                  <div className={cn(
                    'font-bold',
                    channel.alertLevel === 'safe' && 'text-green-400',
                    channel.alertLevel === 'warn' && 'text-yellow-400',
                    channel.alertLevel === 'alert' && 'text-orange-400',
                    channel.alertLevel === 'stop' && 'text-red-500'
                  )}>
                    {channel.ppv.toFixed(1)}
                  </div>
                  <div className="text-slate-400">mm/s</div>
                </div>

                {/* 主频 */}
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {channel.dominantFreq.toFixed(0)}
                  </div>
                  <div className="text-slate-400">Hz</div>
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
