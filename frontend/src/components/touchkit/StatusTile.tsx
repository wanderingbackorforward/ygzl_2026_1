import React from 'react'

export type TileTone = 'danger' | 'warning' | 'normal' | 'info' | 'muted'

interface StatusTileProps {
  label: string
  /** 大号主数值 */
  value: React.ReactNode
  tone?: TileTone
  /** 副文本（单位、说明） */
  sub?: React.ReactNode
  icon?: string
  onClick?: () => void
  /** 右上角徽标（如趋势箭头） */
  badge?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
}

const TONE_TEXT: Record<TileTone, string> = {
  danger: '#ff8b9a',
  warning: '#ffc24d',
  normal: '#7dff9d',
  info: '#7df0ff',
  muted: '#cfd8e3',
}

/**
 * 大号状态色块（控制室/壁挂档）。
 * 左侧状态色条 + 标签 + 大号 KPI 数值 —— 远观一眼可读。
 * 点击则进入全屏细节（由父级接 FullscreenFocus）。
 */
export const StatusTile: React.FC<StatusTileProps> = ({
  label,
  value,
  tone = 'info',
  sub,
  icon,
  onClick,
  badge,
  children,
  style,
}) => {
  const clickable = !!onClick
  return (
    <div
      className={`touchkit-tile ${clickable ? 'touchkit-tile--clickable' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      style={{ minHeight: 'var(--wall-min-target)', ...style }}
    >
      <span className={`touchkit-tile__bar touchkit-tile__bar--${tone}`} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="touchkit-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon && <i className={icon} style={{ fontSize: 20, opacity: 0.85 }} />}
          {label}
        </div>
        {badge}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <span className="touchkit-kpi" style={{ color: tone === 'muted' ? '#fff' : TONE_TEXT[tone] }}>{value}</span>
        {sub && <span style={{ fontSize: 15, color: 'rgba(230,247,255,0.65)' }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

export default StatusTile
