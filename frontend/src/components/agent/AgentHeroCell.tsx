import React, { useState, useRef, useEffect } from 'react'
import { useAgent } from '../../hooks/useAgent'
import { AgentDropdown } from './AgentDropdown'

/**
 * Agent 状态格 — 替换 HeroBar 第一格"系统健康度"
 * 三种状态：正常（安静）、关注（黄色）、严重（红色脉冲）
 */
export function AgentHeroCell() {
  const { latestPatrol, unreadAnomalies, loading } = useAgent()
  const [open, setOpen] = useState(false)
  const cellRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭 dropdown
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // 状态判断
  const hasAnomalies = unreadAnomalies.length > 0
  const maxSeverity = unreadAnomalies.some(i => i.severity === 'critical')
    ? 'critical'
    : hasAnomalies ? 'warning' : 'info'

  // 标题和信任锚
  const headline = latestPatrol?.title || (loading ? '加载中...' : '巡检服务初始化中')
  const trustAnchor = latestPatrol?.body || ''

  // 颜色
  const colors = {
    info: { icon: '#34d399', border: 'transparent', text: 'rgba(255,255,255,0.5)' },
    warning: { icon: '#fbbf24', border: '#fbbf24', text: '#fbbf24' },
    critical: { icon: '#f87171', border: '#f87171', text: '#f87171' },
  }
  const c = colors[maxSeverity]

  // 图标
  const icon = maxSeverity === 'info' ? '\u2713' : '\u26A0'

  return (
    <div ref={cellRef} style={{ position: 'relative' }}>
      <div
        onClick={() => hasAnomalies && setOpen(!open)}
        style={{
          cursor: hasAnomalies ? 'pointer' : 'default',
          borderLeft: `2px solid ${c.border}`,
          padding: '4px 12px',
          transition: 'all 0.2s',
        }}
      >
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: maxSeverity === 'info' ? 'rgba(255,255,255,0.85)' : c.text,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ color: c.icon, fontSize: 14 }}>{icon}</span>
          {hasAnomalies
            ? `${unreadAnomalies.length}项需${maxSeverity === 'critical' ? '立即处理' : '关注'}`
            : headline
          }
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 2,
        }}>
          {trustAnchor}
        </div>
      </div>

      {open && hasAnomalies && (
        <AgentDropdown
          anomalies={unreadAnomalies}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
