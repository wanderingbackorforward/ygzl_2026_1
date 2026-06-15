import React from 'react'

interface AlertTickerProps {
  items: string[]
  /** 前缀图标 class */
  icon?: string
  tone?: 'info' | 'danger' | 'warning' | 'normal'
  speed?: number
}

const TONE_COLOR: Record<NonNullable<AlertTickerProps['tone']>, string> = {
  info: '#7df0ff',
  danger: '#ff5c7a',
  warning: '#ffc24d',
  normal: '#6dff9e',
}

/**
 * 大屏滚动告警条（跑马灯）。
 */
const AlertTicker: React.FC<AlertTickerProps> = ({ items, icon = 'fas fa-satellite-dish', tone = 'info', speed = 22 }) => {
  const color = TONE_COLOR[tone]
  const text = items.length ? items.join('        ◆        ') : '系统正常运行中，暂无预警'
  // 重复两遍以保证滚动连贯
  const loop = `${text}        ◆        ${text}`

  return (
    <div
      className="dt-panel"
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, flexShrink: 0, fontWeight: 600, letterSpacing: 1 }}>
        <i className={icon} style={{ fontSize: 16 }} />
        <span>实时播报</span>
      </div>
      <div className="dt-marquee" style={{ flex: 1, color: 'rgba(215,244,255,0.85)', fontSize: 14 }}>
        <span className="dt-marquee__track" style={{ animationDuration: `${speed}s` }}>{loop}</span>
      </div>
    </div>
  )
}

export default AlertTicker
