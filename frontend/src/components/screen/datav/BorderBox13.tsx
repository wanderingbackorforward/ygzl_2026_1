import React, { useEffect, useRef, useState } from 'react'

/**
 * DataV BorderBox13 忠实移植（来自 @jiaminghi/data-view 源码）。
 * 切角霓虹面板边框：主体切角路径 + 顶部虚线流动装饰 + 左上/右下双色角线。
 * 自动 ResizeObserver 适配宽高。
 */
interface BorderBox13Props {
  color?: [string, string]
  backgroundColor?: string
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** 内容内边距 */
  padding?: number | string
}

export const BorderBox13: React.FC<BorderBox13Props> = ({
  color = ['#2cf7fe', '#1dc1f5'],
  backgroundColor = 'rgba(8, 16, 28, 0.55)',
  children,
  className,
  style,
  padding = 14,
}) => {
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
    <div ref={ref} className={className} style={{ position: 'relative', boxSizing: 'border-box', ...style }}>
      {w > 0 && h > 0 && (
        <svg
          style={{ position: 'absolute', inset: 0, display: 'block' }}
          width={w}
          height={h}
        >
          <path
            fill={backgroundColor}
            stroke={color[0]}
            strokeWidth={1}
            d={`M 5 20 L 5 10 L 12 3 L 60 3 L 68 10 L ${w - 20} 10 L ${w - 5} 25 L ${w - 5} ${h - 5} L 20 ${h - 5} L 5 ${h - 20} L 5 20`}
          />
          {/* 顶部虚线流动装饰 */}
          <path
            fill="transparent"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="10, 5"
            stroke={color[0]}
            d="M 16 9 L 61 9"
            className="dv-dash-flow"
          />
          {/* 左上双色角线 */}
          <path fill="transparent" stroke={color[1]} d="M 5 20 L 5 10 L 12 3 L 60 3 L 68 10" />
          {/* 右下双色角线 */}
          <path fill="transparent" stroke={color[1]} d={`M ${w - 5} ${h - 30} L ${w - 5} ${h - 5} L ${w - 30} ${h - 5}`} />
        </svg>
      )}
      <div style={{ position: 'relative', padding, height: '100%', boxSizing: 'border-box' }}>{children}</div>
    </div>
  )
}

export default BorderBox13
