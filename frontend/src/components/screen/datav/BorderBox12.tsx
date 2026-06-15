import React, { useEffect, useId, useRef, useState } from 'react'

function fade(hex: string, percent: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${percent / 100})`
}

/**
 * DataV BorderBox12 忠实移植：圆角面板 + 四角 SVG 辉光（feMorphology+blur+flood 动画）。
 * 比 BorderBox13 更“重”，适合 hero 面板。
 */
interface BorderBox12Props {
  color?: [string, string]
  backgroundColor?: string
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  padding?: number | string
}

export const BorderBox12: React.FC<BorderBox12Props> = ({
  color = ['#2cf7fe', '#1dc1f5'],
  backgroundColor = 'rgba(8, 16, 28, 0.55)',
  children,
  className,
  style,
  padding = 14,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const rawId = useId()
  const filterId = `bb12-${rawId.replace(/[:]/g, '')}`

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
  const c1 = fade(color[1], 70)
  const c2 = fade(color[1], 30)

  return (
    <div ref={ref} className={className} style={{ position: 'relative', boxSizing: 'border-box', ...style }}>
      {w > 0 && h > 0 && (
        <svg style={{ position: 'absolute', inset: 0, display: 'block' }} width={w} height={h}>
          <defs>
            <filter id={filterId} height="150%" width="150%" x="-25%" y="-25%">
              <feMorphology operator="dilate" radius="1" in="SourceAlpha" result="thicken" />
              <feGaussianBlur in="thicken" stdDeviation="2" result="blurred" />
              <feFlood result="glowColor">
                <animate attributeName="flood-color" values={`${c1};${c2};${c1}`} dur="3s" begin="0s" repeatCount="indefinite" />
              </feFlood>
              <feComposite in="glowColor" in2="blurred" operator="in" result="softGlowColored" />
              <feMerge>
                <feMergeNode in="softGlowColored" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            fill={backgroundColor}
            strokeWidth={2}
            stroke={color[0]}
            d={`M15 5 L ${w - 15} 5 Q ${w - 5} 5, ${w - 5} 15 L ${w - 5} ${h - 15} Q ${w - 5} ${h - 5}, ${w - 15} ${h - 5} L 15, ${h - 5} Q 5 ${h - 5} 5 ${h - 15} L 5 15 Q 5 5 15 5`}
          />
          <path strokeWidth={2} fill="transparent" strokeLinecap="round" filter={`url(#${filterId})`} stroke={color[1]} d="M 20 5 L 15 5 Q 5 5 5 15 L 5 20" />
          <path strokeWidth={2} fill="transparent" strokeLinecap="round" filter={`url(#${filterId})`} stroke={color[1]} d={`M ${w - 20} 5 L ${w - 15} 5 Q ${w - 5} 5 ${w - 5} 15 L ${w - 5} 20`} />
          <path strokeWidth={2} fill="transparent" strokeLinecap="round" filter={`url(#${filterId})`} stroke={color[1]} d={`M ${w - 20} ${h - 5} L ${w - 15} ${h - 5} Q ${w - 5} ${h - 5} ${w - 5} ${h - 15} L ${w - 5} ${h - 20}`} />
          <path strokeWidth={2} fill="transparent" strokeLinecap="round" filter={`url(#${filterId})`} stroke={color[1]} d={`M 20 ${h - 5} L 15 ${h - 5} Q 5 ${h - 5} 5 ${h - 15} L 5 ${h - 20}`} />
        </svg>
      )}
      <div style={{ position: 'relative', padding, height: '100%', boxSizing: 'border-box' }}>{children}</div>
    </div>
  )
}

export default BorderBox12
