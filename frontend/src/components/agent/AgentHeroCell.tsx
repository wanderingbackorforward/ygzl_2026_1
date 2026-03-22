import React, { useState, useRef, useEffect } from 'react'
import { useAgent } from '../../hooks/useAgent'
import { AgentDropdown } from './AgentDropdown'

/**
 * Agent 主状态格 — HeroBar 左侧主位
 * 三种状态：正常（绿色呼吸）、关注（橙黄脉冲）、严重（红色脉冲+闪烁）
 * 人格：沉默寡言的老工程师
 */
export function AgentHeroCell() {
  const { latestPatrol, unreadAnomalies, loading } = useAgent()
  const [open, setOpen] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const cellRef = useRef<HTMLDivElement>(null)

  // 5秒超时降级
  useEffect(() => {
    if (!loading && latestPatrol) return
    const timer = setTimeout(() => setTimedOut(true), 5000)
    return () => clearTimeout(timer)
  }, [loading, latestPatrol])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // 按点位去重（前端层面，取每个 point_id 最严重的一条）
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

  // 老工程师语气的标题
  const headline = hasAnomalies
    ? (maxSeverity === 'critical'
      ? `${dedupedAnomalies.length}个点有问题，需要处理`
      : `${dedupedAnomalies.length}个点需要留意`)
    : (latestPatrol?.title || (timedOut ? '一切正常' : (loading ? '正在巡检...' : '正在巡检...')))

  const trustAnchor = latestPatrol?.body || (timedOut ? '数据暂不可用' : '')

  // 颜色和动画
  const config = {
    info:     { color: '#34d399', glow: 'rgba(52,211,153,0.15)', icon: '\u2713', pulse: false },
    warning:  { color: '#fbbf24', glow: 'rgba(251,191,36,0.12)', icon: '\u26A0', pulse: true },
    critical: { color: '#f87171', glow: 'rgba(248,113,113,0.18)', icon: '\u26A0', pulse: true },
  }
  const c = config[maxSeverity]

  // 注入脉冲动画 CSS
  useEffect(() => {
    if (document.getElementById('agent-pulse-style')) return
    const style = document.createElement('style')
    style.id = 'agent-pulse-style'
    style.textContent = `
      @keyframes agent-pulse {
        0% { box-shadow: 0 0 0 0 var(--agent-glow); }
        70% { box-shadow: 0 0 0 6px transparent; }
        100% { box-shadow: 0 0 0 0 transparent; }
      }
      @keyframes agent-breathe {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div ref={cellRef} style={{ position: 'relative' }}>
      <div
        onClick={() => hasAnomalies && setOpen(!open)}
        style={{
          cursor: hasAnomalies ? 'pointer' : 'default',
          padding: '6px 10px',
          borderRadius: 6,
          background: c.glow,
          transition: 'all 0.3s ease',
          ...(c.pulse ? {
            animation: 'agent-pulse 2s infinite',
            ['--agent-glow' as any]: c.glow,
          } : {}),
        }}
      >
        {/* 状态指示器 + 标题 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* 状态圆点 */}
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: c.color,
            flexShrink: 0,
            animation: c.pulse ? 'agent-breathe 2s ease-in-out infinite' : 'none',
            boxShadow: `0 0 6px ${c.color}`,
          }} />
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'white',
            letterSpacing: 0.5,
          }}>
            {headline}
          </span>
          {hasAnomalies && (
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
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
            color: 'rgba(255,255,255,0.45)',
            marginTop: 3,
            paddingLeft: 18,
          }}>
            {trustAnchor}
          </div>
        )}
      </div>

      {open && hasAnomalies && (
        <AgentDropdown
          anomalies={dedupedAnomalies}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
