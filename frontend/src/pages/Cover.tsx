import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '../contexts/ModulesContext'
import { useAgentStore } from '../stores/agentStore'
import { useOverview, OverviewProvider } from '../contexts/OverviewContext'
import type { AppModule } from '../types/modules'
import { ScreenHeader, GlowNumber, AlertTicker } from '../components/screen'
import { BorderBox13, Decoration11 } from '../components/screen/datav'
import { SafetyScoreGaugeCard } from '../components/overview/SafetyScoreGaugeCard'
import { RiskRadarCard } from '../components/overview/RiskRadarCard'
import { SettlementOverviewCard } from '../components/overview/SettlementOverviewCard'
import { CracksOverviewCard } from '../components/overview/CracksOverviewCard'
import { TemperatureOverviewCard } from '../components/overview/TemperatureOverviewCard'

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

function ChartPanel({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <BorderBox13 padding={0} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0', flexShrink: 0 }}>
        <Decoration11>{title}</Decoration11>
      </div>
      <div style={{ flex: 1, minHeight: 120, padding: '0 6px 6px' }}>{children}</div>
    </BorderBox13>
  )
}

function CoverInner() {
  const { modules } = useModules()
  const badge = useAgentStore(s => s.badge)
  const { summary } = useOverview()
  const [now, setNow] = useState<Date>(() => new Date(0))
  const loadRef = useRef<number>(Date.now())

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const source = modules.length ? modules : DEFAULT_MODULES
  const entries = source.filter(m => m.module_key !== 'cover' && m.module_key !== 'modules').sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const sev = badge?.max_severity ?? 'info'
  const sevLabel = SEV_LABEL[sev] ?? '运行正常'
  const sevTone = SEV_TONE[sev] ?? 'normal'
  const pendingCount = badge?.count ?? 0

  const safety = summary?.safety_score ?? 0
  const totalPts = (summary?.settlement?.total_points ?? 0) + (summary?.cracks?.total_points ?? 0)
  const settlementAlert = summary?.settlement?.alert_count ?? 0
  const crackExpanding = summary?.cracks?.expanding_count ?? 0
  const avgTemp = summary?.temperature?.avg_temp
  const safetyTone = safety >= 80 ? 'normal' : safety >= 60 ? 'warning' : 'danger'

  const tickerItems = [
    '数字孪生监测管控平台运行中',
    `整体风险等级：${sevLabel}`,
    `待处理预警 ${pendingCount} 条 · 沉降预警 ${settlementAlert} · 裂缝扩展 ${crackExpanding}`,
    'InSAR 形变 · 沉降 · 温度 · 裂缝 · 振动 多源实时感知',
  ]

  const clock = now.getTime() ? now.toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--'

  return (
    <div style={{ padding: 'var(--wall-gap)', minHeight: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column', gap: 'var(--wall-gap)', position: 'relative', zIndex: 1 }}>
      <ScreenHeader title="隧道工程安全监测数字孪生" subtitle="DIGITAL TWIN · SAFETY MONITORING PLATFORM" status={`系统在线 · ${sevLabel}`} />

      {/* KPI 行：真实数据 + 大号发光数字 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--wall-gap)' }}>
        <BorderBox13 padding={10} style={{ minHeight: 116 }}>
          <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.82)', letterSpacing: 1 }}>安全评分</div>
          <GlowNumber value={safety} tone={safetyTone} unit="分" />
        </BorderBox13>
        <BorderBox13 padding={10} style={{ minHeight: 116 }}>
          <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.82)', letterSpacing: 1 }}>监测点总数</div>
          <GlowNumber value={totalPts} tone="info" unit="个" />
        </BorderBox13>
        <BorderBox13 padding={10} style={{ minHeight: 116 }}>
          <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.82)', letterSpacing: 1 }}>沉降预警</div>
          <GlowNumber value={settlementAlert} tone={settlementAlert > 0 ? 'danger' : 'normal'} unit="处" />
        </BorderBox13>
        <BorderBox13 padding={10} style={{ minHeight: 116 }}>
          <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.82)', letterSpacing: 1 }}>裂缝扩展</div>
          <GlowNumber value={crackExpanding} tone={crackExpanding > 0 ? 'warning' : 'normal'} unit="条" />
        </BorderBox13>
        <BorderBox13 padding={10} style={{ minHeight: 116 }}>
          <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.82)', letterSpacing: 1 }}>温度均值</div>
          <GlowNumber value={avgTemp ?? 0} tone="info" unit="℃" />
        </BorderBox13>
        <BorderBox13 padding={10} style={{ minHeight: 116 }}>
          <div style={{ fontSize: 13, color: 'rgba(215,244,255,0.82)', letterSpacing: 1 }}>当前时间</div>
          <div className="dt-clock" style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', fontWeight: 700, textShadow: '0 0 14px rgba(0,229,255,0.6)' }}>{clock}</div>
        </BorderBox13>
      </div>

      {/* 中段三栏：真实图表密集填充 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr)', gap: 'var(--wall-gap)', height: 'clamp(360px, 48vh, 560px)' }}>
        {/* 左栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--wall-gap)', minHeight: 0 }}>
          <ChartPanel title="安全评分" style={{ flex: 1 }}><SafetyScoreGaugeCard cardId="cov-safety" /></ChartPanel>
          <ChartPanel title="裂缝状态" style={{ flex: 1 }}><CracksOverviewCard cardId="cov-cracks" /></ChartPanel>
        </div>
        {/* 中栏：风险雷达 */}
        <ChartPanel title="多维风险态势" style={{ height: '100%' }}><RiskRadarCard cardId="cov-risk" /></ChartPanel>
        {/* 右栏 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--wall-gap)', minHeight: 0 }}>
          <ChartPanel title="沉降分布" style={{ flex: 1 }}><SettlementOverviewCard cardId="cov-settlement" /></ChartPanel>
          <ChartPanel title="温度趋势" style={{ flex: 1 }}><TemperatureOverviewCard cardId="cov-temp" /></ChartPanel>
        </div>
      </div>

      {/* 功能模块入口 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Decoration11>功能模块入口</Decoration11>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {entries.map(m => {
            const isPending = m.status === 'pending'
            return (
              <Link key={m.module_key} to={m.route_path} className="touchkit-tile touchkit-tile--clickable"
                style={{ minHeight: 78, padding: '10px 14px', textDecoration: 'none', alignItems: 'center', gap: 10, opacity: isPending ? 0.55 : 1 }}>
                <i className={m.icon_class} style={{ fontSize: 24, color: 'var(--wall-info)', textShadow: '0 0 10px rgba(0,229,255,0.7)' }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: '#eafcff' }}>{m.display_name}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <AlertTicker items={tickerItems} tone={sevTone === 'danger' ? 'danger' : sevTone === 'warning' ? 'warning' : 'info'} />
    </div>
  )
}

export default function Cover() {
  return (
    <OverviewProvider>
      <CoverInner />
    </OverviewProvider>
  )
}
