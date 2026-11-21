import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useModules } from '../contexts/ModulesContext'
import { apiGet } from '../lib/api'
import type { AppModule } from '../types/modules'
import { StatusTile, type TileTone } from '../components/touchkit/StatusTile'

interface SystemStatus {
  level: 'normal' | 'warning' | 'alert'
  level_cn: string
  headline: string
  counts: {
    settlement_abnormal: number
    pending_tickets: number
    overdue_tickets: number
  }
}

const DEFAULT_MODULES: AppModule[] = [
  { module_key: 'settlement', route_path: '/settlement', display_name: '沉降', icon_class: 'fas fa-chart-area', sort_order: 20, status: 'developed' },
  { module_key: 'temperature', route_path: '/temperature', display_name: '温度', icon_class: 'fas fa-thermometer-half', sort_order: 30, status: 'developed' },
  { module_key: 'cracks', route_path: '/cracks', display_name: '裂缝', icon_class: 'fas fa-bug', sort_order: 40, status: 'developed' },
  { module_key: 'vibration', route_path: '/vibration', display_name: '振动', icon_class: 'fas fa-wave-square', sort_order: 50, status: 'developed' },
  { module_key: 'insar', route_path: '/insar', display_name: 'InSAR 形变', icon_class: 'fas fa-satellite', sort_order: 60, status: 'developed' },
  { module_key: 'advanced', route_path: '/advanced', display_name: '高级分析', icon_class: 'fas fa-microscope', sort_order: 65, status: 'developed' },
  { module_key: 'overview', route_path: '/overview', display_name: '数据总览', icon_class: 'fas fa-chart-line', sort_order: 70, status: 'developed' },
  { module_key: 'three', route_path: '/three', display_name: '3D 模型', icon_class: 'fas fa-cubes', sort_order: 80, status: 'developed' },
  { module_key: 'tickets', route_path: '/tickets', display_name: '工单', icon_class: 'fas fa-ticket-alt', sort_order: 90, status: 'developed' },
  { module_key: 'shield-trajectory', route_path: '/shield-trajectory', display_name: '盾构轨迹', icon_class: 'fas fa-route', sort_order: 95, status: 'developed' },
]

export default function Cover() {
  const { modules } = useModules()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [statusError, setStatusError] = useState(false)

  useEffect(() => {
    apiGet<SystemStatus>('/status/summary')
      .then(setStatus)
      .catch(e => {
        console.error('[Cover] fetch status failed', e)
        setStatusError(true)
      })
  }, [])

  const source = modules.length ? modules : DEFAULT_MODULES
  const entries = source
    .filter(m => m.module_key !== 'cover' && m.module_key !== 'modules')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const statusTone: TileTone = status
    ? (status.level === 'alert' ? 'danger' : status.level === 'warning' ? 'warning' : 'normal')
    : 'muted'
  const statusLabel = status
    ? (status.level === 'alert' ? '存在报警' : status.level === 'warning' ? '有预警待处理' : '运行正常')
    : (statusError ? '状态获取失败' : '状态同步中')
  const statusColor = statusTone === 'danger' ? '#ff8b9a' : statusTone === 'warning' ? '#ffc24d' : statusTone === 'normal' ? '#7dff9d' : '#cfd8e3'
  const abnormalCount = status ? status.counts.settlement_abnormal : '--'
  const riskLabel = status?.level_cn ?? (statusError ? '未知' : '同步中')

  return (
    <div
      style={{
        padding: 'var(--wall-gap)',
        minHeight: 'calc(100vh - 96px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--wall-gap)',
        overflow: 'auto',
      }}
    >
      {/* 标题区 */}
      <div className="touchkit-tile" style={{ padding: '36px 40px' }}>
        <span className={`touchkit-tile__bar touchkit-tile__bar--${statusTone}`} />
        <div style={{ fontSize: 14, color: 'rgba(230,247,255,0.6)', letterSpacing: 3 }}>
          DIGITAL TWIN · 安全监测管控平台
        </div>
        <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', fontWeight: 800, margin: '10px 0 8px', lineHeight: 1.1 }}>
          隧道工程安全监测数字孪生
        </h1>
        <div style={{ fontSize: 'clamp(16px, 1.6vw, 20px)', color: 'rgba(230,247,255,0.78)' }}>
          实时形变 · 多源传感 · 风险预警 · 智能研判
        </div>
        <div
          style={{
            marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '12px 22px', borderRadius: 999,
            background: `${statusColor}1f`, border: `1px solid ${statusColor}66`, color: statusColor,
            fontSize: 18, fontWeight: 600,
          }}
        >
          <i className="fas fa-shield-halved" style={{ fontSize: 22 }} />
          系统状态：{statusLabel}
        </div>
        {status && (
          <div style={{ marginTop: 10, fontSize: 14, color: 'rgba(230,247,255,0.62)' }}>
            {status.headline}
          </div>
        )}
      </div>

      {/* 状态 KPI 行 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--wall-gap)' }}>
        <StatusTile label="功能模块" value={entries.length} tone="info" icon="fas fa-th-large" sub="个" />
        <StatusTile
          label="沉降异常点"
          value={abnormalCount}
          tone={statusTone}
          icon="fas fa-bell"
          sub={status ? '个' : undefined}
        />
        <StatusTile label="风险等级" value={riskLabel} tone={statusTone} icon="fas fa-triangle-exclamation" />
      </div>

      {/* 模块入口大色块网格 */}
      <div>
        <div className="touchkit-label" style={{ marginBottom: 12, fontSize: 20 }}>
          <i className="fas fa-grip" style={{ marginRight: 10 }} />
          功能模块入口
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 'var(--wall-gap)' }}>
          {entries.map(m => {
            const isPending = m.status === 'pending'
            return (
              <Link
                key={m.module_key}
                to={m.route_path}
                className="touchkit-tile touchkit-tile--clickable"
                style={{
                  minHeight: 132,
                  textDecoration: 'none',
                  alignItems: 'flex-start',
                  gap: 14,
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                <i className={m.icon_class} style={{ fontSize: 40, color: 'var(--wall-info)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{m.display_name}</div>
                  <div style={{ fontSize: 14, color: 'rgba(230,247,255,0.55)', marginTop: 4 }}>
                    {isPending ? (m.pending_badge_text || '待开发') : '进入 →'}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
