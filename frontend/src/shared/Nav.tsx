import React, { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import type { AppModule } from '../types/modules'
import FullscreenModal from '../components/layout/FullscreenModal'

export default function Nav() {
  const { pathname } = useLocation()
  const { modules } = useModules()
  const [pending, setPending] = useState<AppModule | null>(null)

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
      { module_key: 'ml-analysis', route_path: '/ml-analysis', display_name: '智能分析中心', icon_class: 'fas fa-brain', sort_order: 66, status: 'developed' },
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
