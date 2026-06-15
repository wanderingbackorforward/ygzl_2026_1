import { Link } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import { useAgentStore } from '../stores/agentStore'
import type { AppModule } from '../types/modules'
import { ScreenHeader, GlowNumber, RadarOrb, AlertTicker, type RadarDot } from '../components/screen'

const DEFAULT_MODULES: AppModule[] = [
  { module_key: 'settlement', route_path: '/settlement', display_name: '沉降监测', icon_class: 'fas fa-chart-area', sort_order: 20, status: 'developed' },
  { module_key: 'temperature', route_path: '/temperature', display_name: '温度场', icon_class: 'fas fa-temperature-half', sort_order: 30, status: 'developed' },
  { module_key: 'cracks', route_path: '/cracks', display_name: '裂缝监测', icon_class: 'fas fa-bug', sort_order: 40, status: 'developed' },
  { module_key: 'vibration', route_path: '/vibration', display_name: '振动监测', icon_class: 'fas fa-wave-square', sort_order: 50, status: 'developed' },
  { module_key: 'insar', route_path: '/insar', display_name: 'InSAR 形变', icon_class: 'fas fa-satellite', sort_order: 60, status: 'developed' },
  { module_key: 'advanced', route_path: '/advanced', display_name: '高级分析', icon_class: 'fas fa-microscope', sort_order: 65, status: 'developed' },
  { module_key: 'overview', route_path: '/overview', display_name: '数据总览', icon_class: 'fas fa-chart-line', sort_order: 70, status: 'developed' },
  { module_key: 'three', route_path: '/three', display_name: '三维模型', icon_class: 'fas fa-cubes', sort_order: 80, status: 'developed' },
  { module_key: 'tickets', route_path: '/tickets', display_name: '工单管理', icon_class: 'fas fa-ticket-simple', sort_order: 90, status: 'developed' },
  { module_key: 'shield-trajectory', route_path: '/shield-trajectory', display_name: '盾构轨迹', icon_class: 'fas fa-route', sort_order: 95, status: 'developed' },
]

const SEV_LABEL: Record<string, string> = { critical: '存在危急预警', warning: '有预警待处理', info: '运行正常' }
const SEV_TONE = { critical: 'danger', warning: 'warning', info: 'normal' } as const

// 雷达上脉冲点的固定方位（百分比），按整体风险等级着色
const RADAR_LAYOUT: { x: number; y: number }[] = [
  { x: 32, y: 28 }, { x: 68, y: 35 }, { x: 50, y: 52 }, { x: 28, y: 66 }, { x: 72, y: 70 }, { x: 45, y: 80 }, { x: 58, y: 22 },
]

export default function Cover() {
  const { modules } = useModules()
  const badge = useAgentStore(s => s.badge)

  const source = modules.length ? modules : DEFAULT_MODULES
  const entries = source
    .filter(m => m.module_key !== 'cover' && m.module_key !== 'modules')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const sev = badge?.max_severity ?? 'info'
  const sevLabel = SEV_LABEL[sev] ?? '运行正常'
  const sevTone = SEV_TONE[sev] ?? 'normal'
  const pendingCount = badge?.count ?? 0

  const radarDots: RadarDot[] = RADAR_LAYOUT.map((p, i) => ({
    x: p.x,
    y: p.y,
    tone: sev === 'critical' ? (i % 3 === 0 ? 'danger' : 'warning') : sev === 'warning' ? (i % 2 === 0 ? 'warning' : 'normal') : 'normal',
  }))

  const tickerItems = [
    '数字孪生监测管控平台运行中',
    `当前整体风险等级：${sevLabel}`,
    `待处理预警 ${pendingCount} 条`,
    '请通过下方功能模块入口查看各监测项详情',
    'InSAR 形变 · 沉降 · 温度 · 裂缝 · 振动 多源实时感知',
  ]

  return (
    <div
      style={{
        padding: 'var(--wall-gap)',
        minHeight: 'calc(100vh - 96px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--wall-gap)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* 顶部标题栏 */}
      <ScreenHeader
        title="隧道工程安全监测数字孪生"
        subtitle="DIGITAL TWIN · SAFETY MONITORING PLATFORM"
        status={`系统在线 · ${sevLabel}`}
      />

      {/* KPI 行 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--wall-gap)' }}>
        <div className="dt-panel" style={{ padding: 18 }}>
          <div className="dt-panel__head" style={{ padding: 0, borderBottom: 'none', marginBottom: 10, background: 'none' }}>
            <span className="dt-panel__title">功能模块</span>
          </div>
          <GlowNumber value={entries.length} tone="info" unit="个" />
        </div>
        <div className="dt-panel" style={{ padding: 18 }}>
          <div className="dt-panel__head" style={{ padding: 0, borderBottom: 'none', marginBottom: 10, background: 'none' }}>
            <span className="dt-panel__title">待处理预警</span>
          </div>
          <GlowNumber value={pendingCount} tone={sevTone === 'danger' ? 'danger' : sevTone === 'warning' ? 'warning' : 'normal'} unit="条" />
        </div>
        <div className="dt-panel" style={{ padding: 18 }}>
          <div className="dt-panel__head" style={{ padding: 0, borderBottom: 'none', marginBottom: 10, background: 'none' }}>
            <span className="dt-panel__title">风险等级</span>
          </div>
          <div className={`dt-kpi dt-kpi--${sevTone}`} style={{ fontSize: 'clamp(30px, 3.6vw, 48px)' }}>
            {sev === 'critical' ? '危急' : sev === 'warning' ? '预警' : '正常'}
          </div>
        </div>
      </div>

      {/* 中心雷达态势 */}
      <div className="dt-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="dt-panel__head" style={{ padding: 0, borderBottom: 'none', background: 'none', alignSelf: 'flex-start' }}>
          <span className="dt-panel__title">全域风险态势</span>
        </div>
        <RadarOrb size={300} dots={radarDots} />
        <div style={{ color: 'rgba(215,244,255,0.65)', fontSize: 15, letterSpacing: 2 }}>
          实时扫描监测点位 · 脉冲标记当前风险分布
        </div>
      </div>

      {/* 功能模块入口 */}
      <div>
        <div className="dt-panel__head" style={{ padding: '0 4px 10px', borderBottom: 'none', background: 'none' }}>
          <span className="dt-panel__title" style={{ fontSize: 18 }}>
            <i className="fas fa-grip" style={{ marginRight: 10 }} />
            功能模块入口
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--wall-gap)' }}>
          {entries.map(m => {
            const isPending = m.status === 'pending'
            return (
              <Link
                key={m.module_key}
                to={m.route_path}
                className="touchkit-tile touchkit-tile--clickable dt-glow-icon"
                style={{
                  minHeight: 120,
                  padding: 18,
                  textDecoration: 'none',
                  alignItems: 'flex-start',
                  gap: 12,
                  opacity: isPending ? 0.55 : 1,
                }}
              >
                <i className={m.icon_class} style={{ fontSize: 34, color: 'var(--wall-info)', textShadow: '0 0 12px rgba(0,229,255,0.7)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#eafcff' }}>{m.display_name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(0,229,255,0.7)', marginTop: 4 }}>
                    {isPending ? (m.pending_badge_text || '待开发') : '进入 →'}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 底部告警跑马灯 */}
      <AlertTicker items={tickerItems} tone={sevTone === 'danger' ? 'danger' : sevTone === 'warning' ? 'warning' : 'info'} />
    </div>
  )
}
