import React, { useState, useRef, useEffect } from 'react'
import { useAgent } from '../../hooks/useAgent'
import { AgentDropdown } from './AgentDropdown'

interface AgentHeroCellProps {
  onSelectPoint?: (pointId: string) => void
}

/**
 * Agent 主状态格 — HeroBar 左侧主位
 * 视觉隔离：深色背景+左侧彩色边条+脉冲动画
 * 人格：沉默寡言的老工程师
 */
export function AgentHeroCell({ onSelectPoint }: AgentHeroCellProps) {
  const { latestPatrol, unreadAnomalies, loading } = useAgent()
  const [open, setOpen] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const cellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && latestPatrol) return
    const timer = setTimeout(() => setTimedOut(true), 5000)
    return () => clearTimeout(timer)
  }, [loading, latestPatrol])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // 按点位去重
  const dedupedAnomalies = React.useMemo(() => {
    const map = new Map<string, typeof unreadAnomalies[0]>()
    const sevOrder: Record<string, number> = { critical: 2, warning: 1, info: 0 }
    for (const a of unreadAnomalies) {
      const pid = a.point_id || a.id
      const existing = map.get(pid)
      if (!existing || (sevOrder[a.severity] || 0) > (sevOrder[existing.severity] || 0)) {
        map.set(pid, a)
      }
    }
    return Array.from(map.values())
  }, [unreadAnomalies])

  const hasAnomalies = dedupedAnomalies.length > 0
  const maxSeverity = dedupedAnomalies.some(i => i.severity === 'critical')
    ? 'critical'
    : hasAnomalies ? 'warning' : 'info'

  // 老工程师语气
  const headline = hasAnomalies
    ? (maxSeverity === 'critical'
      ? `${dedupedAnomalies.length}个点需要处理`
      : `${dedupedAnomalies.length}个点需要留意`)
    : (latestPatrol?.title || (timedOut ? '一切正常' : '正在巡检...'))

  const trustAnchor = latestPatrol?.body || (timedOut ? '数据暂不可用' : '')

  const config = {
    info:     { color: '#34d399', border: '#34d399', glow: 'rgba(52,211,153,0.08)', pulse: false },
    warning:  { color: '#fbbf24', border: '#fbbf24', glow: 'rgba(251,191,36,0.06)', pulse: true },
    critical: { color: '#f87171', border: '#f87171', glow: 'rgba(248,113,113,0.08)', pulse: true },
  }
  const c = config[maxSeverity]

  useEffect(() => {
    if (document.getElementById('agent-pulse-style')) return
    const style = document.createElement('style')
    style.id = 'agent-pulse-style'
    style.textContent = `
      @keyframes agent-dot-pulse {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.3); }
      }
    `
    document.head.appendChild(style)
  }, [])

  const handlePointClick = (pointId: string) => {
    if (onSelectPoint) {
      onSelectPoint(pointId)
      setOpen(false)
    }
  }

  return (
    <div ref={cellRef} style={{ position: 'relative' }}>
      <div
        onClick={() => hasAnomalies && setOpen(!open)}
        style={{
          cursor: hasAnomalies ? 'pointer' : 'default',
          padding: '8px 14px',
          borderLeft: `3px solid ${c.border}`,
          background: c.glow,
          borderRadius: '0 6px 6px 0',
          transition: 'all 0.3s ease',
        }}
      >
        {/* 标题行 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* 脉冲圆点 */}
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: c.color,
            flexShrink: 0,
            boxShadow: `0 0 8px ${c.color}`,
            animation: c.pulse ? 'agent-dot-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'white',
          }}>
            {headline}
          </span>
          {hasAnomalies && (
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              marginLeft: 'auto',
            }}>
              {open ? '\u25B2' : '\u25BC'}
            </span>
          )}
        </div>

        {/* 信任锚 */}
        {trustAnchor && (
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 2,
            paddingLeft: 16,
          }}>
            {trustAnchor}
          </div>
        )}
      </div>

      {open && hasAnomalies && (
        <AgentDropdown
          anomalies={dedupedAnomalies}
          onClose={() => setOpen(false)}
          onSelectPoint={handlePointClick}
        />
      )}
    </div>
  )
}
