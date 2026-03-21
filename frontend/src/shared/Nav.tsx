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

// 模块分类配置
type ModuleCategory = 'monitoring' | 'analysis' | 'management' | 'other'

interface CategoryStyle {
  color: string
  bgNormal: string
  bgActive: string
  border: string
  label: string
}

const CATEGORY_STYLES: Record<ModuleCategory, CategoryStyle> = {
  monitoring: {
    color: '#40aeff',
    bgNormal: 'rgba(64,174,255,.1)',
    bgActive: 'rgba(64,174,255,.3)',
    border: 'rgba(64,174,255,.4)',
    label: '监测数据'
  },
  analysis: {
    color: '#b37feb',
    bgNormal: 'rgba(179,127,235,.1)',
    bgActive: 'rgba(179,127,235,.3)',
    border: 'rgba(179,127,235,.4)',
    label: '分析展示'
  },
  management: {
    color: '#ff9c6e',
    bgNormal: 'rgba(255,156,110,.1)',
    bgActive: 'rgba(255,156,110,.3)',
    border: 'rgba(255,156,110,.4)',
    label: '管理工具'
  },
  other: {
    color: '#95de64',
    bgNormal: 'rgba(149,222,100,.1)',
    bgActive: 'rgba(149,222,100,.3)',
    border: 'rgba(149,222,100,.4)',
    label: '其他'
  }
}

const MODULE_CATEGORIES: Record<string, ModuleCategory> = {
  settlement: 'monitoring',
  temperature: 'monitoring',
  cracks: 'monitoring',
  vibration: 'monitoring',
  insar: 'monitoring',
  advanced: 'analysis',
  overview: 'analysis',
  three: 'analysis',
  tunnel: 'analysis',
  tickets: 'management',
  modules: 'management',
  'shield-trajectory': 'management',
  cover: 'other'
}

function getModuleCategory(moduleKey: string): ModuleCategory {
  return MODULE_CATEGORIES[moduleKey] || 'other'
}

export default function Nav() {
  const { pathname } = useLocation()
  const { modules } = useModules()
  const { user, logout, isAuthEnabled } = useAuth()
  const [pending, setPending] = useState<AppModule | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const fetchBadge = useAgentStore(s => s.fetchBadge)

  // 初始拉取 badge + 每 60 秒刷新
  useEffect(() => {
    fetchBadge()
    const timer = setInterval(fetchBadge, 60_000)
    return () => clearInterval(timer)
  }, [fetchBadge])

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
      { module_key: 'shield-trajectory', route_path: '/shield-trajectory', display_name: '盾构轨迹', icon_class: 'fas fa-route', sort_order: 95, status: 'developed' },
    ]
  }, [modules])

  const Item = ({ module }: { module: AppModule }) => {
    const category = getModuleCategory(module.module_key)
    const style = CATEGORY_STYLES[category]
    const isActive = pathname === module.route_path
    const badge = useAgentStore(s => s.badge)

    return (
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
            color: style.color,
            textDecoration: 'none',
            padding: '8px 15px',
            borderRadius: 5,
            transition: 'all .3s ease',
            background: isActive ? style.bgActive : (module.status === 'pending' ? 'rgba(250,173,20,.12)' : style.bgNormal),
            border: module.status === 'pending' ? '1px solid rgba(250,173,20,.35)' : `1px solid ${isActive ? style.border : 'transparent'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
          }}
        >
          {module.icon_class && <i className={module.icon_class} />}
          <span>{module.display_name}</span>
          {/* Agent 红/黄点 — 仅沉降按钮 */}
          {module.module_key === 'settlement' && badge.has_unread && !isActive && (
            <span style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: badge.max_severity === 'critical' ? '#f87171' : '#fbbf24',
            }} />
          )}
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
  }

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

  /* ---- Desktop top nav bar with categories ---- */
  // 按分类分组模块
  const groupedItems = useMemo(() => {
    const groups: Record<ModuleCategory, AppModule[]> = {
      monitoring: [],
      analysis: [],
      management: [],
      other: []
    }
    items.forEach(m => {
      const category = getModuleCategory(m.module_key)
      groups[category].push(m)
    })
    return groups
  }, [items])

  return (
    <>
      <nav style={{
        textAlign: 'center',
        marginBottom: 10,
        padding: '10px 16px',
        background: 'rgba(10,25,47,.8)',
        borderBottom: '1px solid rgba(64,174,255,.3)',
        position: 'relative'
      }}>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center'
        }}>
          {/* 监测数据类 */}
          {groupedItems.monitoring.length > 0 && (
            <>
              <li style={{
                fontSize: 11,
                color: CATEGORY_STYLES.monitoring.color,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: '0.5px',
                padding: '0 4px'
              }}>
                {CATEGORY_STYLES.monitoring.label}
              </li>
              {groupedItems.monitoring.map(m => <Item key={m.module_key} module={m} />)}
              <li style={{
                width: 1,
                height: 20,
                background: 'rgba(255,255,255,.15)',
                margin: '0 4px'
              }} />
            </>
          )}

          {/* 分析展示类 */}
          {groupedItems.analysis.length > 0 && (
            <>
              <li style={{
                fontSize: 11,
                color: CATEGORY_STYLES.analysis.color,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: '0.5px',
                padding: '0 4px'
              }}>
                {CATEGORY_STYLES.analysis.label}
              </li>
              {groupedItems.analysis.map(m => <Item key={m.module_key} module={m} />)}
              <li style={{
                width: 1,
                height: 20,
                background: 'rgba(255,255,255,.15)',
                margin: '0 4px'
              }} />
            </>
          )}

          {/* 管理工具类 */}
          {groupedItems.management.length > 0 && (
            <>
              <li style={{
                fontSize: 11,
                color: CATEGORY_STYLES.management.color,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: '0.5px',
                padding: '0 4px'
              }}>
                {CATEGORY_STYLES.management.label}
              </li>
              {groupedItems.management.map(m => <Item key={m.module_key} module={m} />)}
            </>
          )}

          {/* 其他类 */}
          {groupedItems.other.length > 0 && (
            <>
              {(groupedItems.monitoring.length > 0 || groupedItems.analysis.length > 0 || groupedItems.management.length > 0) && (
                <li style={{
                  width: 1,
                  height: 20,
                  background: 'rgba(255,255,255,.15)',
                  margin: '0 4px'
                }} />
              )}
              {groupedItems.other.map(m => <Item key={m.module_key} module={m} />)}
            </>
          )}

          {/* 模块管理 */}
          <li style={{
            width: 1,
            height: 20,
            background: 'rgba(255,255,255,.15)',
            margin: '0 4px'
          }} />
          <li style={{ display: 'inline' }}>
            <Link to="/modules" style={{
              color: CATEGORY_STYLES.management.color,
              textDecoration: 'none',
              padding: '8px 15px',
              borderRadius: 5,
              transition: 'all .3s ease',
              background: pathname === '/modules' ? CATEGORY_STYLES.management.bgActive : CATEGORY_STYLES.management.bgNormal,
              border: pathname === '/modules' ? `1px solid ${CATEGORY_STYLES.management.border}` : '1px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <i className="fas fa-sliders-h" /> 模块管理
            </Link>
          </li>
        </ul>

        {/* 用户信息（右上角） */}
        {isAuthEnabled && user && (
          <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  background: 'rgba(100, 255, 218, 0.1)',
                  border: '1px solid rgba(100, 255, 218, 0.3)',
                  borderRadius: 6,
                  color: '#64ffda',
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 255, 218, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 255, 218, 0.1)';
                }}
              >
                <i className="fas fa-user-circle" style={{ fontSize: 16 }} />
                <span>{user.displayName}</span>
                <i className={`fas fa-chevron-${userMenuOpen ? 'up' : 'down'}`} style={{ fontSize: 10 }} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 899,
                    }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      minWidth: 180,
                      background: 'linear-gradient(135deg, rgba(10, 25, 47, 0.98) 0%, rgba(17, 34, 64, 0.98) 100%)',
                      border: '1px solid rgba(100, 255, 218, 0.3)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                      zIndex: 900,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(100, 255, 218, 0.15)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e6f7ff', marginBottom: 4 }}>
                        {user.displayName}
                      </div>
                      <div style={{ fontSize: 12, color: '#8ba0b6' }}>
                        @{user.username}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        if (window.confirm('确认退出登录？')) {
                          logout();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: '#ff3e5f',
                        fontSize: 13,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 62, 95, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <i className="fas fa-sign-out-alt" />
                      <span>退出登录</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
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
