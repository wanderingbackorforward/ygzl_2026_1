import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import { useAgentStore } from '../stores/agentStore'
import type { AppModule } from '../types/modules'
import { ScreenHeader, GlowNumber, RadarOrb, AlertTicker, type RadarDot } from '../components/screen'
import { BorderBox13, Decoration11 } from '../components/screen/datav'

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

const RADAR_LAYOUT: { x: number; y: number }[] = [
  { x: 32, y: 28 }, { x: 68, y: 35 }, { x: 50, y: 52 }, { x: 28, y: 66 }, { x: 72, y: 70 }, { x: 45, y: 80 }, { x: 58, y: 22 },
]

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function Cover() {
  const { modules } = useModules()
  const badge = useAgentStore(s => s.badge)
  const [now, setNow] = useState<Date>(() => new Date(0))
  const loadRef = useRef<number>(Date.now())

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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

  const clock = now.getTime() ? now.toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--'
  const uptime = now.getTime() ? fmtUptime(Date.now() - loadRef.current) : '--:--:--'
  const sevColor = sevTone === 'danger' ? '#ff5c7a' : sevTone === 'warning' ? '#ffc24d' : '#6dff9e'

  return (
    <div style={{ padding: 'var(--wall-gap)', minHeight: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column', gap: 'var(--wall-gap)', position: 'relative', zIndex: 1 }}>
      <ScreenHeader
        title="隧道工程安全监测数字孪生"
        subtitle="DIGITAL TWIN · SAFETY MONITORING PLATFORM"
        status={`系统在线 · ${sevLabel}`}
      />

      {/* KPI 行 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--wall-gap)' }}>
        <BorderBox13 style={{ minHeight: 110 }}>
          <div style={{ color: 'rgba(215,244,255,0.7)', fontSize: 14, letterSpacing: 1 }}>功能模块</div>
          <GlowNumber value={entries.length} tone="info" unit="个" />
        </BorderBox13>
        <BorderBox13 style={{ minHeight: 110 }}>
          <div style={{ color: 'rgba(215,244,255,0.7)', fontSize: 14, letterSpacing: 1 }}>待处理预警</div>
          <GlowNumber value={pendingCount} tone={sevTone === 'danger' ? 'danger' : sevTone === 'warning' ? 'warning' : 'normal'} unit="条" />
        </BorderBox13>
        <BorderBox13 style={{ minHeight: 110 }}>
          <div style={{ color: 'rgba(215,244,255,0.7)', fontSize: 14, letterSpacing: 1 }}>风险等级</div>
          <div className={`dt-kpi dt-kpi--${sevTone}`} style={{ fontSize: 'clamp(30px, 3.6vw, 48px)' }}>
            {sev === 'critical' ? '危急' : sev === 'warning' ? '预警' : '正常'}
          </div>
        </BorderBox13>
        <BorderBox13 style={{ minHeight: 110 }}>
          <div style={{ color: 'rgba(215,244,255,0.7)', fontSize: 14, letterSpacing: 1 }}>平台运行</div>
          <div className="dt-clock" style={{ fontSize: 'clamp(28px, 3.4vw, 44px)', fontWeight: 700, textShadow: '0 0 14px rgba(0,229,255,0.6)' }}>{uptime}</div>
        </BorderBox13>
      </div>

      {/* 中段三栏：监测概览 | 雷达态势 | 系统信息 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr)', gap: 'var(--wall-gap)', minHeight: 320 }}>
        {/* 左：监测概览 */}
        <BorderBox13 padding={16} style={{ minHeight: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Decoration11>监测概览</Decoration11>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.slice(0, 7).map(m => (
              <div key={m.module_key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                <i className={m.icon_class} style={{ width: 18, color: 'var(--wall-info)', textAlign: 'center' }} />
                <span style={{ flex: 1, color: '#d6f4ff' }}>{m.display_name}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6dff9e', fontSize: 13 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 6px #00e676' }} />
                  在线
                </span>
              </div>
            ))}
          </div>
        </BorderBox13>

        {/* 中：雷达态势 */}
        <BorderBox13 padding={16} style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Decoration11>全域风险态势</Decoration11>
          </div>
          <RadarOrb size={240} dots={radarDots} />
          <div style={{ color: 'rgba(215,244,255,0.6)', fontSize: 14, letterSpacing: 2, marginTop: 6, textAlign: 'center' }}>
            实时扫描监测点位 · 脉冲标记风险分布
          </div>
        </BorderBox13>

        {/* 右：系统信息 */}
        <BorderBox13 padding={16} style={{ minHeight: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Decoration11>系统信息</Decoration11>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15 }}>
            <InfoRow label="当前时间" value={<span className="dt-clock">{clock}</span>} />
            <InfoRow label="运行时长" value={<span className="dt-clock">{uptime}</span>} />
            <InfoRow label="监测模块" value={`${entries.length} 个`} />
            <InfoRow label="整体风险" value={<span style={{ color: sevColor, fontWeight: 700 }}>{sev === 'critical' ? '危急' : sev === 'warning' ? '预警' : '正常'}</span>} />
            <InfoRow label="数据链路" value={<span style={{ color: '#6dff9e' }}>● 正常</span>} />
          </div>
        </BorderBox13>
      </div>

      {/* 功能模块入口 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Decoration11>功能模块入口</Decoration11>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--wall-gap)' }}>
          {entries.map(m => {
            const isPending = m.status === 'pending'
            return (
              <Link
                key={m.module_key}
                to={m.route_path}
                className="touchkit-tile touchkit-tile--clickable"
                style={{ minHeight: 116, padding: 16, textDecoration: 'none', alignItems: 'flex-start', gap: 12, opacity: isPending ? 0.55 : 1 }}
              >
                <i className={m.icon_class} style={{ fontSize: 32, color: 'var(--wall-info)', textShadow: '0 0 12px rgba(0,229,255,0.7)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#eafcff' }}>{m.display_name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(0,229,255,0.7)', marginTop: 4 }}>{isPending ? (m.pending_badge_text || '待开发') : '进入 →'}</div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <AlertTicker items={tickerItems} tone={sevTone === 'danger' ? 'danger' : sevTone === 'warning' ? 'warning' : 'info'} />
    </div>
  )
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ color: 'rgba(215,244,255,0.6)' }}>{label}</span>
    <span style={{ color: '#eafcff' }}>{value}</span>
  </div>
)
