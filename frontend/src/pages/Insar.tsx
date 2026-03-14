import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE, STATIC_BASE } from '../lib/api'
import type { EChartsOption } from 'echarts'
import EChartsWrapper from '../components/charts/EChartsWrapper'
import { classifyVelocity, formatKeyDateField, toNumberOrNull, type Thresholds } from '../lib/insar'
import { kmlToBestLineStringFeature } from '../lib/kml'
import { createBuiltInBaseLayers, createRasterLayer, loadOpticalRasterLayers } from '../lib/mapLayers'
import { extractInsarContext } from '../utils/contextExtractors/insarExtractor'

type FeatureCollection = { type: 'FeatureCollection', features: any[] }
type InsarMeta = { dataset?: string, cached?: boolean, feature_count?: number, total_feature_count?: number, value_field?: string, args?: Record<string, any> }

type Indicator = 'velocity' | 'keyDate' | 'threshold'
type FieldsInfo = { dataset: string, fields: string[], d_fields: string[], velocity_fields: string[], recommended_value_field: string }
type SeriesData = { dataset: string, id: string, series: { date: string, value: number | null }[], properties?: Record<string, any> }
type RiskLevel = 'normal' | 'warning' | 'danger'
type RiskPoint = { id: string, lat: number, lng: number, velocity: number, risk: RiskLevel }
type RiskSummary = { total: number, danger: number, warning: number, normal: number, unknown: number, top: RiskPoint[] }
type VelocityHistogram = { edges: number[], counts: number[], maxAbs: number, total: number }
type VelocitySplit = { negative: number, positive: number, nearZero: number }
type ChainageStats = { labels: string[], danger: number[], warning: number[], normal: number[], binSize: number, maxDistance: number, length: number, total: number }
type RiskStats = { velocityHist: VelocityHistogram | null, velocitySplit: VelocitySplit, velocityTotal: number, chainage: ChainageStats | null }
type ZoneLevel = 'danger' | 'warning'
type ZoneDirection = 'subsidence' | 'uplift'
type ZoneSummary = { id: string, level: ZoneLevel, direction: ZoneDirection, point_count: number, min_velocity: number | null, p95_velocity: number | null, bbox?: number[] | null, centroid?: number[] | null }
type ExpertMeasure = { key: string, title: string, detail: string }
type AdviceEntry = { text: string, updatedAt: number }
type AdviceStore = { globalByDataset: Record<string, AdviceEntry>, pointByDataset: Record<string, Record<string, AdviceEntry>> }
type BaseLayerItem = { name: string, layer: L.Layer }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * clamp(p, 0, 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const t = idx - lo
  return sorted[lo] * (1 - t) + sorted[hi] * t
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function safeDatasetName(s: string) {
  const cleaned = (s || '').trim().replace(/[^a-zA-Z0-9._-]/g, '')
  return cleaned || 'yanggaozhong'
}

function valueToColor(value: number | null, maxAbs: number) {
  if (value === null || Number.isNaN(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) return '#7c8a9a'
  const v = clamp(value, -maxAbs, maxAbs)
  const n = v / maxAbs
  const t = Math.abs(n)
  if (n <= 0) return rgbToHex(lerp(255, 255, t), lerp(255, 90, t), lerp(255, 90, t))
  return rgbToHex(lerp(255, 60, t), lerp(255, 150, t), lerp(255, 255, t))
}

function riskFromVelocity(v: number | null, thresholds: Thresholds): RiskLevel {
  if (v === null || !Number.isFinite(v)) return 'normal'
  if (v <= -thresholds.strong) return 'danger'
  if (v <= -thresholds.mild) return 'warning'
  return 'normal'
}

function getFeatureId(feature: any, props: any) {
  const id = feature?.id ?? props?.id
  return id === undefined || id === null ? '' : String(id)
}

function getLatLngFromFeature(feature: any) {
  const coords = feature?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = typeof coords[0] === 'number' ? coords[0] : Number(coords[0])
  const lat = typeof coords[1] === 'number' ? coords[1] : Number(coords[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function extractLineCoords(feature: any) {
  const geom = feature?.geometry
  if (!geom) return null
  if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
    return geom.coordinates as number[][]
  }
  if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
    const lines = geom.coordinates as number[][][]
    if (!lines.length) return null
    let best: number[][] = lines[0]
    let bestLen = best.length
    for (const line of lines) {
      if (Array.isArray(line) && line.length > bestLen) {
        best = line
        bestLen = line.length
      }
    }
    return best
  }
  return null
}

function getVelocityFromProps(p: any, velocityFieldName?: string) {
  const byField = velocityFieldName ? toNumberOrNull(p?.[velocityFieldName]) : null
  return byField ?? toNumberOrNull(p?.velocity ?? p?.vel ?? p?.rate ?? p?.value)
}

function riskLabel(level: RiskLevel) {
  if (level === 'danger') return { label: '危险', color: '#ff3e5f' }
  if (level === 'warning') return { label: '预警', color: '#ff9e0d' }
  return { label: '正常', color: '#00e676' }
}

function expertMeasuresForRisk(level: RiskLevel): ExpertMeasure[] {
  if (level === 'danger') {
    return [
      { key: 'stop-dewatering', title: '停止或大幅降低降水强度', detail: '优先排查“降水-沉降”耦合影响；必要时改为分区、间歇、限流降水。' },
      { key: 'stop-excavation', title: '暂停高风险区关键工序', detail: '对掘进/开挖/卸载等强扰动作先停后评估，避免形变进一步加速。' },
      { key: 'grouting', title: '注浆加固与补强', detail: '对软弱、空洞、渗漏等敏感区开展加固，优先消减变形源。' },
      { key: 'monitoring', title: '加密监测与复核', detail: '提高监测频率，复核异常点及周边点一致性，必要时增加地面/结构监测。' },
      { key: 'emergency', title: '启动应急评审与上报', detail: '组织设计/监测/施工联席会，形成处置单并纳入工单闭环。' },
    ]
  }
  if (level === 'warning') {
    return [
      { key: 'adjust-dewatering', title: '优化降水工艺与参数', detail: '控制水位降深与降速，分区分级实施，避免突变。' },
      { key: 'process-adjust', title: '调整施工参数与步距', detail: '减少扰动、缩短暴露时间，必要时加强支护与同步注浆。' },
      { key: 'targeted-inspection', title: '重点巡检与风险点复核', detail: '对关键结构、接缝、既有线等敏感目标加强巡检与复测。' },
      { key: 'prepare', title: '准备应急材料与窗口', detail: '预先准备注浆材料、封堵与加固工装，确保可快速介入。' },
    ]
  }
  return [
    { key: 'routine', title: '保持常规监测与巡检', detail: '持续观察趋势，避免阈值设置过于宽松导致漏报。' },
    { key: 'threshold-review', title: '复核阈值与工况', detail: '阈值应与工程阶段、土体条件、邻近建构筑物敏感性匹配。' },
  ]
}

function loadAdviceStore(): AdviceStore {
  try {
    const raw = localStorage.getItem('insar_advice_v1')
    if (!raw) return { globalByDataset: {}, pointByDataset: {} }
    const obj = JSON.parse(raw)
    const globalByDataset = obj?.globalByDataset && typeof obj.globalByDataset === 'object' ? obj.globalByDataset : {}
    const pointByDataset = obj?.pointByDataset && typeof obj.pointByDataset === 'object' ? obj.pointByDataset : {}
    return { globalByDataset, pointByDataset }
  } catch {
    return { globalByDataset: {}, pointByDataset: {} }
  }
}

function InsarNativeMap(
  { dataset, indicator, valueField, velocityFieldName, thresholds, useBbox, showZones, zoneEpsM, zoneMinPts, chainageBinSize, chainageMaxDistance, onSummaryChange, onStatsChange, onZonesChange, focusId, focusZoneId, onSelectedChange }:
  {
    dataset: string,
    indicator: Indicator,
    valueField: string,
    velocityFieldName: string,
    thresholds: Thresholds,
    useBbox: boolean,
    showZones: boolean,
    zoneEpsM: number,
    zoneMinPts: number,
    chainageBinSize: number,
    chainageMaxDistance: number,
    onSummaryChange?: (summary: RiskSummary) => void,
    onStatsChange?: (stats: RiskStats) => void,
    onZonesChange?: (payload: { meta: Record<string, any> | null, top: ZoneSummary[] }) => void,
    focusId?: string | null,
    focusZoneId?: string | null,
    onSelectedChange?: (selected: { id: string, props: Record<string, any>, lat: number, lng: number } | null) => void
  }
) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const layerByIdRef = useRef<Map<string, any>>(new Map())
  const zonesLayerRef = useRef<L.GeoJSON | null>(null)
  const zonesLayerByIdRef = useRef<Map<string, any>>(new Map())
  const alertLayerRef = useRef<L.LayerGroup | null>(null)
  const tunnelLayerRef = useRef<L.GeoJSON | null>(null)
  const baseLayerRef = useRef<L.Layer | null>(null)
  const baseLayerCleanupRef = useRef<(() => void) | null>(null)
  const lastGoodBaseLayerNameRef = useRef('影像(Esri)')
  const baseLayerAutoRevertRef = useRef(false)
  const pulseTimerRef = useRef<number | null>(null)
  const pulseMarkersRef = useRef<{ marker: L.CircleMarker, base: number, amp: number }[]>([])
  const pulsePhaseRef = useRef(0)
  const lastBoundsRef = useRef<L.LatLngBounds | null>(null)
  const useBboxRef = useRef(useBbox)
  const moveendTimerRef = useRef<number | null>(null)
  const lastBboxKeyRef = useRef<string>('')

  const [data, setData] = useState<FeatureCollection | null>(null)
  const [meta, setMeta] = useState<InsarMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<{ id: string, props: Record<string, any>, lat: number, lng: number } | null>(null)
  const [series, setSeries] = useState<SeriesData | null>(null)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [bboxToken, setBboxToken] = useState(0)
  const [baseLayers, setBaseLayers] = useState<BaseLayerItem[]>([])
  const [baseLayerName, setBaseLayerName] = useState('影像(Esri)')
  const [opticalCount, setOpticalCount] = useState(0)
  const [baseLayerError, setBaseLayerError] = useState<string | null>(null)
  const [zonesData, setZonesData] = useState<FeatureCollection | null>(null)
  const [zonesMeta, setZonesMeta] = useState<Record<string, any> | null>(null)
  const [zonesLoading, setZonesLoading] = useState(false)
  const [zonesError, setZonesError] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<ZoneSummary | null>(null)
  const [tunnelLineCoords, setTunnelLineCoords] = useState<number[][] | null>(null)

  useEffect(() => {
    useBboxRef.current = useBbox
  }, [useBbox])

  useEffect(() => {
    if (!showZones) {
      setZonesData(null)
      setZonesMeta(null)
      setZonesError(null)
      setSelectedZone(null)
      onZonesChange?.({ meta: null, top: [] })
    }
  }, [showZones, onZonesChange])

  const maxAbs = useMemo(() => {
    if (!data?.features?.length) return 20
    const absVals = data.features
      .map((f: any) => {
        const p = f?.properties || {}
        const v = p.value
        const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN)
        return Number.isFinite(n) ? Math.abs(n) : null
      })
      .filter((v: any) => typeof v === 'number') as number[]
    if (!absVals.length) return 20
    absVals.sort((a, b) => a - b)
    const p95 = percentile(absVals, 0.95)
    const cap = Math.max(p95, absVals[absVals.length - 1] || 0)
    return Math.max(5, Math.min(200, Math.round(cap || 20)))
  }, [data])

  const riskSummary = useMemo((): RiskSummary => {
    const features = data?.features
    if (!Array.isArray(features) || !features.length) return { total: 0, danger: 0, warning: 0, normal: 0, unknown: 0, top: [] }
    let danger = 0
    let warning = 0
    let normal = 0
    let unknown = 0
    const candidates: RiskPoint[] = []

    for (const f of features) {
      const p: any = f?.properties || {}
      const id = getFeatureId(f, p)
      const velocity = getVelocityFromProps(p, velocityFieldName)
      if (velocity === null) {
        unknown += 1
        normal += 1
        continue
      }
      const risk = riskFromVelocity(velocity, thresholds)
      if (risk === 'danger') danger += 1
      else if (risk === 'warning') warning += 1
      else normal += 1
      if (risk !== 'normal') {
        const ll = getLatLngFromFeature(f)
        if (ll) candidates.push({ id, lat: ll.lat, lng: ll.lng, velocity, risk })
      }
    }

    candidates.sort((a, b) => a.velocity - b.velocity)
    const top = candidates.slice(0, 30)
    return { total: features.length, danger, warning, normal, unknown, top }
  }, [data, thresholds])

  const riskStats = useMemo((): RiskStats => {
    const features = data?.features
    if (!Array.isArray(features) || !features.length) {
      return { velocityHist: null, velocitySplit: { negative: 0, positive: 0, nearZero: 0 }, velocityTotal: 0, chainage: null }
    }
    const velocities: number[] = []
    let negative = 0
    let positive = 0
    let nearZero = 0
    const mild = Math.abs(thresholds.mild || 0)
    for (const f of features) {
      const p: any = f?.properties || {}
      const v = getVelocityFromProps(p, velocityFieldName)
      if (v === null || !Number.isFinite(v)) continue
      velocities.push(v)
      if (v <= -mild) negative += 1
      else if (v >= mild) positive += 1
      else nearZero += 1
    }
    const chainage = (() => {
      if (!tunnelLineCoords || tunnelLineCoords.length < 2) return null
      const latSum = tunnelLineCoords.reduce((sum, c) => sum + (Number(c?.[1]) || 0), 0)
      const lat0 = tunnelLineCoords.length ? latSum / tunnelLineCoords.length : 0
      const rad = Math.PI / 180
      const cosLat = Math.cos(lat0 * rad)
      const project = (lng: number, lat: number) => {
        const x = 6378137 * (lng * rad) * cosLat
        const y = 6378137 * (lat * rad)
        return { x, y }
      }
      const lineMeters = tunnelLineCoords
        .map((c) => ({ lng: Number(c?.[0]), lat: Number(c?.[1]) }))
        .filter((c) => Number.isFinite(c.lng) && Number.isFinite(c.lat))
        .map((c) => project(c.lng, c.lat))
      if (lineMeters.length < 2) return null
      const segLengths: number[] = []
      const cumLengths: number[] = [0]
      for (let i = 0; i < lineMeters.length - 1; i += 1) {
        const a = lineMeters[i]
        const b = lineMeters[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy)
        segLengths.push(len)
        cumLengths.push(cumLengths[cumLengths.length - 1] + len)
      }
      const totalLength = cumLengths[cumLengths.length - 1] || 0
      if (totalLength <= 0) return null
      const binSize = Math.max(10, Math.round(chainageBinSize || 50))
      const maxDistance = Math.max(10, Math.round(chainageMaxDistance || 200))
      const binCount = Math.max(1, Math.ceil(totalLength / binSize))
      const labels = new Array(binCount).fill(0).map((_, i) => `${i * binSize}-${(i + 1) * binSize}m`)
      const danger = new Array(binCount).fill(0)
      const warning = new Array(binCount).fill(0)
      const normal = new Array(binCount).fill(0)
      let total = 0
      for (const f of features) {
        const ll = getLatLngFromFeature(f)
        if (!ll) continue
        const p = f?.properties || {}
        const v = getVelocityFromProps(p, velocityFieldName)
        if (v === null || !Number.isFinite(v)) continue
        const pt = project(ll.lng, ll.lat)
        let bestDist = Number.POSITIVE_INFINITY
        let bestChainage = 0
        for (let i = 0; i < lineMeters.length - 1; i += 1) {
          const a = lineMeters[i]
          const b = lineMeters[i + 1]
          const abx = b.x - a.x
          const aby = b.y - a.y
          const apx = pt.x - a.x
          const apy = pt.y - a.y
          const abLen2 = abx * abx + aby * aby
          if (abLen2 <= 0) continue
          let t = (apx * abx + apy * aby) / abLen2
          if (t < 0) t = 0
          if (t > 1) t = 1
          const projx = a.x + abx * t
          const projy = a.y + aby * t
          const dist = Math.hypot(pt.x - projx, pt.y - projy)
          if (dist < bestDist) {
            bestDist = dist
            bestChainage = cumLengths[i] + segLengths[i] * t
          }
        }
        if (!Number.isFinite(bestDist) || bestDist > maxDistance) continue
        const idx = Math.min(binCount - 1, Math.max(0, Math.floor(bestChainage / binSize)))
        const risk = riskFromVelocity(v, thresholds)
        if (risk === 'danger') danger[idx] += 1
        else if (risk === 'warning') warning[idx] += 1
        else normal[idx] += 1
        total += 1
      }
      return { labels, danger, warning, normal, binSize, maxDistance, length: totalLength, total }
    })()

    if (!velocities.length) {
      return { velocityHist: null, velocitySplit: { negative, positive, nearZero }, velocityTotal: 0, chainage }
    }
    const absVals = velocities.map((v) => Math.abs(v)).filter((v) => Number.isFinite(v))
    absVals.sort((a, b) => a - b)
    const p95 = percentile(absVals, 0.95)
    const cap = Math.max(p95, absVals[absVals.length - 1] || 0)
    const maxAbs = Math.max(5, Math.min(200, Math.round(cap || 20)))
    const bins = 12
    const start = -maxAbs
    const end = maxAbs
    const size = (end - start) / bins
    const counts = new Array(bins).fill(0)
    for (const v of velocities) {
      const clamped = clamp(v, start, end)
      let idx = Math.floor((clamped - start) / size)
      if (idx < 0) idx = 0
      if (idx >= bins) idx = bins - 1
      counts[idx] += 1
    }
    const edges = counts.map((_, i) => start + size * (i + 0.5))
    return {
      velocityHist: { edges, counts, maxAbs, total: velocities.length },
      velocitySplit: { negative, positive, nearZero },
      velocityTotal: velocities.length,
      chainage,
    }
  }, [data, thresholds, velocityFieldName, tunnelLineCoords, chainageBinSize, chainageMaxDistance])

  useEffect(() => {
    onSummaryChange?.(riskSummary)
  }, [onSummaryChange, riskSummary])

  useEffect(() => {
    onStatsChange?.(riskStats)
  }, [onStatsChange, riskStats])

  useEffect(() => {
    onSelectedChange?.(selected)
  }, [onSelectedChange, selected])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const safeDataset = safeDatasetName(dataset)
    const map = mapRef.current
    const bbox = useBbox && map ? map.getBounds() : null
    const bboxParam = bbox ? `&bbox=${encodeURIComponent(`${bbox.getWest()},${bbox.getSouth()},${bbox.getEast()},${bbox.getNorth()}`)}` : ''
    const fieldParam = valueField ? `&field=${encodeURIComponent(valueField)}` : ''
    const apiUrl = `${API_BASE}/insar/points?dataset=${encodeURIComponent(safeDataset)}${fieldParam}${bboxParam}`

    const fetchJson = async (url: string) => {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`请求失败：${res.status}`)
      return res.json()
    }

    ;(async () => {
      try {
        const body = await fetchJson(apiUrl).catch(() => null as any)
        if (body && typeof body === 'object' && body.status && body.status !== 'success') {
          const msg = body?.message || '加载失败'
          const hint = body?.hint || ''
          throw new Error(`${msg}${hint ? `\n${hint}` : ''}`)
        }
        if (!mounted) return
        let nextMeta: InsarMeta | null = body?.meta && typeof body.meta === 'object' ? body.meta : null
        let nextData: FeatureCollection | null = body?.data && typeof body.data === 'object' ? body.data : (body as any)
        const MAX_RENDER_FEATURES = 50000
        const nextFeatures = (nextData as any)?.features
        if (Array.isArray(nextFeatures) && nextFeatures.length > MAX_RENDER_FEATURES) {
          nextData = { ...(nextData as any), features: nextFeatures.slice(0, MAX_RENDER_FEATURES) }
          const total = nextMeta?.total_feature_count ?? nextFeatures.length
          nextMeta = { ...(nextMeta || {}), total_feature_count: total, feature_count: MAX_RENDER_FEATURES }
        }
        setMeta(nextMeta)
        setData(nextData)
        setSelected(null)
        setSeries(null)
        setSeriesError(null)

        // 提取并缓存页面上下文
        if (nextData) {
          try {
            extractInsarContext(nextData)
          } catch (err) {
            console.error('Failed to extract InSAR context:', err)
          }
        }
      } catch (e: any) {
        if (!mounted) return
        if (e?.name === 'AbortError') return
        setError(e?.message || '加载失败')
        setData(null)
        setMeta(null)
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
      controller.abort()
    }
  }, [dataset, valueField, useBbox, bboxToken])

  useEffect(() => {
    if (!showZones) return
    let mounted = true
    const controller = new AbortController()
    setZonesLoading(true)
    setZonesError(null)
    const safeDataset = safeDatasetName(dataset)
    const map = mapRef.current
    const bbox = useBbox && map ? map.getBounds() : null
    const bboxParam = bbox ? `&bbox=${encodeURIComponent(`${bbox.getWest()},${bbox.getSouth()},${bbox.getEast()},${bbox.getNorth()}`)}` : ''
    const apiUrl = `${API_BASE}/insar/zones?dataset=${encodeURIComponent(safeDataset)}&field=${encodeURIComponent(velocityFieldName || '')}&mild=${encodeURIComponent(String(thresholds.mild))}&strong=${encodeURIComponent(String(thresholds.strong))}&eps_m=${encodeURIComponent(String(zoneEpsM))}&min_pts=${encodeURIComponent(String(zoneMinPts))}${bboxParam}`

    ;(async () => {
      try {
        const res = await fetch(apiUrl, { signal: controller.signal })
        const body = await res.json().catch(() => null as any)
        if (!res.ok) throw new Error(body?.message || `请求失败：${res.status}`)
        if (body && typeof body === 'object' && body.status && body.status !== 'success') {
          const msg = body?.message || '加载失败'
          const hint = body?.hint || ''
          throw new Error(`${msg}${hint ? `\n${hint}` : ''}`)
        }
        if (!mounted) return
        const nextMeta = body?.meta && typeof body.meta === 'object' ? body.meta : null
        const nextData: FeatureCollection | null = body?.data && typeof body.data === 'object' ? body.data : null
        setZonesMeta(nextMeta)
        setZonesData(nextData)

        const features = Array.isArray(nextData?.features) ? nextData!.features : []
        const top: ZoneSummary[] = features
          .map((f: any) => {
            const p = f?.properties || {}
            const id = String(p.zone_id ?? f?.id ?? '')
            const level = (p.level === 'danger' ? 'danger' : 'warning') as ZoneLevel
            const direction = (p.direction === 'uplift' ? 'uplift' : 'subsidence') as ZoneDirection
            const point_count = typeof p.point_count === 'number' ? p.point_count : Number(p.point_count) || 0
            const min_velocity = typeof p.min_velocity === 'number' ? p.min_velocity : (typeof p.min_velocity === 'string' ? Number(p.min_velocity) : null)
            const p95_velocity = typeof p.p95_velocity === 'number' ? p.p95_velocity : (typeof p.p95_velocity === 'string' ? Number(p.p95_velocity) : null)
            const bbox = Array.isArray(p.bbox) ? p.bbox : null
            const centroid = Array.isArray(p.centroid) ? p.centroid : null
            return { id, level, direction, point_count, min_velocity: Number.isFinite(min_velocity as any) ? (min_velocity as any) : null, p95_velocity: Number.isFinite(p95_velocity as any) ? (p95_velocity as any) : null, bbox, centroid }
          })
          .filter((z) => z.id)

        top.sort((a, b) => {
          const av = a.min_velocity ?? 0
          const bv = b.min_velocity ?? 0
          if (av !== bv) return av - bv
          return (b.point_count || 0) - (a.point_count || 0)
        })
        onZonesChange?.({ meta: nextMeta, top: top.slice(0, 30) })
      } catch (e: any) {
        if (!mounted) return
        if (e?.name === 'AbortError') return
        setZonesError(e?.message || '加载失败')
        setZonesData(null)
        setZonesMeta(null)
        onZonesChange?.({ meta: null, top: [] })
      } finally {
        if (!mounted) return
        setZonesLoading(false)
      }
    })()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [showZones, dataset, velocityFieldName, thresholds.mild, thresholds.strong, zoneEpsM, zoneMinPts, useBbox, bboxToken, onZonesChange])

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    }).setView([31.245, 121.575], 14)

    const builtIn = createBuiltInBaseLayers()
    const builtInItems = Object.entries(builtIn).map(([name, layer]) => ({ name, layer }))
    setBaseLayers(builtInItems)
    const initialLayer = builtIn[baseLayerName] || builtIn['影像(Esri)'] || Object.values(builtIn)[0] || null
    if (initialLayer) {
      initialLayer.addTo(map)
      baseLayerRef.current = initialLayer
      lastGoodBaseLayerNameRef.current = baseLayerName
    }

    const baseAbort = new AbortController()
    ;(async () => {
      const defs = await loadOpticalRasterLayers(baseAbort.signal)
      if (baseAbort.signal.aborted) return
      const items: BaseLayerItem[] = []
      for (const def of defs) {
        const layer = createRasterLayer(def)
        if (!layer) continue
        items.push({ name: def.name, layer })
      }
      setOpticalCount(items.length)
      if (items.length) setBaseLayers((prev) => [...prev, ...items])
      const preferred = defs.find((x) => x.default)
      if (preferred) setBaseLayerName(preferred.name)
    })()

    map.createPane('insarZones')
    map.createPane('insarPoints')
    map.createPane('tunnelAlignment')
    const zonesPane = map.getPane('insarZones')
    const pointsPane = map.getPane('insarPoints')
    const tunnelPane = map.getPane('tunnelAlignment')
    if (zonesPane) zonesPane.style.zIndex = '380'
    if (pointsPane) pointsPane.style.zIndex = '420'
    if (tunnelPane) tunnelPane.style.zIndex = '410'

    mapRef.current = map
    const alertLayer = L.layerGroup().addTo(map)
    alertLayerRef.current = alertLayer
    ;(async () => {
      try {
        const res = await fetch(`${STATIC_BASE}/static/data/tunnel/YGL_KML.kml`)
        if (!res.ok) return
        const text = await res.text()
        const feat = kmlToBestLineStringFeature(text)
        if (!feat) return
        const coords = extractLineCoords(feat)
        setTunnelLineCoords(coords || null)
        if (tunnelLayerRef.current) {
          tunnelLayerRef.current.remove()
          tunnelLayerRef.current = null
        }
        const layer = L.geoJSON(feat as any, {
          pane: 'tunnelAlignment',
          style: { color: '#f97316', weight: 4, opacity: 15 },
        })
        layer.addTo(map)
        tunnelLayerRef.current = layer
      } catch {
      }
    })()
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)
    const handleMoveEnd = () => {
      if (!useBboxRef.current) return
      const b = map.getBounds()
      const key = [
        b.getWest().toFixed(5),
        b.getSouth().toFixed(5),
        b.getEast().toFixed(5),
        b.getNorth().toFixed(5)
      ].join(',')
      if (key === lastBboxKeyRef.current) return
      lastBboxKeyRef.current = key
      if (moveendTimerRef.current) window.clearTimeout(moveendTimerRef.current)
      moveendTimerRef.current = window.setTimeout(() => {
        setBboxToken((n) => n + 1)
      }, 200)
    }
    map.on('moveend', handleMoveEnd)
    return () => {
      baseAbort.abort()
      if (baseLayerCleanupRef.current) {
        baseLayerCleanupRef.current()
        baseLayerCleanupRef.current = null
      }
      window.removeEventListener('resize', handleResize)
      map.off('moveend', handleMoveEnd)
      if (moveendTimerRef.current) window.clearTimeout(moveendTimerRef.current)
      if (pulseTimerRef.current) window.clearInterval(pulseTimerRef.current)
      pulseTimerRef.current = null
      pulseMarkersRef.current = []
      alertLayerRef.current = null
      if (tunnelLayerRef.current) {
        tunnelLayerRef.current.remove()
        tunnelLayerRef.current = null
      }
      setTunnelLineCoords(null)
      baseLayerRef.current = null
      map.remove()
      mapRef.current = null
      layerRef.current = null
      zonesLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const next = baseLayers.find((x) => x.name === baseLayerName)?.layer || null
    if (!next) return
    setBaseLayerError(null)
    if (baseLayerCleanupRef.current) {
      baseLayerCleanupRef.current()
      baseLayerCleanupRef.current = null
    }
    const prev = baseLayerRef.current
    try {
      if (prev === next) return
      next.addTo(map)
      if (prev && map.hasLayer(prev)) map.removeLayer(prev)
      baseLayerRef.current = next
      baseLayerAutoRevertRef.current = false

      const anyNext: any = next as any
      if (anyNext && typeof anyNext.on === 'function') {
        const recentErrors: number[] = []
        const onLoad = () => {
          lastGoodBaseLayerNameRef.current = baseLayerName
        }
        const onTileError = () => {
          const now = Date.now()
          recentErrors.push(now)
          while (recentErrors.length && now - recentErrors[0] > 2000) recentErrors.shift()
          if (recentErrors.length < 3) return
          if (baseLayerAutoRevertRef.current) return
          baseLayerAutoRevertRef.current = true
          setBaseLayerError('瓦片加载失败：本地目录可能没有瓦片文件，或 URL 模板不匹配（x/y/z、后缀、tms）。')
          try {
            if (map.hasLayer(next)) map.removeLayer(next)
          } catch {
          }
          const fallbackName = lastGoodBaseLayerNameRef.current || '影像(Esri)'
          if (fallbackName && fallbackName !== baseLayerName) {
            setBaseLayerName(fallbackName)
          }
        }
        anyNext.on('tileerror', onTileError)
        anyNext.on('load', onLoad)
        baseLayerCleanupRef.current = () => {
          try {
            anyNext.off('tileerror', onTileError)
            anyNext.off('load', onLoad)
          } catch {
          }
        }
      }
    } catch (e: any) {
      try {
        if (next && map.hasLayer(next)) map.removeLayer(next)
      } catch {
      }
      if (prev && !map.hasLayer(prev)) {
        try {
          prev.addTo(map)
        } catch {
        }
      }
      setBaseLayerError(e?.message || '切换底图失败')
    }
  }, [baseLayerName, baseLayers])

  useEffect(() => {
    const pointId = selectedPoint?.id || selected?.id
    if (!pointId) return
    let mounted = true
    const controller = new AbortController()
    setSeriesLoading(true)
    setSeriesError(null)
    const safeDataset = safeDatasetName(dataset)
    const url = `${API_BASE}/insar/series?dataset=${encodeURIComponent(safeDataset)}&id=${encodeURIComponent(pointId)}`
    ;(async () => {
      try {
        const res = await fetch(url, { signal: controller.signal })
        const body = await res.json().catch(() => null as any)
        if (!res.ok) throw new Error(body?.message || `请求失败：${res.status}`)
        if (body && typeof body === 'object' && body.status && body.status !== 'success') {
          throw new Error(body?.message || '加载失败')
        }
        if (!mounted) return
        const nextSeries: SeriesData | null = body?.data && typeof body.data === 'object' ? body.data : null
        setSeries(nextSeries)
      } catch (e: any) {
        if (!mounted) return
        if (e?.name === 'AbortError') return
        setSeries(null)
        setSeriesError(e?.message || '加载失败')
      } finally {
        if (!mounted) return
        setSeriesLoading(false)
      }
    })()
    return () => {
      mounted = false
      controller.abort()
    }
  }, [dataset, selected?.id, selectedPoint?.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }
    layerByIdRef.current = new Map()

    if (!data) return

    const layer = L.geoJSON(data as any, {
      pointToLayer: (feature, latlng) => {
        const p: any = (feature as any)?.properties || {}
        const raw = p.value ?? (p.value_field ? p[p.value_field] : null)
        const v = toNumberOrNull(raw)
        const color =
          indicator === 'threshold'
            ? classifyVelocity(toNumberOrNull(p.value ?? p.velocity ?? p.vel ?? p.rate), thresholds).color
            : valueToColor(v, maxAbs)
        return L.circleMarker(latlng, {
          radius: 5,
          color,
          fillColor: color,
          fillOpacity: 0.75,
          weight: 1,
          pane: 'insarPoints',
        })
      },
      onEachFeature: (feature, l) => {
        const p: any = (feature as any)?.properties || {}
        const v = p.value ?? (p.value_field ? p[p.value_field] : undefined)
        const id = (feature as any)?.id ?? p.id ?? ''
        const velocity = toNumberOrNull(p.velocity ?? p.vel ?? p.rate)
        const cls = classifyVelocity(velocity, thresholds)
        const idKey = id === undefined || id === null ? '' : String(id)
        if (idKey) layerByIdRef.current.set(idKey, l)
        const lines = [
          id !== '' ? `<div><b>ID</b>: ${String(id)}</div>` : '',
          v !== undefined ? `<div><b>${indicator === 'keyDate' ? '位移' : (indicator === 'velocity' ? '速度' : '速度')}</b>: ${String(v)}</div>` : '',
          indicator === 'threshold' ? `<div><b>分级</b>: <span style="color:${cls.color}">${cls.label}</span></div>` : '',
        ].filter(Boolean).join('')
        l.bindPopup(`<div style="min-width:180px">${lines || '<div>无属性</div>'}</div>`)
        l.on('click', (e: any) => {
          const ll = e?.latlng || (typeof (l as any).getLatLng === 'function' ? (l as any).getLatLng() : null)
          setSelected({ id: String(id), props: p, lat: Number(ll?.lat) || 0, lng: Number(ll?.lng) || 0 })
        })
      },
    })

    layer.addTo(map)
    layerRef.current = layer

    try {
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        lastBoundsRef.current = bounds
        if (!useBboxRef.current) {
          const cur = map.getBounds()
          if (!cur?.isValid() || !cur.contains(bounds)) map.fitBounds(bounds.pad(0.1), { animate: false })
        }
      }
    } catch {
    }
  }, [data, maxAbs, indicator, thresholds])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (zonesLayerRef.current) {
      zonesLayerRef.current.remove()
      zonesLayerRef.current = null
    }
    zonesLayerByIdRef.current = new Map()

    if (!showZones || !zonesData) return

    const selectedZoneId = selectedZone?.id ? String(selectedZone.id) : ''
    const layer = L.geoJSON(zonesData as any, {
      pane: 'insarZones',
      style: (feature: any) => {
        const p: any = feature?.properties || {}
        const level: ZoneLevel = p?.level === 'danger' ? 'danger' : 'warning'
        const direction: ZoneDirection = p?.direction === 'uplift' ? 'uplift' : 'subsidence'
        const baseColor =
          direction === 'uplift'
            ? (level === 'danger' ? '#a855f7' : '#3b82f6')
            : (level === 'danger' ? '#ff3e5f' : '#ff9e0d')
        const zid = String(p.zone_id ?? feature?.id ?? '')
        const active = selectedZoneId && zid === selectedZoneId
        return { color: baseColor, weight: active ? 3 : 2, opacity: 15, fillColor: baseColor, fillOpacity: active ? 0.20 : 0.12 }
      },
      onEachFeature: (feature: any, l: any) => {
        const p: any = feature?.properties || {}
        const zid = String(p.zone_id ?? feature?.id ?? '')
        if (zid) zonesLayerByIdRef.current.set(zid, l)
        const level: ZoneLevel = p?.level === 'danger' ? 'danger' : 'warning'
        const direction: ZoneDirection = p?.direction === 'uplift' ? 'uplift' : 'subsidence'
        const lines = [
          zid ? `<div><b>Zone</b>: ${zid}</div>` : '',
          `<div><b>方向</b>: ${direction === 'uplift' ? '抬升' : '沉降'}</div>`,
          `<div><b>等级</b>: ${level === 'danger' ? '显著' : '轻微'}</div>`,
          p.point_count !== undefined ? `<div><b>点数</b>: ${String(p.point_count)}</div>` : '',
          p.min_velocity !== undefined ? `<div><b>min速度</b>: ${String(p.min_velocity)}</div>` : '',
          p.p95_velocity !== undefined ? `<div><b>p95速度</b>: ${String(p.p95_velocity)}</div>` : '',
        ].filter(Boolean).join('')
        l.bindPopup(`<div style="min-width:180px">${lines || '<div>无属性</div>'}</div>`)
        l.on('click', () => {
          const point_count = typeof p.point_count === 'number' ? p.point_count : Number(p.point_count) || 0
          const min_velocity = typeof p.min_velocity === 'number' ? p.min_velocity : (typeof p.min_velocity === 'string' ? Number(p.min_velocity) : null)
          const p95_velocity = typeof p.p95_velocity === 'number' ? p.p95_velocity : (typeof p.p95_velocity === 'string' ? Number(p.p95_velocity) : null)
          const bbox = Array.isArray(p.bbox) ? p.bbox : null
          const centroid = Array.isArray(p.centroid) ? p.centroid : null
          setSelectedZone({
            id: zid,
            level,
            direction,
            point_count,
            min_velocity: Number.isFinite(min_velocity as any) ? (min_velocity as any) : null,
            p95_velocity: Number.isFinite(p95_velocity as any) ? (p95_velocity as any) : null,
            bbox,
            centroid
          })
        })
      },
    })

    layer.addTo(map)
    zonesLayerRef.current = layer
  }, [showZones, zonesData, selectedZone?.id])

  useEffect(() => {
    const id = focusId ? String(focusId) : ''
    if (!id) return
    const map = mapRef.current
    const l = layerByIdRef.current.get(id)
    if (!map || !l) return
    const latlng = typeof l.getLatLng === 'function' ? l.getLatLng() : null
    if (latlng) {
      const nextZoom = Math.max(map.getZoom() || 0, 16)
      map.setView(latlng, nextZoom, { animate: true })
    }
    if (typeof l.openPopup === 'function') l.openPopup()
    const p: any = l?.feature?.properties || {}
    const ll = typeof l.getLatLng === 'function' ? l.getLatLng() : null
    setSelected({ id, props: p, lat: Number(ll?.lat) || 0, lng: Number(ll?.lng) || 0 })
  }, [focusId, data])

  useEffect(() => {
    const id = focusZoneId ? String(focusZoneId) : ''
    if (!id) return
    const map = mapRef.current
    const l = zonesLayerByIdRef.current.get(id)
    if (!map || !l) return
    try {
      const b = typeof l.getBounds === 'function' ? l.getBounds() : null
      if (b && b.isValid()) map.fitBounds(b.pad(0.2), { animate: true })
    } catch {
    }
    if (typeof l.openPopup === 'function') l.openPopup()
    const p: any = l?.feature?.properties || {}
    const level: ZoneLevel = p?.level === 'danger' ? 'danger' : 'warning'
    const direction: ZoneDirection = p?.direction === 'uplift' ? 'uplift' : 'subsidence'
    const point_count = typeof p.point_count === 'number' ? p.point_count : Number(p.point_count) || 0
    const min_velocity = typeof p.min_velocity === 'number' ? p.min_velocity : (typeof p.min_velocity === 'string' ? Number(p.min_velocity) : null)
    const p95_velocity = typeof p.p95_velocity === 'number' ? p.p95_velocity : (typeof p.p95_velocity === 'string' ? Number(p.p95_velocity) : null)
    const bbox = Array.isArray(p.bbox) ? p.bbox : null
    const centroid = Array.isArray(p.centroid) ? p.centroid : null
    setSelectedZone({ id, level, direction, point_count, min_velocity: Number.isFinite(min_velocity as any) ? (min_velocity as any) : null, p95_velocity: Number.isFinite(p95_velocity as any) ? (p95_velocity as any) : null, bbox, centroid })
  }, [focusZoneId, zonesData])

  useEffect(() => {
    const map = mapRef.current
    const alertLayer = alertLayerRef.current
    if (!map || !alertLayer) return

    if (pulseTimerRef.current) window.clearInterval(pulseTimerRef.current)
    pulseTimerRef.current = null
    pulseMarkersRef.current = []
    pulsePhaseRef.current = 0
    alertLayer.clearLayers()

    const top = riskSummary.top.slice(0, 20)
    if (!top.length) return

    const markers: { marker: L.CircleMarker, base: number, amp: number }[] = []
    for (const p of top) {
      const color = p.risk === 'danger' ? '#ff3e5f' : '#ff9e0d'
      const base = p.risk === 'danger' ? 10 : 8
      const amp = p.risk === 'danger' ? 10 : 8
      const m = L.circleMarker([p.lat, p.lng], {
        radius: base,
        color,
        weight: 2,
        opacity: 1,
        fillOpacity: 0,
        interactive: false,
      })
      m.addTo(alertLayer)
      markers.push({ marker: m, base, amp })
    }
    pulseMarkersRef.current = markers

    pulseTimerRef.current = window.setInterval(() => {
      const list = pulseMarkersRef.current
      if (!list.length) return
      pulsePhaseRef.current = (pulsePhaseRef.current + 0.045) % 1
      const t = pulsePhaseRef.current
      const k = 1 - t
      for (const x of list) {
        x.marker.setRadius(x.base + x.amp * t)
        x.marker.setStyle({ opacity: 15 * k, fillOpacity: 0 })
      }
    }, 60)
  }, [riskSummary.top])

  const featureCount = meta?.feature_count ?? (data?.features?.length || 0)
  const resolvedValueField = meta?.value_field || valueField || (data?.features?.[0]?.properties?.value_field as string | undefined) || 'value'
  const unit = indicator === 'velocity' || indicator === 'threshold' ? 'mm/年' : 'mm'
  const legendLeft = indicator === 'threshold' ? null : valueToColor(-maxAbs, maxAbs)
  const legendRight = indicator === 'threshold' ? null : valueToColor(maxAbs, maxAbs)
  const thresholdLegendItems = useMemo(() => {
    const strong = Math.abs(thresholds.strong || 0)
    const mild = Math.abs(thresholds.mild || 0)
    const between = (strong + mild) / 2
    const colorStrongNeg = classifyVelocity(-Math.max(strong, 0.0001), thresholds).color
    const colorMildNeg = classifyVelocity(-Math.max(between, 0.0001), thresholds).color
    const colorStable = classifyVelocity(0, thresholds).color
    const colorMildPos = classifyVelocity(Math.max(between, 0.0001), thresholds).color
    const colorStrongPos = classifyVelocity(Math.max(strong, 0.0001), thresholds).color
    const colorUnknown = classifyVelocity(null, thresholds).color
    return [
      { label: `红：显著沉降（≤ -${strong}）`, color: colorStrongNeg },
      { label: `橙：轻微沉降（-${strong} ~ -${mild}）`, color: colorMildNeg },
      { label: `绿：稳定（-${mild} ~ ${mild}）`, color: colorStable },
      { label: `蓝：轻微抬升（${mild} ~ ${strong}）`, color: colorMildPos },
      { label: `紫：显著抬升（≥ ${strong}）`, color: colorStrongPos },
      { label: '灰：未知/无数据', color: colorUnknown },
    ]
  }, [thresholds])

  const seriesOption = useMemo((): EChartsOption => {
    const s = series?.series || []
    if (!s.length) {
      return { title: { text: selected?.id ? '暂无时序数据' : '选择点位查看时序', left: 'center', top: 'center', textStyle: { color: '#888', fontSize: 14 } } }
    }
    const dates = s.map((x) => x.date)
    const values = s.map((x) => x.value)
    return {
      title: { text: `点位：${series?.id || selected?.id || ''}`, left: 'center', textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: '10%', right: '8%', bottom: '18%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', name: 'mm', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      series: [{ name: 'D', type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2 }, itemStyle: { color: '#00e5ff' } }],
      animationDuration: 600
    }
  }, [series?.id, series?.series, selected?.id])

  return (
    <div style={{ position: 'relative', width: '100%', height: '70vh' }}>
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(64,174,255,.3)' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 500, padding: 10, borderRadius: 8, background: 'rgba(10,25,47,.78)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff', width: 280, maxWidth: 'calc(100% - 24px)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>原生图层</div>
        <div style={{ fontSize: 12, opacity: 1, marginBottom: 10 }}>
          <div style={{ marginBottom: 6 }}>底图/影像</div>
          <select
            value={baseLayerName}
            onChange={(e) => setBaseLayerName(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,.25)', color: '#aaddff', border: '1px solid rgba(64,174,255,.35)', borderRadius: 6, padding: '4px 6px' }}
          >
            {baseLayers.map((x) => (
              <option key={x.name} value={x.name}>{x.name}</option>
            ))}
          </select>
          <div style={{ marginTop: 6, opacity: 1 }}>光学配置：{opticalCount} 层（来自 /static/data/optical/layers.json）</div>
          {baseLayerError ? <div style={{ marginTop: 6, color: '#ff8b8b', opacity: 15, whiteSpace: 'pre-wrap' }}>{baseLayerError}</div> : null}
        </div>
        <div style={{ fontSize: 12, opacity: 1, marginBottom: 6 }}>点数：{featureCount}{meta?.total_feature_count ? ` / ${meta.total_feature_count}` : ''}{meta?.cached ? '（缓存）' : ''}</div>
          <div style={{ fontSize: 12, opacity: 1, marginBottom: 6 }}>字段：{resolvedValueField}{unit ? `（${unit}）` : ''}</div>
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>图例（颜色点含义）</div>
        {indicator !== 'threshold' ? (
          <>
            <div style={{ fontSize: 12, opacity: 1, marginBottom: 8 }}>色标范围：±{maxAbs}</div>
            <div style={{ fontSize: 12, opacity: 1, marginBottom: 6 }}>左红=沉降（负），中白=0，右蓝=抬升（正）</div>
            <div style={{ height: 10, borderRadius: 6, border: '1px solid rgba(64,174,255,.25)', background: `linear-gradient(90deg, ${legendLeft || '#7c8a9a'} 0%, #ffffff 50%, ${legendRight || '#7c8a9a'} 100%)` }} />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, fontSize: 12, opacity: 1 }}>
              <span>-{maxAbs}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>0</span>
              <span>{maxAbs}</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, opacity: 1, marginBottom: 8 }}>阈值分级（单位：mm/年，负=沉降）</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {thresholdLegendItems.map((x) => (
                <div key={`${x.label}-${x.color}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: x.color, border: '1px solid rgba(255,255,255,.15)' }} />
                  <span style={{ fontSize: 12, opacity: 15 }}>{x.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          disabled={!lastBoundsRef.current}
          onClick={() => {
            const map = mapRef.current
            const b = lastBoundsRef.current
            if (map && b && b.isValid()) map.fitBounds(b.pad(0.1))
          }}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid rgba(64,174,255,.35)',
            background: lastBoundsRef.current ? 'rgba(64,174,255,.12)' : 'rgba(255,255,255,.05)',
            color: '#aaddff',
            cursor: lastBoundsRef.current ? 'pointer' : 'not-allowed',
          }}
        >
          定位到数据范围
        </button>
        {loading ? <div style={{ marginTop: 8, fontSize: 12, opacity: 1 }}>加载中…</div> : null}
        {error ? <div style={{ marginTop: 8, fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap' }}>{error}</div> : null}
      </div>

      {selected ? (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 550, width: 360, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)', overflow: 'auto', padding: 12, borderRadius: 10, background: 'rgba(10,25,47,.86)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, flex: 1 }}>点位详情</div>
            <button type="button" onClick={() => setSelected(null)} style={{ border: '1px solid rgba(64,174,255,.35)', background: 'rgba(64,174,255,.15)', color: '#aaddff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
          </div>
          {(() => {
            const lat = toNumberOrNull(selected.props?.lat ?? selected.props?.latitude) ?? selected.lat
            const lng = toNumberOrNull(selected.props?.lon ?? selected.props?.lng ?? selected.props?.longitude) ?? selected.lng
            const coordText = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(7)}, ${lng.toFixed(7)}` : '—'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, opacity: 15, flex: 1 }}>WGS-84：<span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}>{coordText}</span></div>
                <button
                  type="button"
                  disabled={coordText === '—'}
                  onClick={async () => {
                    if (coordText === '—') return
                    try {
                      await navigator.clipboard.writeText(coordText)
                    } catch {
                    }
                  }}
                  style={{
                    border: '1px solid rgba(64,174,255,.35)',
                    background: coordText === '—' ? 'rgba(255,255,255,.03)' : 'rgba(64,174,255,.12)',
                    color: '#aaddff',
                    borderRadius: 8,
                    padding: '6px 10px',
                    cursor: coordText === '—' ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    opacity: coordText === '—' ? 0.6 : 1,
                  }}
                >
                  复制
                </button>
              </div>
            )
          })()}
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>ID：{selected.id}</div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>速度：{String(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate ?? '—')} mm/年</div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 10 }}>分级：<span style={{ color: classifyVelocity(toNumberOrNull(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate), thresholds).color }}>{classifyVelocity(toNumberOrNull(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate), thresholds).label}</span></div>
          <div style={{ height: 220, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(64,174,255,.2)', background: 'rgba(255,255,255,.08)' }}>
            <EChartsWrapper option={seriesOption} loading={seriesLoading} />
          </div>
          {seriesError ? <div style={{ marginTop: 8, fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap' }}>{seriesError}</div> : null}
        </div>
      ) : null}

      {selectedZone ? (
        <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 540, width: 360, maxWidth: 'calc(100% - 24px)', maxHeight: '40%', overflow: 'auto', padding: 12, borderRadius: 10, background: 'rgba(10,25,47,.86)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, flex: 1 }}>危险区详情</div>
            <button type="button" onClick={() => setSelectedZone(null)} style={{ border: '1px solid rgba(64,174,255,.35)', background: 'rgba(64,174,255,.15)', color: '#aaddff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
          </div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>ID：{selectedZone.id}</div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>方向：<span style={{ color: selectedZone.direction === 'uplift' ? '#a855f7' : '#ff3e5f', fontWeight: 900 }}>{selectedZone.direction === 'uplift' ? '抬升' : '沉降'}</span></div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>等级：<span style={{ color: selectedZone.direction === 'uplift' ? (selectedZone.level === 'danger' ? '#a855f7' : '#3b82f6') : (selectedZone.level === 'danger' ? '#ff3e5f' : '#ff9e0d'), fontWeight: 900 }}>{selectedZone.level === 'danger' ? '显著' : '轻微'}</span></div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>点数：{selectedZone.point_count}</div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>min速度：{selectedZone.min_velocity === null ? '—' : String(selectedZone.min_velocity)} mm/年</div>
          <div style={{ fontSize: 12, opacity: 15, marginBottom: 6 }}>p95速度：{selectedZone.p95_velocity === null ? '—' : String(selectedZone.p95_velocity)} mm/年</div>
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current
              const l = zonesLayerByIdRef.current.get(String(selectedZone.id))
              if (!map || !l) return
              try {
                const b = typeof l.getBounds === 'function' ? l.getBounds() : null
                if (b && b.isValid()) map.fitBounds(b.pad(0.2), { animate: true })
              } catch {
              }
            }}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid rgba(64,174,255,.35)',
              background: 'rgba(64,174,255,.12)',
              color: '#aaddff',
              cursor: 'pointer',
            }}
          >
            定位到该区
          </button>
        </div>
      ) : null}

      {showZones && zonesLoading ? <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 560, fontSize: 12, opacity: 15, padding: '6px 10px', borderRadius: 8, background: 'rgba(10,25,47,.78)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff' }}>危险区计算中…</div> : null}
      {showZones && zonesError ? <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 560, fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'rgba(10,25,47,.78)', border: '1px solid rgba(255,139,139,.35)', color: '#ff8b8b', whiteSpace: 'pre-wrap', maxWidth: 360 }}>{zonesError}</div> : null}
    </div>
  )
}

export default function Insar() {
  const [mode, setMode] = useState<'native' | 'iframe'>('native')
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

  useEffect(() => {
    try {
      localStorage.setItem('insar_advice_v1', JSON.stringify(adviceStore))
    } catch {
    }
  }, [adviceStore])

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

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      {/* 顶栏 - 简化版 */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">
            <i className="fas fa-satellite" /> InSAR 监测
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-200">数据集</span>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white"
            >
              {datasets.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            <i className="fas fa-cog" />
            设置
          </button>
        </div>
      </div>

      {/* 主内容区域 - 地图 + 风险概览 */}
      <div className="min-h-0 flex-1 flex">
        {/* 地图视图 */}
        <div className="flex-1 min-w-0">
          {mode === 'native' ? (
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
            />
          ) : (
            <div className="relative h-full w-full">
              {location.protocol === 'https:' ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
                  <span className="text-sm">HTTPS 环境下无法加载外部地图服务</span>
                  <a
                    href="http://47.96.7.238:38089/mapLayer"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    在新标签页中打开地图
                  </a>
                </div>
              ) : (
                <iframe
                  title="insar-map"
                  src="http://47.96.7.238:38089/mapLayer"
                  allowFullScreen
                  className="h-full w-full border-none"
                />
              )}
            </div>
          )}
        </div>

        {/* 风险概览侧边栏 */}
        <div className="w-80 shrink-0 border-l border-slate-700 bg-slate-900 overflow-y-auto">
          <div className="p-4">
            <h3 className="mb-4 text-base font-semibold text-white">风险概览</h3>

            {/* 风险统计徽章 */}
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 transition-colors hover:bg-red-500/15">
                <span className="text-sm font-medium text-white">危险</span>
                <span className="text-2xl font-bold text-red-400">{riskSummary.danger}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 transition-colors hover:bg-orange-500/15">
                <span className="text-sm font-medium text-white">预警</span>
                <span className="text-2xl font-bold text-orange-400">{riskSummary.warning}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 transition-colors hover:bg-green-500/15">
                <span className="text-sm font-medium text-white">正常</span>
                <span className="text-2xl font-bold text-green-400">{riskSummary.normal}</span>
              </div>
            </div>

            <div className="mb-4 text-xs text-slate-300">
              总点数：{riskSummary.total}
            </div>

            {/* 状态提示 */}
            {riskSummary.total > 0 && (
              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                {riskSummary.danger > 0 ? (
                  <p className="text-xs leading-relaxed text-red-300">
                    <i className="fas fa-exclamation-triangle mr-1" />
                    当前存在 {riskSummary.danger} 个危险点，建议立即查看并制定干预措施
                  </p>
                ) : riskSummary.warning > 0 ? (
                  <p className="text-xs leading-relaxed text-orange-300">
                    <i className="fas fa-exclamation-circle mr-1" />
                    当前存在 {riskSummary.warning} 个预警点，建议重点关注并提前准备处置
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed text-green-300">
                    <i className="fas fa-check-circle mr-1" />
                    当前未识别出危险/预警点，可保持常规监测与巡检
                  </p>
                )}
              </div>
            )}

            {/* 高风险点列表 */}
            {riskSummary.top.length > 0 ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-white">
                  高风险点 (Top {Math.min(5, riskSummary.top.length)})
                </h4>
                <div className="flex flex-col gap-2">
                  {riskSummary.top.slice(0, 5).map((p) => {
                    const isDanger = p.risk === 'danger'
                    const label = isDanger ? '危险' : '预警'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setMode('native')
                          setIndicator('threshold')
                          setFocusId(null)
                          window.setTimeout(() => {
                            setFocusId(p.id)
                            // 同时打开详情面板
                            setSelectedPoint({
                              id: p.id,
                              lat: p.lat,
                              lng: p.lng,
                              props: { velocity: p.velocity }
                            })
                          }, 0)
                        }}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-white transition-colors ${
                          isDanger
                            ? 'border-red-500/30 bg-slate-800 hover:bg-slate-700 hover:border-red-500/50'
                            : 'border-orange-500/30 bg-slate-800 hover:bg-slate-700 hover:border-orange-500/50'
                        }`}
                      >
                        <span className={`shrink-0 text-xs font-bold ${isDanger ? 'text-red-400' : 'text-orange-400'}`}>
                          {label}
                        </span>
                        <span className="flex-1 truncate text-sm font-medium">
                          {p.id || '未命名'}
                        </span>
                        <span className={`shrink-0 text-xs ${isDanger ? 'text-red-400' : 'text-orange-400'}`}>
                          {p.velocity.toFixed(2)} mm/年
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : riskSummary.total > 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
                <p className="text-sm text-slate-400">暂无高风险点</p>
              </div>
            ) : null}

            {/* 危险区列表 */}
            {showZones && zonesPanel?.top?.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-white">
                  高风险区 (Top {Math.min(5, zonesPanel.top.length)})
                </h4>
                <div className="flex flex-col gap-2">
                  {zonesPanel.top.slice(0, 5).map((z) => {
                    const isDanger = z.level === 'danger'
                    const isUplift = z.direction === 'uplift'
                    const dirLabel = isUplift ? '抬升' : '沉降'
                    const lvlLabel = isDanger ? '显著' : '轻微'
                    const label = `${dirLabel}${lvlLabel}区`

                    // 确定颜色类
                    let borderClass = ''
                    let borderHoverClass = ''
                    let textClass = ''
                    if (isUplift) {
                      borderClass = isDanger ? 'border-purple-500/30' : 'border-blue-500/30'
                      borderHoverClass = isDanger ? 'hover:border-purple-500/50' : 'hover:border-blue-500/50'
                      textClass = isDanger ? 'text-purple-400' : 'text-blue-400'
                    } else {
                      borderClass = isDanger ? 'border-red-500/30' : 'border-orange-500/30'
                      borderHoverClass = isDanger ? 'hover:border-red-500/50' : 'hover:border-orange-500/50'
                      textClass = isDanger ? 'text-red-400' : 'text-orange-400'
                    }

                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          setMode('native')
                          setIndicator('threshold')
                          if (!showZones) setShowZones(true)
                          setFocusId(null)
                          setFocusZoneId(null)
                          window.setTimeout(() => setFocusZoneId(z.id), 0)
                        }}
                        className={`flex items-center gap-2 rounded-lg border ${borderClass} ${borderHoverClass} bg-slate-800 px-3 py-2 text-left text-white transition-colors hover:bg-slate-700`}
                      >
                        <span className={`shrink-0 text-xs font-bold ${textClass}`}>
                          {label}
                        </span>
                        <span className="flex-1 truncate text-sm font-medium">
                          {z.id}
                        </span>
                        <span className={`shrink-0 text-xs ${textClass}`}>
                          {z.min_velocity === null ? '—' : `${z.min_velocity.toFixed(2)} mm/年`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 详情面板 - 点击点位时从右侧滑出 */}
      {selectedPoint && (
        <div className="fixed right-0 top-0 z-40 h-full w-96 transform border-l border-slate-700 bg-slate-900 shadow-2xl transition-transform duration-300">
          <div className="flex h-full flex-col">
            {/* 头部 */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-cyan-400" />
                <h3 className="text-base font-semibold text-white">点位详情</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* 导航按钮 */}
                {riskSummary.top.length > 1 && (() => {
                  const currentIndex = riskSummary.top.findIndex(p => p.id === selectedPoint.id)
                  if (currentIndex === -1) return null
                  const hasPrev = currentIndex > 0
                  const hasNext = currentIndex < riskSummary.top.length - 1
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasPrev) {
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
                          }
                        }}
                        disabled={!hasPrev}
                        className={`text-sm transition-colors ${
                          hasPrev ? 'text-slate-400 hover:text-white' : 'text-slate-600 cursor-not-allowed'
                        }`}
                        title="上一个"
                      >
                        <i className="fas fa-chevron-left" />
                      </button>
                      <span className="text-xs text-slate-400">
                        {currentIndex + 1} / {riskSummary.top.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasNext) {
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
                          }
                        }}
                        disabled={!hasNext}
                        className={`text-sm transition-colors ${
                          hasNext ? 'text-slate-400 hover:text-white' : 'text-slate-600 cursor-not-allowed'
                        }`}
                        title="下一个"
                      >
                        <i className="fas fa-chevron-right" />
                      </button>
                    </>
                  )
                })()}
                <button
                  type="button"
                  onClick={() => setSelectedPoint(null)}
                  className="ml-2 text-slate-400 transition-colors hover:text-white"
                >
                  <i className="fas fa-times text-lg" />
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {/* 点位基本信息 */}
              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-white">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">点位 ID</span>
                    <span className="font-medium text-white">{selectedPoint.id || '未命名'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">经度</span>
                    <span className="font-mono text-white">{selectedPoint.lng.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">纬度</span>
                    <span className="font-mono text-white">{selectedPoint.lat.toFixed(6)}</span>
                  </div>
                  {(() => {
                    const velocity = getVelocityFromProps(selectedPoint.props, velocityField)
                    if (velocity !== null) {
                      const risk = riskFromVelocity(velocity, thresholds)
                      const { label: riskLabel, color: riskColor } = (() => {
                        if (risk === 'danger') return { label: '危险', color: 'text-red-400' }
                        if (risk === 'warning') return { label: '预警', color: 'text-orange-400' }
                        return { label: '正常', color: 'text-green-400' }
                      })()
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">速度</span>
                            <span className="font-mono text-white">{velocity.toFixed(2)} mm/年</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">风险等级</span>
                            <span className={`font-semibold ${riskColor}`}>{riskLabel}</span>
                          </div>
                        </>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>

              {/* 其他属性 */}
              {selectedPoint.props && Object.keys(selectedPoint.props).length > 0 && (
                <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-white">其他属性</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(selectedPoint.props)
                      .filter(([key]) => !['id', 'velocity', 'vel', 'rate', 'value'].includes(key))
                      .slice(0, 10)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-2">
                          <span className="text-slate-300 truncate">{key}</span>
                          <span className="font-mono text-xs text-white text-right break-all">
                            {value === null || value === undefined ? '—' : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 时序图 */}
              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-white">
                  <i className="fas fa-chart-line mr-2 text-cyan-400" />
                  时序变化
                </h4>
                {seriesLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <div className="text-sm text-slate-400">
                      <i className="fas fa-spinner fa-spin mr-2" />
                      加载中...
                    </div>
                  </div>
                ) : seriesError ? (
                  <div className="flex h-48 items-center justify-center">
                    <div className="text-sm text-red-400">
                      <i className="fas fa-exclamation-circle mr-2" />
                      {seriesError}
                    </div>
                  </div>
                ) : series?.series && series.series.length > 0 ? (
                  <div className="h-48">
                    <EChartsWrapper option={seriesOption} />
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center">
                    <div className="text-sm text-slate-400">暂无时序数据</div>
                  </div>
                )}
              </div>

              {/* 施工建议 */}
              {(() => {
                const velocity = getVelocityFromProps(selectedPoint.props, velocityField)
                if (velocity === null) return null
                const risk = riskFromVelocity(velocity, thresholds)
                const measures = expertMeasuresForRisk(risk)
                if (measures.length === 0) return null

                const { label: riskLabel, color: riskColor } = (() => {
                  if (risk === 'danger') return { label: '危险', color: 'text-red-400' }
                  if (risk === 'warning') return { label: '预警', color: 'text-orange-400' }
                  return { label: '正常', color: 'text-green-400' }
                })()

                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-white">
                      <i className="fas fa-clipboard-list mr-2 text-cyan-400" />
                      施工建议
                      <span className={`ml-2 text-xs ${riskColor}`}>({riskLabel})</span>
                    </h4>
                    <div className="space-y-3">
                      {measures.map((m, idx) => (
                        <div key={m.key} className="rounded-lg border border-slate-600 bg-slate-900/50 p-3">
                          <div className="mb-1 flex items-start gap-2">
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-400">
                              {idx + 1}
                            </span>
                            <span className="flex-1 text-sm font-medium text-white">{m.title}</span>
                          </div>
                          <p className="ml-7 text-xs leading-relaxed text-slate-300">{m.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* 快捷键提示 */}
              {riskSummary.top.length > 1 && (
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <i className="fas fa-keyboard" />
                    <span>快捷键：</span>
                    <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-white">←</kbd>
                    <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-white">→</kbd>
                    <span>切换点位</span>
                    <kbd className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-white">ESC</kbd>
                    <span>关闭</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 设置抽屉 */}
      {showSettings && (
        <div className="fixed right-0 top-0 z-50 h-full w-96 transform border-l border-slate-700 bg-slate-900 shadow-2xl transition-transform duration-300">
          <div className="flex h-full flex-col">
            {/* 头部 */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <i className="fas fa-cog text-cyan-400" />
                <h3 className="text-base font-semibold text-white">设置</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-slate-400 transition-colors hover:text-white"
              >
                <i className="fas fa-times text-lg" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                {/* 显示模式 */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-white">显示模式</h4>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-colors hover:bg-slate-800">
                      <input
                        type="radio"
                        name="indicator"
                        checked={indicator === 'velocity'}
                        onChange={() => setIndicator('velocity')}
                        className="h-4 w-4 text-cyan-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">速度</div>
                        <div className="text-xs text-slate-400">显示形变速度（mm/年）</div>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-colors hover:bg-slate-800">
                      <input
                        type="radio"
                        name="indicator"
                        checked={indicator === 'keyDate'}
                        onChange={() => setIndicator('keyDate')}
                        className="h-4 w-4 text-cyan-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">关键日期</div>
                        <div className="text-xs text-slate-400">显示特定日期的形变值</div>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-colors hover:bg-slate-800">
                      <input
                        type="radio"
                        name="indicator"
                        checked={indicator === 'threshold'}
                        onChange={() => setIndicator('threshold')}
                        className="h-4 w-4 text-cyan-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">阈值分级</div>
                        <div className="text-xs text-slate-400">按风险等级着色</div>
                      </div>
                    </label>
                  </div>

                  {/* 关键日期选择 */}
                  {indicator === 'keyDate' && (
                    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                      <label className="mb-2 block text-xs text-slate-300">选择日期</label>
                      <select
                        value={keyDateField}
                        onChange={(e) => setKeyDateField(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                      >
                        {(fieldsInfo?.d_fields || []).map((f) => (
                          <option key={f} value={f}>
                            {formatKeyDateField(f)}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-400">负数表示沉降</p>
                    </div>
                  )}
                </div>

                {/* 阈值设置 */}
                {indicator === 'threshold' && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-white">阈值设置</h4>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                        <label className="mb-2 block text-xs text-slate-300">危险阈值（mm/年）</label>
                        <input
                          type="number"
                          value={thresholds.strong}
                          onChange={(e) => setThresholds((t) => ({ ...t, strong: Number(e.target.value) || 0 }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                          step="0.5"
                          min="0"
                        />
                        <p className="mt-1 text-xs text-slate-400">速度 ≤ -{thresholds.strong} 为危险</p>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                        <label className="mb-2 block text-xs text-slate-300">预警阈值（mm/年）</label>
                        <input
                          type="number"
                          value={thresholds.mild}
                          onChange={(e) => setThresholds((t) => ({ ...t, mild: Number(e.target.value) || 0 }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                          step="0.5"
                          min="0"
                        />
                        <p className="mt-1 text-xs text-slate-400">速度 ≤ -{thresholds.mild} 为预警</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setThresholds({ strong: 6, mild: 1.5 })}
                          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white transition-colors hover:bg-slate-700"
                        >
                          保守
                        </button>
                        <button
                          type="button"
                          onClick={() => setThresholds({ strong: 10, mild: 2 })}
                          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white transition-colors hover:bg-slate-700"
                        >
                          标准
                        </button>
                        <button
                          type="button"
                          onClick={() => setThresholds({ strong: 15, mild: 3 })}
                          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white transition-colors hover:bg-slate-700"
                        >
                          宽松
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 高级选项 */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-white">高级选项</h4>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-colors hover:bg-slate-800">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">视窗裁剪</div>
                        <div className="text-xs text-slate-400">只加载当前视窗范围内的数据</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={useBbox}
                        onChange={(e) => setUseBbox(e.target.checked)}
                        className="h-4 w-4 text-cyan-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-colors hover:bg-slate-800">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">显示危险区</div>
                        <div className="text-xs text-slate-400">使用 DBSCAN 聚类识别高风险区域</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={showZones}
                        onChange={(e) => setShowZones(e.target.checked)}
                        className="h-4 w-4 text-cyan-500"
                      />
                    </label>

                    {/* 危险区参数 */}
                    {showZones && (
                      <div className="ml-4 space-y-3 border-l-2 border-slate-700 pl-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                          <label className="mb-2 block text-xs text-slate-300">聚类半径 eps（米）</label>
                          <input
                            type="number"
                            value={zoneEpsM}
                            onChange={(e) => setZoneEpsM(Number(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                            step="10"
                            min="10"
                          />
                          <p className="mt-1 text-xs text-slate-400">点之间的最大距离</p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                          <label className="mb-2 block text-xs text-slate-300">最小点数 minPts</label>
                          <input
                            type="number"
                            value={zoneMinPts}
                            onChange={(e) => setZoneMinPts(Math.max(1, Math.round(Number(e.target.value) || 0)))}
                            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                            step="1"
                            min="1"
                          />
                          <p className="mt-1 text-xs text-slate-400">形成簇的最小点数</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 外链地图 */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-white">外部地图</h4>
                  <a
                    href="http://47.96.7.238:38089/mapLayer"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                  >
                    <i className="fas fa-external-link-alt" />
                    在新窗口打开外链地图
                  </a>
                </div>
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="shrink-0 border-t border-slate-700 bg-slate-800 p-4">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
