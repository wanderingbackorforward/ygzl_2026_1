import React, { useEffect, useRef, useState } from 'react'

/** hex → rgba（模拟 DataV 的 fade(color, percent)，percent 为 alpha 0-100） */
function fade(hex: string, percent: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${percent / 100})`
}

/**
 * DataV Decoration11 忠实移植：六边科技标题板。
 * 四角小六边形 + 中央六边形主体 + 两侧斜线，包裹标题文本。
 */
interface Decoration11Props {
  children: React.ReactNode
  color?: [string, string]
  style?: React.CSSProperties
}

export const Decoration11: React.FC<Decoration11Props> = ({ children, color = ['#1dc1f5', '#1dc1f5'], style }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 120, ...style }}>
      {w > 0 && h > 0 && (
        <svg style={{ position: 'absolute', inset: 0, display: 'block' }} width={w} height={h}>
          <polygon fill={fade(color[1], 10)} stroke={color[1]} points={`20 10, 25 4, 55 4 60 10`} />
          <polygon fill={fade(color[1], 10)} stroke={color[1]} points={`20 ${h - 10}, 25 ${h - 4}, 55 ${h - 4} 60 ${h - 10}`} />
          <polygon fill={fade(color[1], 10)} stroke={color[1]} points={`${w - 20} 10, ${w - 25} 4, ${w - 55} 4 ${w - 60} 10`} />
          <polygon fill={fade(color[1], 10)} stroke={color[1]} points={`${w - 20} ${h - 10}, ${w - 25} ${h - 4}, ${w - 55} ${h - 4} ${w - 60} ${h - 10}`} />
          <polygon
            fill={fade(color[0], 20)}
            stroke={color[0]}
            points={`20 10, 5 ${h / 2} 20 ${h - 10} ${w - 20} ${h - 10} ${w - 5} ${h / 2} ${w - 20} 10`}
          />
          <polyline fill="transparent" stroke={fade(color[0], 70)} points={`25 18, 15 ${h / 2} 25 ${h - 18}`} />
          <polyline fill="transparent" stroke={fade(color[0], 70)} points={`${w - 25} 18, ${w - 15} ${h / 2} ${w - 25} ${h - 18}`} />
        </svg>
      )}
      <div style={{ position: 'relative', padding: '6px 28px', fontWeight: 600, letterSpacing: 2, color: '#eafcff', textShadow: '0 0 8px rgba(0,229,255,0.6)', whiteSpace: 'nowrap' }}>
        {children}
      </div>
    </div>
  )
}

export default Decoration11
