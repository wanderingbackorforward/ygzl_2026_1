import React, { useEffect, useState } from 'react'
import { Decoration5 } from './datav/Decoration5'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  /** 左侧状态徽标文本 */
  status?: string
  /** 右侧额外内容（默认渲染实时时钟） */
  right?: React.ReactNode
}

/**
 * 大屏顶部标题栏：居中霓虹标题 + 两侧流线装饰 + 右侧实时时钟/日期。
 */
const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, status, right }) => {
  const [now, setNow] = useState<Date>(() => new Date(0))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = mounted ? now.toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--'
  const date = mounted ? now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }) : ''

  return (
    <div
      className="dt-panel"
      style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 24px', flexShrink: 0 }}
    >
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#7df0ff', fontSize: 14, whiteSpace: 'nowrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px #00e676' }} />
          {status}
        </div>
      )}
      <div className="dt-flourish dt-flourish--left" />
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div className="dt-screen-title">{title}</div>
        <div style={{ width: 240, maxWidth: '40vw', margin: '2px auto 0' }}>
          <Decoration5 height={26} dur={1.6} />
        </div>
        {subtitle && <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.6)', letterSpacing: 3, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div className="dt-flourish dt-flourish--right" />
      <div style={{ flex: status ? 0 : 1 }} />
      {right !== undefined ? right : (
        <div className="dt-clock" style={{ textAlign: 'right', lineHeight: 1.2 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{time}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{date}</div>
        </div>
      )}
    </div>
  )
}

export default ScreenHeader
