import React, { useEffect, useRef, useState } from 'react'

function polyLen(pts: number[][]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) {
    l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  }
  return l
}
const toStr = (pts: number[][]) => pts.map(p => p.join(',')).join(' ')

/**
 * DataV Decoration5 忠实移植：标题下方科技折线（描边动画）。
 * 两条折线，stroke-dasharray 动画呈现“绘制”效果。
 */
interface Decoration5Props {
  color?: [string, string]
  dur?: number
  height?: number
  style?: React.CSSProperties
}

export const Decoration5: React.FC<Decoration5Props> = ({ color = ['#1dc1f5', '#1dc1f5'], dur = 1.2, height = 40, style }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const h = height

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const line1 = w > 0 ? [
    [0, h * 0.2], [w * 0.18, h * 0.2], [w * 0.2, h * 0.4], [w * 0.25, h * 0.4],
    [w * 0.27, h * 0.6], [w * 0.72, h * 0.6], [w * 0.75, h * 0.4],
    [w * 0.8, h * 0.4], [w * 0.82, h * 0.2], [w, h * 0.2],
  ] : []
  const line2 = w > 0 ? [[w * 0.3, h * 0.8], [w * 0.7, h * 0.8]] : []
  const l1 = polyLen(line1)
  const l2 = polyLen(line2)

  return (
    <div ref={ref} style={{ width: '100%', height: h, ...style }}>
      {w > 0 && (
        <svg width={w} height={h} style={{ display: 'block' }}>
          <polyline fill="transparent" stroke={color[0]} strokeWidth={3} points={toStr(line1)}>
            <animate attributeName="stroke-dasharray" attributeType="XML" from={`0, ${l1 / 2}, 0, ${l1 / 2}`} to={`0, 0, ${l1}, 0`} dur={`${dur}s`} begin="0s" calcMode="spline" keyTimes="0;1" keySplines="0.4,1,0.49,0.98" repeatCount="indefinite" />
          </polyline>
          <polyline fill="transparent" stroke={color[1]} strokeWidth={2} points={toStr(line2)}>
            <animate attributeName="stroke-dasharray" attributeType="XML" from={`0, ${l2 / 2}, 0, ${l2 / 2}`} to={`0, 0, ${l2}, 0`} dur={`${dur}s`} begin="0s" calcMode="spline" keyTimes="0;1" keySplines=".4,1,.49,.98" repeatCount="indefinite" />
          </polyline>
        </svg>
      )}
    </div>
  )
}

export default Decoration5
