import React, { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import type { AppModule } from '../types/modules'
import FullscreenModal from '../components/layout/FullscreenModal'

const IS_MOBILE = import.meta.env.VITE_MOBILE === 'true'

const MOBILE_TAB_KEYS = ['cover', 'settlement', 'temperature', 'cracks', 'overview']
const MOBILE_HIDDEN_KEYS = ['modules', 'three']

export default function Nav() {
  const { pathname } = useLocation()
  const { modules } = useModules()
  const [pending, setPending] = useState<AppModule | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const items = useMemo<AppModule[]>(() => {
    if (modules.length) return modules
    return [
      { module_key: 'cover', route_path: '/cover', display_name: '封面', icon_class: 'fas fa-home', sort_order: 10, status: 'developed' },
      { module_key: 'settlement', route_path: '/settlement', display_name: '沉降', icon_class: 'fas fa-chart-area', sort_order: 20, status: 'developed' },
      { module_key: 'temperature', route_path: '/temperature', display_name: '温度', icon_class: 'fas fa-thermometer-half', sort_order: 30, status: 'developed' },
      { module_key: 'cracks', route_path: '/cracks', display_name: '裂缝', icon_class: 'fas fa-bug', sort_order: 40, status: 'developed' },
      { module_key: 'vibration', route_path: '/vibration', display_name: '振动', icon_class: 'fas fa-wave-square', sort_order: 50, status: 'developed' },
      { module_key: 'insar', route_path: '/insar', display_name: 'InSAR', icon_class: 'fas fa-satellite', sort_order: 60, status: 'developed' },
      { module_key: 'advanced', route_path: '/advanced', display_name: '高级分析', icon_class: 'fas fa-microscope', sort_order: 65, status: 'developed' },

      { module_key: 'overview', route_path: '/overview', display_name: '数据总览', icon_class: 'fas fa-chart-line', sort_order: 70, status: 'developed' },
      { module_key: 'three', route_path: '/three', display_name: '3D模型', icon_class: 'fas fa-cubes', sort_order: 80, status: 'developed' },
      { module_key: 'tickets', route_path: '/tickets', display_name: '工单', icon_class: 'fas fa-ticket-alt', sort_order: 90, status: 'developed' },
    ]
  }, [modules])

  const Item = ({ module }: { module: AppModule }) => (
    <li style={{ display: 'inline' }}>
      <Link
        to={module.route_path}
        onClick={(e) => {
          if (module.status === 'pending') {
            e.preventDefault()
            setPending(module)
          }
        }}
        style={{
          color: '#40aeff',
          textDecoration: 'none',
          padding: '8px 15px',
          borderRadius: 5,
          transition: 'all .3s ease',
          background: pathname === module.route_path ? 'rgba(64,174,255,.3)' : (module.status === 'pending' ? 'rgba(250,173,20,.12)' : 'rgba(64,174,255,.1)'),
          border: module.status === 'pending' ? '1px solid rgba(250,173,20,.35)' : '1px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {module.icon_class && <i className={module.icon_class} />}
        <span>{module.display_name}</span>
        {module.status === 'pending' && (
          <span style={{
            display: 'inline-block',
            padding: '1px 8px',
            borderRadius: 999,
            fontSize: 12,
            lineHeight: '18px',
            color: 'rgba(255,255,255,.85)',
            background: 'rgba(250,173,20,.18)',
            border: '1px solid rgba(250,173,20,.45)'
          }}>
            {module.pending_badge_text || '待开发模块'}
          </span>
        )}
      </Link>
    </li>
  )

  /* ---- Mobile bottom tab bar ---- */
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

  /* ---- Desktop top nav bar (original) ---- */
  return (
    <>
      <nav style={{ textAlign: 'center', marginBottom: 10, padding: 10, background: 'rgba(10,25,47,.8)', borderBottom: '1px solid rgba(64,174,255,.3)' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
          {items.map(m => <Item key={m.module_key} module={m} />)}
          <li style={{ display: 'inline' }}>
            <Link to="/modules" style={{
              color: '#40aeff',
              textDecoration: 'none',
              padding: '8px 15px',
              borderRadius: 5,
              transition: 'all .3s ease',
              background: pathname === '/modules' ? 'rgba(64,174,255,.3)' : 'rgba(64,174,255,.1)'
            }}>
              <i className="fas fa-sliders-h" /> 模块管理
            </Link>
          </li>
        </ul>
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
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid rgba(64,174,255,.6)',
              background: 'rgba(64,174,255,.12)',
              color: '#aaddff',
              cursor: 'pointer'
            }}
          >
            我知道了
          </button>
        </div>
      </FullscreenModal>
    </>
  )
}
