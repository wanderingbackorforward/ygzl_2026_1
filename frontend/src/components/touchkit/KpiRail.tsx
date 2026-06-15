import React from 'react'

interface KpiRailProps {
  /** 标题（如「风险概览」） */
  title?: React.ReactNode
  children: React.ReactNode
  /** 底部额外区域（如高风险点列表） */
  footer?: React.ReactNode
}

/**
 * 大屏 KPI 竖条容器：把若干 StatusTile / 列表竖向排布。
 * 替换桌面档里塞满小图的 320px 侧栏。
 */
export const KpiRail: React.FC<KpiRailProps> = ({ title, children, footer }) => {
  return (
    <div
      style={{
        width: 'clamp(280px, 30%, 420px)',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(8, 14, 24, 0.6)',
        borderLeft: '1px solid var(--wall-panel-border)',
        padding: 'var(--wall-gap)',
        gap: 'var(--wall-gap)',
      }}
    >
      {title && (
        <div style={{ fontSize: 'var(--wall-font-lg)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--wall-gap)', flexShrink: 0 }}>
        {children}
      </div>
      {footer && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {footer}
        </div>
      )}
    </div>
  )
}

export default KpiRail
