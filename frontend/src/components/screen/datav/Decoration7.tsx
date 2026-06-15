import React from 'react'

/**
 * DataV Decoration7 忠实移植：标题两侧的科技箭头（▶ 文本 ◀）。
 */
interface Decoration7Props {
  color?: [string, string]
  reverse?: boolean
  style?: React.CSSProperties
}

export const Decoration7: React.FC<Decoration7Props> = ({ color = ['#1dc1f5', '#1dc1f5'], reverse, style }) => {
  const left = (
    <svg width="21" height="20" style={{ display: 'block' }}>
      <polyline strokeWidth={4} fill="transparent" stroke={color[0]} points="10, 0 19, 10 10, 20" />
      <polyline strokeWidth={2} fill="transparent" stroke={color[1]} points="2, 0 11, 10 2, 20" />
    </svg>
  )
  const right = (
    <svg width="21" height="20" style={{ display: 'block' }}>
      <polyline strokeWidth={4} fill="transparent" stroke={color[0]} points="11, 0 2, 10 11, 20" />
      <polyline strokeWidth={2} fill="transparent" stroke={color[1]} points="19, 0 10, 10 19, 20" />
    </svg>
  )
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, ...style }}>
      {reverse ? right : left}
      {reverse ? left : right}
    </div>
  )
}

export default Decoration7
