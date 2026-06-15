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

export default function Nav() {
  const { pathname } = useLocation()
  const { modules } = useModules()
  const { user, logout, isAuthEnabled } = useAuth()
  const [pending, setPending] = useState<AppModule | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const fetchBadge = useAgentStore(s => s.fetchBadge)
  const badge = useAgentStore(s => s.badge)

  // 初始拉取 badge + 每 60 秒刷新
  useEffect(() => {
    fetchBadge()
    const timer = setInterval(fetchBadge, 60_000)
    return () => clearInterval(timer)
  }, [fetchBadge])

  const items = useMemo<AppModule[]>(() => {
    if (modules.length) return modules
    return [
      { module_key: 'cover', route_path: '/cover', display_name: '首页', icon_class: 'fas fa-home', sort_order: 10, status: 'developed' },
      { module_key: 'settlement', route_path: '/settlement', display_name: '沉降', icon_class: 'fas fa-chart-area', sort_order: 20, status: 'developed' },
      { module_key: 'temperature', route_path: '/temperature', display_name: '温度', icon_class: 'fas fa-thermometer-half', sort_order: 30, status: 'developed' },
      { module_key: 'cracks', route_path: '/cracks', display_name: '裂缝', icon_class: 'fas fa-bug', sort_order: 40, status: 'developed' },
      { module_key: 'vibration', route_path: '/vibration', display_name: '振动', icon_class: 'fas fa-wave-square', sort_order: 50, status: 'developed' },
      { module_key: 'insar', route_path: '/insar', display_name: 'InSAR', icon_class: 'fas fa-satellite', sort_order: 60, status: 'developed' },
      { module_key: 'advanced', route_path: '/advanced', display_name: '高级分析', icon_class: 'fas fa-microscope', sort_order: 65, status: 'developed' },
      { module_key: 'overview', route_path: '/overview', display_name: '数据总览', icon_class: 'fas fa-chart-line', sort_order: 70, status: 'developed' },
      { module_key: 'three', route_path: '/three', display_name: '3D模型', icon_class: 'fas fa-cubes', sort_order: 80, status: 'developed' },
      { module_key: 'tickets', route_path: '/tickets', display_name: '工单', icon_class: 'fas fa-ticket-alt', sort_order: 90, status: 'developed' },
      { module_key: 'shield-trajectory', route_path: '/shield-trajectory', display_name: '盾构轨迹', icon_class: 'fas fa-route', sort_order: 95, status: 'developed' },
    ]
  }, [modules])

  /* ---- 手机：底部 Tab 栏 + 侧抽屉 ---- */
  if (IS_MOBILE) {
    const tabItems = items.filter(m => MOBILE_TAB_KEYS.includes(m.module_key))
    const moreItems = items.filter(m => !MOBILE_TAB_KEYS.includes(m.module_key) && !MOBILE_HIDDEN_KEYS.includes(m.module_key))

    return (
      <>
        {/* side drawer */}
        {moreOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex' }}
            onClick={() => setMoreOpen(false)}
          >
            <div style={{ flex: 1, background: 'rgba(0,0,0,.5)' }} />
            <nav
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 220,
                background: '#0a1930',
                borderLeft: '1px solid rgba(64,174,255,.3)',
                padding: '16px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#8bb8e0', borderBottom: '1px solid rgba(64,174,255,.15)' }}>
                更多模块
              </div>
              {moreItems.map(m => (
                <Link
                  key={m.module_key}
                  to={m.route_path}
                  onClick={() => setMoreOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    color: pathname === m.route_path ? '#40aeff' : '#b0cfee',
                    background: pathname === m.route_path ? 'rgba(64,174,255,.12)' : 'transparent',
                    textDecoration: 'none',
                    fontSize: 14,
                  }}
                >
                  {m.icon_class && <i className={m.icon_class} style={{ width: 20, textAlign: 'center' }} />}
                  <span>{m.display_name}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* bottom tab bar */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 800,
          background: 'rgba(10,25,47,.95)',
          borderTop: '1px solid rgba(64,174,255,.3)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '6px 0 env(safe-area-inset-bottom, 6px)',
        }}>
          {tabItems.map(m => {
            const active = pathname === m.route_path
            return (
              <Link
                key={m.module_key}
                to={m.route_path}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  color: active ? '#40aeff' : '#6b8db5',
                  textDecoration: 'none',
                  fontSize: 10,
                  padding: '4px 8px',
                  minWidth: 48,
                }}
              >
                {m.icon_class && <i className={m.icon_class} style={{ fontSize: 18 }} />}
                <span>{m.display_name}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: moreOpen ? '#40aeff' : '#6b8db5',
              background: 'none', border: 'none',
              fontSize: 10, padding: '4px 8px', minWidth: 48, cursor: 'pointer',
            }}
          >
            <i className="fas fa-ellipsis-h" style={{ fontSize: 18 }} />
            <span>更多</span>
          </button>
        </nav>
      </>
    )
  }

  /* ---- Web（桌面/iPad/壁挂）：低密度大号图标导航栏 ---- */
  return (
    <>
      <nav className="dt-nav" style={{
        padding: '10px 16px',
        background: 'rgba(8,16,28,.88)',
        borderBottom: '1px solid var(--wall-panel-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        {items.map(m => {
          const active = pathname === m.route_path
          const isPending = m.status === 'pending'
          return (
            <Link
              key={m.module_key}
              to={m.route_path}
              className={active ? 'dt-nav-link--active' : undefined}
              onClick={(e) => { if (isPending) { e.preventDefault(); setPending(m) } }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                minHeight: 52, padding: '0 16px', borderRadius: 12,
                fontSize: 17, textDecoration: 'none',
                color: active ? '#fff' : '#b0cfee',
                background: active ? 'rgba(0,229,255,.22)' : (isPending ? 'rgba(250,173,20,.1)' : 'rgba(0,229,255,.06)'),
                border: `1px solid ${active ? 'rgba(0,229,255,.6)' : isPending ? 'rgba(250,173,20,.35)' : 'rgba(0,229,255,.2)'}`,
                position: 'relative',
              }}
            >
              {m.icon_class && <i className={m.icon_class} style={{ fontSize: 20 }} />}
              <span>{m.display_name}</span>
              {m.module_key === 'settlement' && badge.has_unread && !active && (
                <span style={{ position:'absolute', top:6, right:6, width:9, height:9, borderRadius:'50%', background: badge.max_severity === 'critical' ? '#f87171' : '#fbbf24' }} />
              )}
            </Link>
          )
        })}

        {isAuthEnabled && user && (
          <button
            type="button"
            onClick={() => { if (window.confirm('确认退出登录？')) logout() }}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 9,
              minHeight: 52, padding: '0 16px', borderRadius: 12,
              background: 'rgba(100,255,218,.1)', border: '1px solid rgba(100,255,218,.3)',
              color: '#64ffda', fontSize: 16, cursor: 'pointer',
            }}
          >
            <i className="fas fa-user-circle" style={{ fontSize: 20 }} />
            <span>{user.displayName}</span>
            <i className="fas fa-sign-out-alt" style={{ fontSize: 16, opacity: 0.8 }} />
          </button>
        )}
      </nav>
      <FullscreenModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={pending?.pending_popup_title || '模块待开发'}
      >
        <div style={{ color: '#aaddff', fontSize: 16, lineHeight: 1.7, maxWidth: 900 }}>
          <div style={{ marginBottom: 16 }}>{pending?.pending_popup_body || '该模块正在开发中'}</div>
          <button
            onClick={() => setPending(null)}
            style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(64,174,255,.6)', background: 'rgba(64,174,255,.12)', color: '#aaddff', cursor: 'pointer', fontSize: 16 }}
          >
            我知道了
          </button>
        </div>
      </FullscreenModal>
    </>
  )
}
