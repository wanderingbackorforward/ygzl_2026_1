import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import type {
  DeviationRecord, DeviationSummary, CorrectionAdvice,
  PredictionResult, RiskBinsResponse,
} from '../components/trajectory/types'
import TrajectoryMap from '../components/trajectory/TrajectoryMap'

type Project = { project_id: string; name: string }
type Alignment = { alignment_id: string; project_id: string; name: string; geojson?: unknown }

const TABS = ['轨迹总览', '偏差分析', '风险管控'] as const
type Tab = (typeof TABS)[number]

export default function ShieldTrajectory() {
  // -- selectors --
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [alignments, setAlignments] = useState<Alignment[]>([])
  const [alignmentId, setAlignmentId] = useState('')
  const [machineId, setMachineId] = useState('TBM-01')

  // -- data --
  const [records, setRecords] = useState<DeviationRecord[]>([])
  const [summary, setSummary] = useState<DeviationSummary | null>(null)
  const [correction, setCorrection] = useState<CorrectionAdvice | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [riskData, setRiskData] = useState<RiskBinsResponse | null>(null)

  // -- UI --
  const [tab, setTab] = useState<Tab>('轨迹总览')
  const [selectedRing, setSelectedRing] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jumpRing, setJumpRing] = useState('')

  // -- load projects --
  useEffect(() => {
    apiGet<Project[]>('/tunnel/projects')
      .then((r) => {
        const list = r || []
        setProjects(list)
        if (!projectId && list.length) setProjectId(list[0].project_id)
      })
      .catch((e) => setError(String(e)))
  }, [])

  // -- load alignments --
  useEffect(() => {
    if (!projectId) return
    apiGet<Alignment[]>(`/tunnel/alignments?project_id=${encodeURIComponent(projectId)}`)
      .then((r) => {
        const list = r || []
        setAlignments(list)
        if (list.length && !list.some((a) => a.alignment_id === alignmentId)) {
          setAlignmentId(list[0].alignment_id)
        }
      })
      .catch((e) => setError(String(e)))
  }, [projectId])

  // -- load all trajectory data --
  const loadData = useCallback(async () => {
    if (!projectId || !machineId) return
    setLoading(true)
    setError('')
    try {
      const qs = `project_id=${encodeURIComponent(projectId)}&machine_id=${encodeURIComponent(machineId)}`
      const [devRes, sumRes, corRes] = await Promise.all([
        apiGet<{ records: DeviationRecord[] }>(`/tunnel/trajectory/deviation?${qs}`),
        apiGet<DeviationSummary>(`/tunnel/trajectory/summary?${qs}`),
        apiGet<CorrectionAdvice>(`/tunnel/trajectory/correction?${qs}`),
      ])
      let recs = devRes?.records || []
      // if no data, seed demo and reload once
      if (!recs.length) {
        await apiPost('/tunnel/trajectory/seed-demo', { project_id: projectId, machine_id: machineId })
        const retry = await apiGet<{ records: DeviationRecord[] }>(`/tunnel/trajectory/deviation?${qs}`)
        recs = retry?.records || []
        if (recs.length) {
          const [s2, c2] = await Promise.all([
            apiGet<DeviationSummary>(`/tunnel/trajectory/summary?${qs}`),
            apiGet<CorrectionAdvice>(`/tunnel/trajectory/correction?${qs}`),
          ])
          setSummary(s2)
          setCorrection(c2)
        }
      } else {
        setSummary(sumRes)
        setCorrection(corRes)
      }
      setRecords(recs)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId, machineId])

  useEffect(() => { loadData() }, [loadData])

  // -- lazy load prediction --
  useEffect(() => {
    if (tab !== '偏差分析' || !projectId || !machineId) return
    const qs = `project_id=${encodeURIComponent(projectId)}&machine_id=${encodeURIComponent(machineId)}`
    apiGet<PredictionResult>(`/tunnel/trajectory/prediction?${qs}`)
      .then(setPrediction).catch(() => {})
  }, [tab, projectId, machineId])

  // -- lazy load risk --
  useEffect(() => {
    if (tab !== '风险管控' || !projectId) return
    const qs = new URLSearchParams({ project_id: projectId, bin_m: '20' })
    if (alignmentId) qs.set('alignment_id', alignmentId)
    if (machineId) qs.set('machine_id', machineId)
    apiGet<RiskBinsResponse>(`/tunnel/risk/bins?${qs.toString()}`)
      .then(setRiskData).catch(() => {})
  }, [tab, projectId, alignmentId, machineId])

  // -- selected alignment geojson --
  const alignGeo = useMemo(() => {
    const a = alignments.find((x) => x.alignment_id === alignmentId)
    if (!a?.geojson) return null
    const g: any = typeof a.geojson === 'string'
      ? (() => { try { return JSON.parse(a.geojson as string) } catch { return null } })()
      : a.geojson
    return g
  }, [alignments, alignmentId])

  // -- ring click --
  const handleRingClick = useCallback((ring: number) => {
    setSelectedRing(ring)
    setDrawerOpen(true)
  }, [])

  const selectedRecord = useMemo(
    () => records.find((r) => r.ring_no === selectedRing) || null,
    [records, selectedRing],
  )

  // -- hero values --
  const heroRing = summary?.current_ring ?? '-'
  const heroLength = summary?.total_length_m ? `${summary.total_length_m.toFixed(0)}m` : '-'
  const heroMaxDev = useMemo(() => {
    if (!summary?.h_dev) return '-'
    const h = Math.max(Math.abs(summary.h_dev.max), Math.abs(summary.h_dev.min))
    const v = Math.max(Math.abs(summary.v_dev.max), Math.abs(summary.v_dev.min))
    return `${Math.max(h, v).toFixed(0)}mm`
  }, [summary])
  const heroStatus = correction?.overall_status || '加载中'
  const statusColor = heroStatus === '正常' ? 'text-green-400'
    : heroStatus === '需关注' ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="flex h-full flex-col text-white">
      {/* === Hero Bar === */}
      <div className="shrink-0 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-slate-200">当前环号</div>
              <div className="text-2xl font-bold text-cyan-400">{heroRing}</div>
            </div>
            <div>
              <div className="text-xs text-slate-200">累计掘进</div>
              <div className="text-2xl font-bold text-white">{heroLength}</div>
            </div>
            <div>
              <div className="text-xs text-slate-200">最大偏差</div>
              <div className="text-2xl font-bold text-white">{heroMaxDev}</div>
            </div>
            <div>
              <div className="text-xs text-slate-200">状态</div>
              <div className={`text-lg font-semibold ${statusColor}`}>{heroStatus}</div>
            </div>
          </div>
          {/* quick jump */}
          <div className="flex items-center gap-2">
            <input
              className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
              placeholder="环号跳转"
              value={jumpRing}
              onChange={(e) => setJumpRing(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = parseInt(jumpRing, 10)
                  if (!isNaN(n)) handleRingClick(n)
                }
              }}
            />
          </div>
        </div>
        {/* selectors + tabs */}
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <select className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
            value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
          </select>
          <select className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
            value={alignmentId} onChange={(e) => setAlignmentId(e.target.value)}>
            {alignments.map((a) => <option key={a.alignment_id} value={a.alignment_id}>{a.name}</option>)}
          </select>
          <input className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
            value={machineId} onChange={(e) => setMachineId(e.target.value)} placeholder="机号" />
          <div className="ml-4 flex gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  tab === t ? 'bg-cyan-600 text-white' : 'text-white hover:bg-slate-700'
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* === Error === */}
      {error && <div className="shrink-0 bg-red-900/40 px-4 py-2 text-sm text-red-300">{error}</div>}

      {/* === Main content === */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && <div className="text-center text-slate-200 py-12">加载中...</div>}

        {!loading && tab === '轨迹总览' && (
          <div>
            <TrajectoryMap
              alignmentGeoJSON={alignGeo}
              records={records}
              selectedRing={selectedRing}
              onRingClick={handleRingClick}
            />
            {!records.length && (
              <div className="mt-4 text-center text-slate-200">暂无遥测数据，已自动生成模拟数据...</div>
            )}
          </div>
        )}

        {!loading && tab === '偏差分析' && (
          <div className="space-y-4">
            {/* Lazy import for code splitting */}
            <DeviationProfileLazy records={records} selectedRing={selectedRing}
              onRingSelect={handleRingClick} prediction={prediction} />
            <DeviationStatsLazy summary={summary} correction={correction} records={records} />
          </div>
        )}

        {!loading && tab === '风险管控' && (
          <RiskPanelLazy riskData={riskData} projectId={projectId} alignmentId={alignmentId}
            machineId={machineId} onRefresh={loadData} />
        )}
      </div>

      {/* === Drawer === */}
      {drawerOpen && selectedRecord && (
        <RingDrawerLazy record={selectedRecord} records={records}
          onClose={() => setDrawerOpen(false)}
          onNavigate={(rn) => setSelectedRing(rn)} />
      )}
    </div>
  )
}

// ---- Lazy wrappers (inline for simplicity, actual components imported below) ----
import { lazy, Suspense } from 'react'

const DeviationProfileComp = lazy(() => import('../components/trajectory/DeviationProfile'))
const DeviationStatsComp = lazy(() => import('../components/trajectory/DeviationStats'))
const RiskPanelComp = lazy(() => import('../components/trajectory/RiskPanel'))
const RingDrawerComp = lazy(() => import('../components/trajectory/RingDetailDrawer'))

function DeviationProfileLazy(props: any) {
  return <Suspense fallback={<div className="text-white text-center py-8">加载图表...</div>}>
    <DeviationProfileComp {...props} />
  </Suspense>
}
function DeviationStatsLazy(props: any) {
  return <Suspense fallback={null}><DeviationStatsComp {...props} /></Suspense>
}
function RiskPanelLazy(props: any) {
  return <Suspense fallback={<div className="text-white text-center py-8">加载风险面板...</div>}>
    <RiskPanelComp {...props} />
  </Suspense>
}
function RingDrawerLazy(props: any) {
  return <Suspense fallback={null}><RingDrawerComp {...props} /></Suspense>
}
