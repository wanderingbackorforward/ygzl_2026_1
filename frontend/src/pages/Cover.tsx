import { Link } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import { useAgentStore } from '../stores/agentStore'
import type { AppModule } from '../types/modules'
import { StatusTile, type TileTone } from '../components/touchkit/StatusTile'

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

const SEV_TONE: Record<string, TileTone> = { critical: 'danger', warning: 'warning', info: 'normal' }
const SEV_LABEL: Record<string, string> = { critical: '存在危急预警', warning: '有预警待处理', info: '运行正常' }

export default function Cover() {
  const { modules } = useModules()
  const badge = useAgentStore(s => s.badge)

  const source = modules.length ? modules : DEFAULT_MODULES
  const entries = source
    .filter(m => m.module_key !== 'cover' && m.module_key !== 'modules')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const sev = badge?.max_severity ?? 'info'
  const statusTone = SEV_TONE[sev] ?? 'normal'
  const statusLabel = SEV_LABEL[sev] ?? '运行正常'
  const statusColor = statusTone === 'danger' ? '#ff8b9a' : statusTone === 'warning' ? '#ffc24d' : '#7dff9d'

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
      </div>

      {/* 状态 KPI 行 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--wall-gap)' }}>
        <StatusTile label="功能模块" value={entries.length} tone="info" icon="fas fa-th-large" sub="个" />
        <StatusTile
          label="待处理预警"
          value={badge?.count ?? 0}
          tone={statusTone === 'danger' ? 'danger' : statusTone === 'warning' ? 'warning' : 'normal'}
          icon="fas fa-bell"
          sub="条"
        />
        <StatusTile label="风险等级" value={sev === 'critical' ? '危急' : sev === 'warning' ? '预警' : '正常'} tone={statusTone} icon="fas fa-triangle-exclamation" />
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
