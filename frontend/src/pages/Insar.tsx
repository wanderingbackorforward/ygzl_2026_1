import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../lib/api'
import type { EChartsOption } from 'echarts'
import EChartsWrapper from '../components/charts/EChartsWrapper'
import {
  expertMeasuresForRisk,
  formatKeyDateField,
  getVelocityFromProps,
  loadAdviceStore,
  riskFromVelocity,
  safeDatasetName,
  type AdviceStore,
  type FieldsInfo,
  type Indicator,
  type RiskFilter,
  type RiskLevel,
  type RiskStats,
  type RiskSummary,
  type Thresholds,
  type ZoneSummary,
} from '../lib/insar'
import { extractInsarContext } from '../utils/contextExtractors/insarExtractor'
import { SegmentedControl, LargeIconButton, StatusTile, KpiRail, FullscreenFocus, TourControl } from '../components/touchkit'
import { BottomSheet } from '../components/screen'
import { InsarNativeMap } from '../components/insar/InsarNativeMap'

export default function Insar() {
  const [dataset, setDataset] = useState('yanggaozhong')
  const [datasets, setDatasets] = useState<string[]>(['yanggaozhong'])
  const [indicator, setIndicator] = useState<Indicator>('velocity')
  const [fieldsInfo, setFieldsInfo] = useState<FieldsInfo | null>(null)
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsError, setFieldsError] = useState<string | null>(null)
  const [keyDateField, setKeyDateField] = useState<string>('')
  const [useBbox, setUseBbox] = useState(false)
  const [riskSummary, setRiskSummary] = useState<RiskSummary>({ total: 0, danger: 0, warning: 0, normal: 0, unknown: 0, top: [] })
  const [riskStats, setRiskStats] = useState<RiskStats | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{ id: string, props: Record<string, any>, lat: number, lng: number } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // 主组件自有的时序数据状态（用于详情面板）
  const [panelSeries, setPanelSeries] = useState<SeriesData | null>(null)
  const [panelSeriesLoading, setPanelSeriesLoading] = useState(false)
  const [panelSeriesError, setPanelSeriesError] = useState<string | null>(null)
  const [adviceStore, setAdviceStore] = useState<AdviceStore>(() => loadAdviceStore())
  const [thresholds, setThresholds] = useState<Thresholds>(() => {
    try {
      const raw = localStorage.getItem('insar_thresholds_v1')
      if (raw) {
        const obj = JSON.parse(raw)
        if (obj && typeof obj === 'object' && typeof obj.strong === 'number' && typeof obj.mild === 'number') return obj
      }
    } catch {
    }
    return { strong: 10, mild: 2 }
  })
  const [showZones, setShowZones] = useState(() => {
    try {
      return localStorage.getItem('insar_show_zones_v1') === '1'
    } catch {
      return false
    }
  })
  const [zoneEpsM, setZoneEpsM] = useState(() => {
    try {
      const raw = localStorage.getItem('insar_zone_eps_m_v1')
      const n = raw ? Number(raw) : 50
      return Number.isFinite(n) && n > 0 ? n : 50
    } catch {
      return 50
    }
  })
  const [zoneMinPts, setZoneMinPts] = useState(() => {
    try {
      const raw = localStorage.getItem('insar_zone_min_pts_v1')
      const n = raw ? Number(raw) : 6
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 6
    } catch {
      return 6
    }
  })
  const [chainageBinSize, setChainageBinSize] = useState(() => {
    try {
      const raw = localStorage.getItem('insar_chainage_bin_v1')
      const n = raw ? Number(raw) : 50
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 50
    } catch {
      return 50
    }
  })
  const [chainageMaxDistance, setChainageMaxDistance] = useState(() => {
    try {
      const raw = localStorage.getItem('insar_chainage_max_dist_v1')
      const n = raw ? Number(raw) : 200
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 200
    } catch {
      return 200
    }
  })
  const [zonesPanel, setZonesPanel] = useState<{ meta: Record<string, any> | null, top: ZoneSummary[] }>({ meta: null, top: [] })
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [showRiskGrid, setShowRiskGrid] = useState(true)
  const [patrolActive, setPatrolActive] = useState(false)
  const [patrolIndex, setPatrolIndex] = useState(0)
  const patrolAbortRef = useRef<AbortController | null>(null)
  const [showTrends, setShowTrends] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('insar_advice_v1', JSON.stringify(adviceStore))
    } catch {
    }
  }, [adviceStore])

  // 主组件：当 selectedPoint 改变时加载时序数据
  useEffect(() => {
    if (!selectedPoint?.id) {
      setPanelSeries(null)
      return
    }
    let mounted = true
    const controller = new AbortController()
    setPanelSeriesLoading(true)
    setPanelSeriesError(null)
    const safeDataset = safeDatasetName(dataset)
    const url = `${API_BASE}/insar/series?dataset=${encodeURIComponent(safeDataset)}&id=${encodeURIComponent(selectedPoint.id)}`
    ;(async () => {
      try {
        const res = await fetch(url, { signal: controller.signal })
        const body = await res.json().catch(() => null as any)
        if (!res.ok) throw new Error(body?.message || `请求失败：${res.status}`)
        if (body && typeof body === 'object' && body.status && body.status !== 'success') {
          throw new Error(body?.message || '加载失败')
        }
        if (!mounted) return
        setPanelSeries(body?.data && typeof body.data === 'object' ? body.data : null)
      } catch (e: any) {
        if (!mounted) return
        if (e?.name === 'AbortError') return
        setPanelSeries(null)
        setPanelSeriesError(e?.message || '加载失败')
      } finally {
        if (mounted) setPanelSeriesLoading(false)
      }
    })()
    return () => { mounted = false; controller.abort() }
  }, [dataset, selectedPoint?.id])

  // 主组件：时序图表选项
  const panelSeriesOption = useMemo((): EChartsOption => {
    const s = panelSeries?.series || []
    const dates = s.map((d) => d.date)
    const values = s.map((d) => d.value)
    return {
      title: { text: `点位：${panelSeries?.id || selectedPoint?.id || ''}`, left: 'center', textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '12%', right: '8%', top: '20%', bottom: '14%' },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{ name: 'D', type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2.5, shadowColor: 'rgba(0,229,255,0.7)', shadowBlur: 10 }, itemStyle: { color: '#00e5ff' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.35)' }, { offset: 1, color: 'rgba(0,229,255,0)' }] } } }],
      animationDuration: 600,
    }
  }, [panelSeries?.id, panelSeries?.series, selectedPoint?.id])

  const velocityHistOption = useMemo((): EChartsOption => {
    const hist = riskStats?.velocityHist
    if (!hist || !hist.counts.length) return {}
    return {
      tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 11 } },
      grid: { left: 36, right: 8, top: 8, bottom: 24 },
      xAxis: { type: 'category', data: hist.edges.map((e) => e.toFixed(0)), axisLabel: { fontSize: 9, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      series: [{
        type: 'bar',
        data: hist.counts.map((c, i) => ({
          value: c,
          itemStyle: { color: hist.edges[i] < 0 ? '#ff6b6b' : hist.edges[i] > 0 ? '#4dabf7' : '#94a3b8' },
        })),
        barWidth: '80%',
      }],
      animationDuration: 400,
    }
  }, [riskStats?.velocityHist])

  const riskPieOption = useMemo((): EChartsOption => {
    if (!riskSummary.total) return {}
    return {
      tooltip: { trigger: 'item', confine: true, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '50%'],
        label: { show: false },
        data: [
          { value: riskSummary.danger, name: '危险', itemStyle: { color: '#ff3e5f' } },
          { value: riskSummary.warning, name: '预警', itemStyle: { color: '#ff9e0d' } },
          { value: riskSummary.normal, name: '正常', itemStyle: { color: '#00e676' } },
          { value: riskSummary.unknown, name: '未知', itemStyle: { color: '#7c8a9a' } },
        ].filter((d) => d.value > 0),
        emphasis: { scaleSize: 4 },
      }],
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'center',
        style: {
          text: String(riskSummary.total),
          fontSize: 18,
          fontWeight: 'bold',
          fill: '#e2e8f0',
          textAlign: 'center',
        },
      }],
      animationDuration: 400,
    }
  }, [riskSummary.total, riskSummary.danger, riskSummary.warning, riskSummary.normal, riskSummary.unknown])

  const chainageChartOption = useMemo((): EChartsOption => {
    const ch = riskStats?.chainage
    if (!ch || !ch.labels.length) return {}
    const maxLabelCount = 8
    const step = ch.labels.length > maxLabelCount ? Math.ceil(ch.labels.length / maxLabelCount) : 1
    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        textStyle: { fontSize: 11 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return ''
          const seg = params[0].name
          const lines = params.map((p: any) => `<span style="color:${p.color}">\u25CF</span> ${p.seriesName}: ${p.value}`).join('<br/>')
          return `<div style="font-size:11px"><b>${seg}</b><br/>${lines}</div>`
        },
      },
      legend: { show: true, top: 0, right: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
      grid: { left: 36, right: 8, top: 28, bottom: 24 },
      xAxis: {
        type: 'category',
        data: ch.labels,
        axisLabel: { fontSize: 8, color: '#94a3b8', rotate: 35, interval: step - 1 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 9, color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [
        { name: '危险', type: 'bar', stack: 'risk', data: ch.danger, itemStyle: { color: '#ff3e5f' }, barWidth: '70%' },
        { name: '预警', type: 'bar', stack: 'risk', data: ch.warning, itemStyle: { color: '#ff9e0d' } },
        { name: '正常', type: 'bar', stack: 'risk', data: ch.normal, itemStyle: { color: '#00e676', opacity: 0.5 } },
      ],
      animationDuration: 400,
    }
  }, [riskStats?.chainage])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC 关闭面板
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false)
          e.preventDefault()
        } else if (selectedPoint) {
          setSelectedPoint(null)
          e.preventDefault()
        }
      }

      // 左右箭头切换点位（仅在详情面板打开时）
      if (selectedPoint && riskSummary.top.length > 1) {
        const currentIndex = riskSummary.top.findIndex(p => p.id === selectedPoint.id)
        if (currentIndex !== -1) {
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
            const prevPoint = riskSummary.top[currentIndex - 1]
            setFocusId(null)
            window.setTimeout(() => {
              setFocusId(prevPoint.id)
              setSelectedPoint({
                id: prevPoint.id,
                lat: prevPoint.lat,
                lng: prevPoint.lng,
                props: { velocity: prevPoint.velocity }
              })
            }, 0)
            e.preventDefault()
          } else if (e.key === 'ArrowRight' && currentIndex < riskSummary.top.length - 1) {
            const nextPoint = riskSummary.top[currentIndex + 1]
            setFocusId(null)
            window.setTimeout(() => {
              setFocusId(nextPoint.id)
              setSelectedPoint({
                id: nextPoint.id,
                lat: nextPoint.lat,
                lng: nextPoint.lng,
                props: { velocity: nextPoint.velocity }
              })
            }, 0)
            e.preventDefault()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSettings, selectedPoint, riskSummary.top])

  useEffect(() => {
    let mounted = true
    const url = `${API_BASE}/insar/datasets`
    ;(async () => {
      try {
        const res = await fetch(url)
        const body = await res.json().catch(() => null as any)
        if (!res.ok) throw new Error(body?.message || `请求失败：${res.status}`)
        const list = body?.data?.datasets
        if (!mounted) return
        if (Array.isArray(list) && list.length) setDatasets(list.map(String))
      } catch {
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    setFieldsLoading(true)
    setFieldsError(null)
    const safeDataset = safeDatasetName(dataset)
    const url = `${API_BASE}/insar/fields?dataset=${encodeURIComponent(safeDataset)}`
    ;(async () => {
      try {
        const res = await fetch(url)
        const body = await res.json().catch(() => null as any)
        if (!res.ok) throw new Error(body?.message || `请求失败：${res.status}`)
        if (body && typeof body === 'object' && body.status && body.status !== 'success') throw new Error(body?.message || '加载失败')
        if (!mounted) return
        const info: FieldsInfo | null = body?.data && typeof body.data === 'object' ? body.data : null
        setFieldsInfo(info)
        const d = Array.isArray(info?.d_fields) ? info!.d_fields : []
        if (d.length) setKeyDateField((prev) => (prev && d.includes(prev) ? prev : d[d.length - 1]))
      } catch (e: any) {
        if (!mounted) return
        setFieldsInfo(null)
        setFieldsError(e?.message || '加载失败')
      } finally {
        if (!mounted) return
        setFieldsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [dataset])

  useEffect(() => {
    try {
      localStorage.setItem('insar_thresholds_v1', JSON.stringify(thresholds))
    } catch {
    }
  }, [thresholds])

  useEffect(() => {
    try {
      localStorage.setItem('insar_show_zones_v1', showZones ? '1' : '0')
      localStorage.setItem('insar_zone_eps_m_v1', String(zoneEpsM))
      localStorage.setItem('insar_zone_min_pts_v1', String(zoneMinPts))
      localStorage.setItem('insar_chainage_bin_v1', String(chainageBinSize))
      localStorage.setItem('insar_chainage_max_dist_v1', String(chainageMaxDistance))
    } catch {
    }
  }, [showZones, zoneEpsM, zoneMinPts, chainageBinSize, chainageMaxDistance])

  const velocityField = useMemo(() => {
    if (!fieldsInfo) return 'velocity'
    if (fieldsInfo.velocity_fields?.length) return fieldsInfo.velocity_fields[0]
    return fieldsInfo.recommended_value_field || 'value'
  }, [fieldsInfo])

  const valueField = useMemo(() => {
    if (indicator === 'velocity') return velocityField
    if (indicator === 'threshold') return velocityField
    return keyDateField || velocityField
  }, [indicator, keyDateField, velocityField])

  const contextLevel = useMemo((): RiskLevel => {
    if (selectedPoint) {
      const v = getVelocityFromProps(selectedPoint.props, velocityField)
      return riskFromVelocity(v, thresholds)
    }
    if (riskSummary.danger > 0) return 'danger'
    if (riskSummary.warning > 0) return 'warning'
    return 'normal'
  }, [selectedPoint, velocityField, thresholds, riskSummary.danger, riskSummary.warning])

  const globalAdvice = adviceStore.globalByDataset?.[dataset]?.text ?? ''
  const pointAdvice = selectedPoint?.id ? (adviceStore.pointByDataset?.[dataset]?.[selectedPoint.id]?.text ?? '') : ''

  const setGlobalAdvice = (text: string) => {
    setAdviceStore((prev) => ({
      globalByDataset: { ...(prev.globalByDataset || {}), [dataset]: { text, updatedAt: Date.now() } },
      pointByDataset: prev.pointByDataset || {},
    }))
  }

  const setPointAdvice = (text: string) => {
    if (!selectedPoint?.id) return
    const ds = dataset
    const pid = selectedPoint.id
    setAdviceStore((prev) => ({
      globalByDataset: prev.globalByDataset || {},
      pointByDataset: {
        ...(prev.pointByDataset || {}),
        [ds]: {
          ...((prev.pointByDataset || {})[ds] || {}),
          [pid]: { text, updatedAt: Date.now() },
        },
      },
    }))
  }

  const startPatrol = () => {
    const points = riskSummary.top
    if (!points.length) return
    if (patrolAbortRef.current) patrolAbortRef.current.abort()
    const abort = new AbortController()
    patrolAbortRef.current = abort
    setPatrolActive(true)
    setPatrolIndex(0)
    setIndicator('threshold')

    const delay = (ms: number) => new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, ms)
      abort.signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) })
    })

    ;(async () => {
      try {
        const maxPoints = Math.min(points.length, 10)
        for (let i = 0; i < maxPoints; i++) {
          if (abort.signal.aborted) break
          const p = points[i]
          setPatrolIndex(i)
          setFocusId(null)
          await delay(50)
          setFocusId(p.id)
          setSelectedPoint({ id: p.id, lat: p.lat, lng: p.lng, props: { velocity: p.velocity } })
          await delay(3000)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error(e)
      } finally {
        setPatrolActive(false)
        patrolAbortRef.current = null
      }
    })()
  }

  const stopPatrol = () => {
    if (patrolAbortRef.current) patrolAbortRef.current.abort()
    setPatrolActive(false)
    patrolAbortRef.current = null
  }

  // ===== 壁挂大屏布局（控制室·唯一渲染）=====
  {
    const topList = riskSummary.top
    const patrolTotal = Math.min(topList.length, 10)
    const currentIdx = selectedPoint ? topList.findIndex(p => p.id === selectedPoint.id) : -1
    const goTopPoint = (delta: number) => {
      if (currentIdx < 0) return
      const ni = currentIdx + delta
      if (ni < 0 || ni >= topList.length) return
      const p = topList[ni]
      setFocusId(null)
      window.setTimeout(() => {
        setFocusId(p.id)
        setSelectedPoint({ id: p.id, lat: p.lat, lng: p.lng, props: { velocity: p.velocity } })
      }, 0)
    }
    const focusTopPoint = (p: RiskPoint) => {
      setIndicator('threshold'); setFocusId(null)
      window.setTimeout(() => {
        setFocusId(p.id)
        setSelectedPoint({ id: p.id, lat: p.lat, lng: p.lng, props: { velocity: p.velocity } })
      }, 0)
    }
    const filteredTop = riskFilter === 'all' || riskFilter === 'normal' ? topList : topList.filter(p => p.risk === riskFilter)

    const selVelocity = selectedPoint ? getVelocityFromProps(selectedPoint.props, velocityField) : null
    const selRisk: RiskLevel = selVelocity !== null ? riskFromVelocity(selVelocity, thresholds) : 'normal'
    const selRiskLabel = selRisk === 'danger' ? { label: '危险', color: '#ff8b9a' } : selRisk === 'warning' ? { label: '预警', color: '#ffc24d' } : { label: '正常', color: '#7dff9d' }

    return (
      <div className="flex h-screen flex-col text-white" style={{ background: 'transparent' }}>
        {/* CommandBar */}
        <div className="dt-panel" style={{ flexShrink: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 'auto' }}>
            <i className="fas fa-satellite dt-glow" style={{ fontSize: 28, color: 'var(--wall-info)' }} />
            <span className="dt-screen-title" style={{ fontSize: 'clamp(20px,2.6vw,30px)', letterSpacing: 3 }}>卫星雷达监测</span>
          </div>
          <SegmentedControl
            ariaLabel="风险筛选"
            value={riskFilter}
            onChange={(k) => setRiskFilter(k as RiskFilter)}
            items={[
              { key: 'all', label: '全部', count: riskSummary.total },
              { key: 'danger', label: '危险', count: riskSummary.danger, tone: 'danger', icon: 'fas fa-exclamation-triangle' },
              { key: 'warning', label: '预警', count: riskSummary.warning, tone: 'warning' },
              { key: 'normal', label: '正常', count: riskSummary.normal, tone: 'normal' },
            ]}
          />
          <LargeIconButton icon="fas fa-th" label="风险分区" active={showRiskGrid} onClick={() => setShowRiskGrid(v => !v)} />
          <TourControl
            active={patrolActive}
            index={patrolIndex}
            total={patrolTotal}
            onToggle={patrolActive ? stopPatrol : startPatrol}
            disabled={!topList.length}
          />
          <LargeIconButton icon="fas fa-cog" label="设置" active={showSettings} onClick={() => setShowSettings(true)} />
        </div>

        {/* 主区：地图 + KpiRail */}
        <div className="min-h-0 flex-1 flex overflow-hidden insar-wall-main">
          <div className="flex-1 min-w-0 overflow-hidden relative insar-wall-map">
            <InsarNativeMap
              dataset={dataset}
              indicator={indicator}
              valueField={valueField}
              velocityFieldName={velocityField}
              thresholds={thresholds}
              useBbox={useBbox}
              showZones={showZones}
              zoneEpsM={zoneEpsM}
              zoneMinPts={zoneMinPts}
              chainageBinSize={chainageBinSize}
              chainageMaxDistance={chainageMaxDistance}
              onSummaryChange={setRiskSummary}
              onStatsChange={setRiskStats}
              onZonesChange={setZonesPanel}
              focusId={focusId}
              focusZoneId={focusZoneId}
              onSelectedChange={setSelectedPoint}
              riskFilter={riskFilter}
              showRiskGrid={showRiskGrid}
            />
          </div>

          <KpiRail
            title="风险概览"
            footer={
              <div>
                <div style={{ fontSize: 'var(--wall-font-lg)', fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                  高风险点（{filteredTop.length}）
                </div>
                {filteredTop.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredTop.slice(0, 20).map(p => {
                      const isDanger = p.risk === 'danger'
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => focusTopPoint(p)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                            padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                            background: 'rgba(10,18,30,0.85)',
                            border: `1px solid ${isDanger ? 'rgba(255,62,95,0.4)' : 'rgba(255,158,13,0.4)'}`,
                            color: '#fff', cursor: 'pointer', minHeight: 'var(--wall-min-target)',
                          }}
                        >
                          <span style={{ width: 5, height: 28, borderRadius: 3, flexShrink: 0, background: isDanger ? 'var(--wall-danger)' : 'var(--wall-warning)' }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 16 }}>
                            {p.id || '未命名'}
                          </span>
                          <span style={{ flexShrink: 0, fontSize: 16, fontVariantNumeric: 'tabular-nums', color: isDanger ? '#ff8b9a' : '#ffc24d' }}>
                            {p.velocity.toFixed(1)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'rgba(230,247,255,0.5)' }}>暂无高风险点</div>
                )}
              </div>
            }
          >
            <StatusTile label="危险" value={riskSummary.danger} tone="danger" icon="fas fa-exclamation-triangle" sub="处" />
            <StatusTile label="预警" value={riskSummary.warning} tone="warning" icon="fas fa-exclamation-circle" sub="处" />
            <StatusTile label="正常" value={riskSummary.normal} tone="normal" icon="fas fa-check-circle" sub="处" />
            <StatusTile label="总点数" value={riskSummary.total} tone="info" icon="fas fa-map-marker-alt" />
            <StatusTile label="速度分布 / 里程分段" value={<i className="fas fa-chart-bar" />} tone="info" onClick={() => setShowTrends(true)} />
          </KpiRail>
        </div>

        {/* 点位详情：底部抽屉 sheet（iPad 风） */}
        <BottomSheet
          isOpen={!!selectedPoint}
          onClose={() => setSelectedPoint(null)}
          title={selectedPoint ? `点位 ${selectedPoint.id || ''}` : ''}
          onPrev={currentIdx > 0 ? () => goTopPoint(-1) : undefined}
          onNext={currentIdx >= 0 && currentIdx < topList.length - 1 ? () => goTopPoint(1) : undefined}
          prevDisabled={currentIdx <= 0}
          nextDisabled={currentIdx < 0 || currentIdx >= topList.length - 1}
        >
          {selectedPoint && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 20, height: '100%' }}>
              {/* 左：读数 + 建议 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', minWidth: 0 }}>
                <div className="touchkit-tile" style={{ minHeight: 0 }}>
                  <span className={`touchkit-tile__bar touchkit-tile__bar--${selRisk}`} />
                  <div className="touchkit-label">点位 ID</div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, wordBreak: 'break-all' }}>{selectedPoint.id || '未命名'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginTop: 14, fontSize: 16 }}>
                    <div><div style={{ opacity: 0.6 }}>经度</div><div style={{ fontFamily: 'monospace' }}>{selectedPoint.lng.toFixed(6)}</div></div>
                    <div><div style={{ opacity: 0.6 }}>纬度</div><div style={{ fontFamily: 'monospace' }}>{selectedPoint.lat.toFixed(6)}</div></div>
                    {selVelocity !== null && (
                      <>
                        <div><div style={{ opacity: 0.6 }}>速度</div><div style={{ fontFamily: 'monospace' }}>{selVelocity.toFixed(2)} mm/年</div></div>
                        <div><div style={{ opacity: 0.6 }}>风险</div><div style={{ color: selRiskLabel.color, fontWeight: 700 }}>{selRiskLabel.label}</div></div>
                      </>
                    )}
                  </div>
                </div>
                {selVelocity !== null && (() => {
                  const measures = expertMeasuresForRisk(selRisk)
                  if (!measures.length) return null
                  return (
                    <div className="touchkit-tile" style={{ minHeight: 0 }}>
                      <div className="touchkit-label" style={{ marginBottom: 10 }}>
                        <i className="fas fa-clipboard-list" style={{ marginRight: 8 }} />
                        施工建议 <span style={{ color: selRiskLabel.color }}>({selRiskLabel.label})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {measures.map((m, idx) => (
                          <div key={m.key} style={{ padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: 'rgba(0,229,255,0.18)', color: '#7df0ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{idx + 1}</span>
                              <div style={{ fontSize: 16, fontWeight: 600 }}>{m.title}</div>
                            </div>
                            <div style={{ marginLeft: 36, marginTop: 4, fontSize: 14, color: 'rgba(230,247,255,0.7)', lineHeight: 1.5 }}>{m.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
              {/* 右：时序图 */}
              <div className="touchkit-tile" style={{ minHeight: 0, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', fontSize: 'var(--wall-font-lg)', fontWeight:600, flexShrink: 0 }}>时序变化</div>
                <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
                  {panelSeriesLoading ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(230,247,255,0.6)' }}><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />加载中…</div>
                  ) : panelSeriesError ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ff8b9a' }}>{panelSeriesError}</div>
                  ) : panelSeries?.series?.length ? (
                    <EChartsWrapper option={panelSeriesOption} style={{ height: '100%' }} />
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(230,247,255,0.5)' }}>暂无时序数据</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </BottomSheet>

        {/* 趋势全屏：饼图 + 直方图 + 里程分段 */}
        <FullscreenFocus isOpen={showTrends} onClose={() => setShowTrends(false)} title="风险分布趋势">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div className="touchkit-tile" style={{ minHeight: 260 }}>
              <div className="touchkit-label" style={{ marginBottom: 8 }}>风险占比</div>
              {riskSummary.total > 0 ? <div style={{ height: 220 }}><EChartsWrapper option={riskPieOption} /></div> : <div style={{ color: 'rgba(230,247,255,0.5)' }}>暂无数据</div>}
            </div>
            <div className="touchkit-tile" style={{ minHeight: 260 }}>
              <div className="touchkit-label" style={{ marginBottom: 8 }}>速度分布（mm/年）</div>
              {riskStats?.velocityHist ? <div style={{ height: 220 }}><EChartsWrapper option={velocityHistOption} /></div> : <div style={{ color: 'rgba(230,247,255,0.5)' }}>暂无数据</div>}
            </div>
            <div className="touchkit-tile" style={{ minHeight: 260, gridColumn: '1 / -1' }}>
              <div className="touchkit-label" style={{ marginBottom: 8 }}>沿隧道里程风险分布</div>
              {riskStats?.chainage ? <div style={{ height: 260 }}><EChartsWrapper option={chainageChartOption} /></div> : <div style={{ color: 'rgba(230,247,255,0.5)' }}>暂无数据</div>}
            </div>
          </div>
        </FullscreenFocus>

        {/* 设置全屏（与桌面设置等价的完整能力） */}
        <FullscreenFocus isOpen={showSettings} onClose={() => setShowSettings(false)} title="设置">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
            {/* 显示模式 */}
            <div>
              <div className="touchkit-label" style={{ marginBottom: 10 }}>显示模式</div>
              <SegmentedControl
                ariaLabel="显示模式"
                value={indicator}
                onChange={(k) => setIndicator(k as Indicator)}
                items={[
                  { key: 'velocity', label: '速度' },
                  { key: 'threshold', label: '阈值分级' },
                  ...(fieldsInfo?.d_fields?.length ? [{ key: 'keyDate', label: '关键日期' }] : []),
                ]}
              />
              {indicator === 'keyDate' && fieldsInfo?.d_fields?.length ? (
                <div style={{ marginTop: 12 }}>
                  <div className="touchkit-label" style={{ marginBottom: 8 }}>关键日期字段</div>
                  <select value={keyDateField} onChange={e => setKeyDateField(e.target.value)} style={{ width: '100%', minHeight: 'var(--wall-min-target)', fontSize: 18, padding: '10px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.3)', color: '#e6f7ff', border: '1px solid var(--wall-panel-border)' }}>
                    {fieldsInfo.d_fields.map(f => <option key={f} value={f}>{formatKeyDateField(f)}</option>)}
                  </select>
                </div>
              ) : null}
            </div>
            {/* 阈值 */}
            <div>
              <div className="touchkit-label" style={{ marginBottom: 10 }}>阈值（mm/年，负=沉降）</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <LargeIconButton icon="fas fa-shield-alt" label="保守" active={thresholds.strong === 6} onClick={() => setThresholds({ strong: 6, mild: 1.5 })} />
                <LargeIconButton icon="fas fa-balance-scale" label="标准" active={thresholds.strong === 10} onClick={() => setThresholds({ strong: 10, mild: 2 })} />
                <LargeIconButton icon="fas fa-feather" label="宽松" active={thresholds.strong === 15} onClick={() => setThresholds({ strong: 15, mild: 3 })} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, color: 'rgba(230,247,255,0.8)' }}>
                  危险阈值
                  <input type="number" value={thresholds.strong} step="0.5" min="0" onChange={e => setThresholds(t => ({ ...t, strong: Number(e.target.value) || 0 }))} style={{ width: 150, minHeight: 'var(--wall-min-target)', fontSize: 18, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', color: '#e6f7ff', border: '1px solid var(--wall-panel-border)' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, color: 'rgba(230,247,255,0.8)' }}>
                  预警阈值
                  <input type="number" value={thresholds.mild} step="0.5" min="0" onChange={e => setThresholds(t => ({ ...t, mild: Number(e.target.value) || 0 }))} style={{ width: 150, minHeight: 'var(--wall-min-target)', fontSize: 18, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', color: '#e6f7ff', border: '1px solid var(--wall-panel-border)' }} />
                </label>
              </div>
            </div>
            {/* 图层 */}
            <div>
              <div className="touchkit-label" style={{ marginBottom: 10 }}>图层</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <LargeIconButton icon="fas fa-th" label="风险分区" active={showRiskGrid} onClick={() => setShowRiskGrid(v => !v)} />
                <LargeIconButton icon="fas fa-object-group" label="危险区" active={showZones} onClick={() => setShowZones(v => !v)} />
                <LargeIconButton icon="fas fa-crop" label={useBbox ? '视窗裁剪 开' : '视窗裁剪 关'} active={useBbox} onClick={() => setUseBbox(v => !v)} />
              </div>
              {showZones ? (
                <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, color: 'rgba(230,247,255,0.8)' }}>
                    聚类半径 eps（米）
                    <input type="number" value={zoneEpsM} step="10" min="10" onChange={e => setZoneEpsM(Number(e.target.value) || 0)} style={{ width: 150, minHeight: 'var(--wall-min-target)', fontSize: 18, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', color: '#e6f7ff', border: '1px solid var(--wall-panel-border)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, color: 'rgba(230,247,255,0.8)' }}>
                    最小点数 minPts
                    <input type="number" value={zoneMinPts} step="1" min="1" onChange={e => setZoneMinPts(Math.max(1, Math.round(Number(e.target.value) || 0)))} style={{ width: 150, minHeight: 'var(--wall-min-target)', fontSize: 18, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', color: '#e6f7ff', border: '1px solid var(--wall-panel-border)' }} />
                  </label>
                </div>
              ) : null}
            </div>
            {/* 数据集 */}
            <div>
              <div className="touchkit-label" style={{ marginBottom: 10 }}>数据集</div>
              <select value={dataset} onChange={e => setDataset(e.target.value)} style={{ width: '100%', minHeight: 'var(--wall-min-target)', fontSize: 18, padding: '10px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.3)', color: '#e6f7ff', border: '1px solid var(--wall-panel-border)' }}>
                {datasets.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {/* 外链地图 */}
            <div>
              <div className="touchkit-label" style={{ marginBottom: 10 }}>外部地图</div>
              <a href="http://47.96.7.238:38089/mapLayer" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 'var(--wall-min-target)', padding: '0 18px', borderRadius: 12, background: 'rgba(0,229,255,.1)', border: '1px solid var(--wall-panel-border)', color: '#7df0ff', fontSize: 17, textDecoration: 'none' }}>
                <i className="fas fa-external-link-alt" /> 在新窗口打开外链地图
              </a>
            </div>
          </div>
        </FullscreenFocus>
      </div>
    )
  }
}
