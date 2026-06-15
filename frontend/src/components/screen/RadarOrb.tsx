import React from 'react'

export interface RadarDot {
  /** 0..100 横向百分比（相对雷达圆） */
  x: number
  /** 0..100 纵向百分比 */
  y: number
  tone?: 'danger' | 'warning' | 'normal' | 'info'
}

interface RadarOrbProps {
  size?: number
  dots?: RadarDot[]
}

const TONE: Record<NonNullable<RadarDot['tone']>, string> = {
  danger: '#ff5c7a',
  warning: '#ffc24d',
  normal: '#6dff9e',
  info: '#7df0ff',
}

/**
 * 大屏装饰雷达：同心圆环 + 十字准线 + 旋转扫描扇 + 脉冲风险点。纯 CSS。
 */
const RadarOrb: React.FC<RadarOrbProps> = ({ size = 260, dots = [] }) => {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div className="dt-radar" style={{ width: '100%', height: '100%' }}>
        {dots.map((d, i) => (
          <span
            key={i}
            className="dt-radar__dot"
            style={{ left: `${d.x}%`, top: `${d.y}%`, background: TONE[d.tone ?? 'info'], color: TONE[d.tone ?? 'info'], animationDelay: `${(i % 5) * 0.3}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default RadarOrb
