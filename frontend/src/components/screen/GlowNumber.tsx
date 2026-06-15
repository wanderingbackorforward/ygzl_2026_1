import React, { useEffect, useRef, useState } from 'react'

export type GlowTone = 'info' | 'danger' | 'warning' | 'normal'

interface GlowNumberProps {
  value: number
  tone?: GlowTone
  unit?: string
  /** 滚动动画时长 ms，0=不动画 */
  duration?: number
  label?: string
  style?: React.CSSProperties
}

/**
 * 大屏发光大数字：Rajdhani 巨号 + 文字辉光 + 数值变化时缓动滚动（翻牌观感）。
 */
const GlowNumber: React.FC<GlowNumberProps> = ({ value, tone = 'info', unit, duration = 700, label, style }) => {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!duration) { setDisplay(value); return }
    const from = fromRef.current
    const to = value
    if (from === to) return
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(from + (to - from) * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  const shown = Math.round(display)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && <div style={{ fontSize: 14, color: 'rgba(215,244,255,0.7)', letterSpacing: 1 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className={`dt-kpi dt-kpi--${tone}`}>{shown.toLocaleString('zh-CN')}</span>
        {unit && <span style={{ fontSize: 16, color: 'rgba(215,244,255,0.6)' }}>{unit}</span>}
      </div>
    </div>
  )
}

export default GlowNumber
