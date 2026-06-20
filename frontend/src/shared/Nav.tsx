import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import { useAuth } from '../contexts/AuthContext'
import { useAgentStore } from '../stores/agentStore'
import type { AppModule } from '../types/modules'
import FullscreenModal from '../components/layout/FullscreenModal'

const IS_MOBILE = import.meta.env.VITE_MOBILE === 'true'

const MOBILE_TAB_KEYS = ['cover', 'settlement', 'temperature', 'cracks', 'overview']
const MOBILE_HIDDEN_KEYS = ['modules', 'three']
const COLLAPSE_KEY = 'nav-sidebar-expanded'

// 显示名覆盖 —— 无论后端返回什么,前端统一用通俗中文
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  insar: '卫星雷达',
  'shield-trajectory': '盾构掘进',
  advanced: '智能分析',
  overview: '数据总览',
}

// 导航分组 —— 项目经理直觉: 看现状 / 做分析 / 管工作
const NAV_GROUPS: { label: string; keys: string[] }[] = [
  { label: '实时监测', keys: ['settlement', 'temperature', 'cracks', 'vibration', 'insar'] },
  { label: '智能分析', keys: ['advanced', 'overview', 'three', 'shield-trajectory'] },
  { label: '运维管理', keys: ['tickets'] },
]

export default function Nav() {
  const { pathname } = useLocation()
  const { modules } = useModules()
  const { user, logout, isAuthEnabled } = useAuth()
  const [pending, setPending] = useState<AppModule | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const fetchBadge = useAgentStore(s => s.fetchBadge)
  const badge = useAgentStore(s => s.badge)
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    fetchBadge()
    const timer = setInterval(fetchBadge, 60_000)
    return () => clearInterval(timer)
  }, [fetchBadge])

  // 同步侧栏宽度到 CSS 变量，供内容区留白
  useEffect(() => {
    const w = expanded ? 220 : 76
    document.body.style.setProperty('--sidebar-w', `${w}px`)
  }, [expanded])

  const items = useMemo<AppModule[]>(() => {
    if (modules.length) return modules
    return [
      { module_key: 'cover', route_path: '/cover', display_name: '首页', icon_class: 'fas fa-home', sort_order: 10, status: 'developed' },
      { module_key: 'settlement', route_path: '/settlement', display_name: '沉降', icon_class: 'fas fa-chart-area', sort_order: 20, status: 'developed' },
      { module_key: 'temperature', route_path: '/temperature', display_name: '温度', icon_class: 'fas fa-temperature-half', sort_order: 30, status: 'developed' },
      { module_key: 'cracks', route_path: '/cracks', display_name: '裂缝', icon_class: 'fas fa-bug', sort_order: 40, status: 'developed' },
      { module_key: 'vibration', route_path: '/vibration', display_name: '振动', icon_class: 'fas fa-wave-square', sort_order: 50, status: 'developed' },
      { module_key: 'insar', route_path: '/insar', display_name: '卫星雷达', icon_class: 'fas fa-satellite', sort_order: 60, status: 'developed' },
      { module_key: 'advanced', route_path: '/advanced', display_name: '智能分析', icon_class: 'fas fa-microscope', sort_order: 65, status: 'developed' },
      { module_key: 'overview', route_path: '/overview', display_name: '数据总览', icon_class: 'fas fa-chart-line', sort_order: 70, status: 'developed' },
      { module_key: 'three', route_path: '/three', display_name: '三维模型', icon_class: 'fas fa-cubes', sort_order: 80, status: 'developed' },
      { module_key: 'tickets', route_path: '/tickets', display_name: '工单', icon_class: 'fas fa-ticket-simple', sort_order: 90, status: 'developed' },
      { module_key: 'shield-trajectory', route_path: '/shield-trajectory', display_name: '盾构掘进', icon_class: 'fas fa-route', sort_order: 95, status: 'developed' },
    ]
  }, [modules])

  /* ============ 手机：底部 Tab 栏 + 侧抽屉（不变） ============ */
  if (IS_MOBILE) {
    const tabItems = items.filter(m => MOBILE_TAB_KEYS.includes(m.module_key))
    const moreItems = items.filter(m => !MOBILE_TAB_KEYS.includes(m.module_key) && !MOBILE_HIDDEN_KEYS.includes(m.module_key))
    return (
      <>
        {moreOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex' }} onClick={() => setMoreOpen(false)}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,.5)' }} />
            <nav onClick={e => e.stopPropagation()} style={{ width: 220, background: '#0a1930', borderLeft: '1px solid rgba(64,174,255,.3)', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
              <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#8bb8e0', borderBottom: '1px solid rgba(64,174,255,.15)' }}>更多模块</div>
              {moreItems.map(m => (
                <Link key={m.module_key} to={m.route_path} onClick={() => setMoreOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: pathname === m.route_path ? '#40aeff' : '#b0cfee', background: pathname === m.route_path ? 'rgba(64,174,255,.12)' : 'transparent', textDecoration: 'none', fontSize: 14 }}>
                  {m.icon_class && <i className={m.icon_class} style={{ width: 20, textAlign: 'center' }} />}
                  <span>{m.display_name}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 800, background: 'rgba(10,25,47,.95)', borderTop: '1px solid rgba(64,174,255,.3)', display: 'flex', justifyContent: 'space-around', padding: '6px 0 env(safe-area-inset-bottom, 6px)' }}>
          {tabItems.map(m => {
            const active = pathname === m.route_path
            return (
              <Link key={m.module_key} to={m.route_path} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: active ? '#40aeff' : '#6b8db5', textDecoration: 'none', fontSize: 10, padding: '4px 8px', minWidth: 48 }}>
                {m.icon_class && <i className={m.icon_class} style={{ fontSize: 18 }} />}
                <span>{m.display_name}</span>
              </Link>
            )
          })}
          <button type="button" onClick={() => setMoreOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: moreOpen ? '#40aeff' : '#6b8db5', background: 'none', border: 'none', fontSize: 10, padding: '4px 8px', minWidth: 48, cursor: 'pointer' }}>
            <i className="fas fa-ellipsis-h" style={{ fontSize: 18 }} /><span>更多</span>
          </button>
        </nav>
      </>
    )
  }

  /* ============ Web（桌面/iPad/壁挂）：左侧 Master-Detail 边栏 ============ */
  const toggle = () => {
    setExpanded(prev => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  return (
    <>
      <aside
        className="dt-panel ipad-sidebar"
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: 'var(--sidebar-w, 76px)',
          zIndex: 500, display: 'flex', flexDirection: 'column',
          padding: '12px 0', overflow: 'hidden',
          transition: 'width 220ms cubic-bezier(.4,1,.49,.98)',
          borderRadius: 0, borderRight: '1px solid rgba(0,229,255,.3)', borderLeft: 'none',
        }}
      >
        {/* 顶部：展开/收起 + 标题 */}
        <button type="button" onClick={toggle}
          className="touchkit-icon-btn"
          style={{ margin: '0 12px 14px', minWidth: 52, minHeight: 52, justifyContent: expanded ? 'space-between' : 'center' }}
          title={expanded ? '收起' : '展开'} aria-label="切换侧栏">
          <i className={`fas fa-${expanded ? 'angle-double-left' : 'bars'}`} />
          {expanded && <span style={{ fontSize: 14 }}>收起</span>}
        </button>

        {/* 模块列表 —— 分组导航 */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          {(() => {
            // 应用显示名覆盖
            const itemsNamed = items.map(m => ({
              ...m,
              display_name: DISPLAY_NAME_OVERRIDES[m.module_key] || m.display_name,
            }))
            // 首页单独放顶部
            const coverItem = itemsNamed.find(m => m.module_key === 'cover')
            const restItems = itemsNamed.filter(m => m.module_key !== 'cover')
            // 按组分类
            const groupedKeys = NAV_GROUPS.flatMap(g => g.keys)
            const ungrouped = restItems.filter(m => !groupedKeys.includes(m.module_key))

            const renderItem = (m: AppModule) => {
              const active = pathname === m.route_path
              const isPending = m.status === 'pending'
              return (
                <Link
                  key={m.module_key}
                  to={m.route_path}
                  onClick={e => { if (isPending) { e.preventDefault(); setPending(m) } }}
                  title={m.display_name}
                  aria-label={m.display_name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    minHeight: 48, padding: expanded ? '0 14px' : '0', borderRadius: 12,
                    justifyContent: expanded ? 'flex-start' : 'center',
                    textDecoration: 'none', position: 'relative',
                    color: active ? '#fff' : '#9fc7e8',
                    background: active ? 'linear-gradient(90deg, rgba(0,229,255,.25), rgba(0,229,255,.06))' : 'transparent',
                    border: active ? '1px solid rgba(0,229,255,.5)' : '1px solid transparent',
                    boxShadow: active ? '0 0 14px rgba(0,229,255,.18)' : 'none',
                  }}
                >
                  {active && <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderRadius: 3, background: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }} />}
                  {m.icon_class && <i className={m.icon_class} style={{ fontSize: 19, minWidth: 20, textAlign: 'center', color: active ? '#7df0ff' : undefined }} />}
                  {expanded && <span style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.display_name}</span>}
                  {m.module_key === 'settlement' && badge.has_unread && !active && (
                    <span style={{ position: 'absolute', top: 10, right: expanded ? 12 : 8, width: 8, height: 8, borderRadius: '50%', background: badge.max_severity === 'critical' ? '#f87171' : '#fbbf24' }} />
                  )}
                </Link>
              )
            }

            return (
              <>
                {/* 首页 */}
                {coverItem && renderItem(coverItem)}

                {/* 分组 */}
                {NAV_GROUPS.map(group => {
                  const groupItems = group.keys
                    .map(key => restItems.find(m => m.module_key === key))
                    .filter(Boolean) as AppModule[]
                  if (groupItems.length === 0) return null
                  return (
                    <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {expanded ? (
                        <div style={{ fontSize: 10, color: 'rgba(100,200,255,.4)', padding: '10px 14px 4px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                          {group.label}
                        </div>
                      ) : (
                        <div style={{ height: 1, margin: '6px 8px', background: 'rgba(0,229,255,.12)' }} />
                      )}
                      {groupItems.map(renderItem)}
                    </div>
                  )
                })}

                {/* 未分组的项 */}
                {ungrouped.map(renderItem)}
              </>
            )
          })()}
        </nav>

        {/* 底部：用户/登出 */}
        {isAuthEnabled && user && (
          <div style={{ padding: '10px 12px 4px', borderTop: '1px solid rgba(0,229,255,.15)' }}>
            <button type="button" onClick={() => { if (window.confirm('确认退出登录？')) logout() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 52, padding: expanded ? '0 14px' : '0', justifyContent: expanded ? 'flex-start' : 'center', borderRadius: 12, background: 'rgba(100,255,218,.08)', border: '1px solid rgba(100,255,218,.25)', color: '#64ffda', fontSize: 15, cursor: 'pointer' }}
              title={`${user.displayName} · 退出`}>
              <i className="fas fa-user-circle" style={{ fontSize: 20 }} />
              {expanded && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</span>}
            </button>
          </div>
        )}
      </aside>

      <FullscreenModal isOpen={!!pending} onClose={() => setPending(null)} title={pending?.pending_popup_title || '模块待开发'}>
        <div style={{ color: '#aaddff', fontSize: 16, lineHeight: 1.7, maxWidth: 900 }}>
          <div style={{ marginBottom: 16 }}>{pending?.pending_popup_body || '该模块正在开发中'}</div>
          <button onClick={() => setPending(null)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(64,174,255,.6)', background: 'rgba(64,174,255,.12)', color: '#aaddff', cursor: 'pointer', fontSize: 16 }}>我知道了</button>
        </div>
      </FullscreenModal>
    </>
  )
}
