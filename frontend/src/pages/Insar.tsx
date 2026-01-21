import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE } from '../lib/api'
import type { EChartsOption } from 'echarts'
import EChartsWrapper from '../components/charts/EChartsWrapper'
import { classifyVelocity, formatKeyDateField, toNumberOrNull, type Thresholds } from '../lib/insar'

type FeatureCollection = { type: 'FeatureCollection', features: any[] }
type InsarMeta = { dataset?: string, cached?: boolean, feature_count?: number, total_feature_count?: number, value_field?: string, args?: Record<string, any> }

type Indicator = 'velocity' | 'keyDate' | 'threshold'
type FieldsInfo = { dataset: string, fields: string[], d_fields: string[], velocity_fields: string[], recommended_value_field: string }
type SeriesData = { dataset: string, id: string, series: { date: string, value: number | null }[], properties?: Record<string, any> }
type RiskLevel = 'normal' | 'warning' | 'danger'
type RiskPoint = { id: string, lat: number, lng: number, velocity: number, risk: RiskLevel }
type RiskSummary = { total: number, danger: number, warning: number, normal: number, unknown: number, top: RiskPoint[] }
type ZoneLevel = 'danger' | 'warning'
type ZoneDirection = 'subsidence' | 'uplift'
type ZoneSummary = { id: string, level: ZoneLevel, direction: ZoneDirection, point_count: number, min_velocity: number | null, p95_velocity: number | null, bbox?: number[] | null, centroid?: number[] | null }
type ExpertMeasure = { key: string, title: string, detail: string }
type AdviceEntry = { text: string, updatedAt: number }
type AdviceStore = { globalByDataset: Record<string, AdviceEntry>, pointByDataset: Record<string, Record<string, AdviceEntry>> }

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
  { dataset, indicator, valueField, velocityFieldName, thresholds, useBbox, showZones, zoneEpsM, zoneMinPts, onSummaryChange, onZonesChange, focusId, focusZoneId, onSelectedChange }:
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
    onSummaryChange?: (summary: RiskSummary) => void,
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
  const [zonesData, setZonesData] = useState<FeatureCollection | null>(null)
  const [zonesMeta, setZonesMeta] = useState<Record<string, any> | null>(null)
  const [zonesLoading, setZonesLoading] = useState(false)
  const [zonesError, setZonesError] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<ZoneSummary | null>(null)

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

  useEffect(() => {
    onSummaryChange?.(riskSummary)
  }, [onSummaryChange, riskSummary])

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

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map)

    map.createPane('insarZones')
    map.createPane('insarPoints')
    const zonesPane = map.getPane('insarZones')
    const pointsPane = map.getPane('insarPoints')
    if (zonesPane) zonesPane.style.zIndex = '380'
    if (pointsPane) pointsPane.style.zIndex = '420'

    mapRef.current = map
    const alertLayer = L.layerGroup().addTo(map)
    alertLayerRef.current = alertLayer
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
      window.removeEventListener('resize', handleResize)
      map.off('moveend', handleMoveEnd)
      if (moveendTimerRef.current) window.clearTimeout(moveendTimerRef.current)
      if (pulseTimerRef.current) window.clearInterval(pulseTimerRef.current)
      pulseTimerRef.current = null
      pulseMarkersRef.current = []
      alertLayerRef.current = null
      map.remove()
      mapRef.current = null
      layerRef.current = null
      zonesLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!selected?.id) return
    let mounted = true
    const controller = new AbortController()
    setSeriesLoading(true)
    setSeriesError(null)
    const safeDataset = safeDatasetName(dataset)
    const url = `${API_BASE}/insar/series?dataset=${encodeURIComponent(safeDataset)}&id=${encodeURIComponent(selected.id)}`
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
  }, [dataset, selected?.id])

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
        return { color: baseColor, weight: active ? 3 : 2, opacity: 0.95, fillColor: baseColor, fillOpacity: active ? 0.20 : 0.12 }
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
        opacity: 0.9,
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
        x.marker.setStyle({ opacity: 0.75 * k, fillOpacity: 0 })
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
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>点数：{featureCount}{meta?.total_feature_count ? ` / ${meta.total_feature_count}` : ''}{meta?.cached ? '（缓存）' : ''}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>字段：{resolvedValueField}{unit ? `（${unit}）` : ''}</div>
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>图例（颜色点含义）</div>
        {indicator !== 'threshold' ? (
          <>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>色标范围：±{maxAbs}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>左红=沉降（负），中白=0，右蓝=抬升（正）</div>
            <div style={{ height: 10, borderRadius: 6, border: '1px solid rgba(64,174,255,.25)', background: `linear-gradient(90deg, ${legendLeft || '#7c8a9a'} 0%, #ffffff 50%, ${legendRight || '#7c8a9a'} 100%)` }} />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, fontSize: 12, opacity: 0.9 }}>
              <span>-{maxAbs}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>0</span>
              <span>{maxAbs}</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>阈值分级（单位：mm/年，负=沉降）</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {thresholdLegendItems.map((x) => (
                <div key={`${x.label}-${x.color}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: x.color, border: '1px solid rgba(255,255,255,.15)' }} />
                  <span style={{ fontSize: 12, opacity: 0.95 }}>{x.label}</span>
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
        {loading ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>加载中…</div> : null}
        {error ? <div style={{ marginTop: 8, fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap' }}>{error}</div> : null}
      </div>

      {selected ? (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 550, width: 360, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)', overflow: 'auto', padding: 12, borderRadius: 10, background: 'rgba(10,25,47,.86)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, flex: 1 }}>点位详情</div>
            <button type="button" onClick={() => setSelected(null)} style={{ border: '1px solid rgba(64,174,255,.35)', background: 'rgba(255,255,255,.05)', color: '#aaddff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
          </div>
          {(() => {
            const lat = toNumberOrNull(selected.props?.lat ?? selected.props?.latitude) ?? selected.lat
            const lng = toNumberOrNull(selected.props?.lon ?? selected.props?.lng ?? selected.props?.longitude) ?? selected.lng
            const coordText = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(7)}, ${lng.toFixed(7)}` : '—'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.95, flex: 1 }}>WGS-84：<span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}>{coordText}</span></div>
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
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>ID：{selected.id}</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>速度：{String(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate ?? '—')} mm/年</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 10 }}>分级：<span style={{ color: classifyVelocity(toNumberOrNull(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate), thresholds).color }}>{classifyVelocity(toNumberOrNull(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate), thresholds).label}</span></div>
          <div style={{ height: 220, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(64,174,255,.2)', background: 'rgba(255,255,255,.03)' }}>
            <EChartsWrapper option={seriesOption} loading={seriesLoading} />
          </div>
          {seriesError ? <div style={{ marginTop: 8, fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap' }}>{seriesError}</div> : null}
        </div>
      ) : null}

      {selectedZone ? (
        <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 540, width: 360, maxWidth: 'calc(100% - 24px)', maxHeight: '40%', overflow: 'auto', padding: 12, borderRadius: 10, background: 'rgba(10,25,47,.86)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, flex: 1 }}>危险区详情</div>
            <button type="button" onClick={() => setSelectedZone(null)} style={{ border: '1px solid rgba(64,174,255,.35)', background: 'rgba(255,255,255,.05)', color: '#aaddff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>ID：{selectedZone.id}</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>方向：<span style={{ color: selectedZone.direction === 'uplift' ? '#a855f7' : '#ff3e5f', fontWeight: 900 }}>{selectedZone.direction === 'uplift' ? '抬升' : '沉降'}</span></div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>等级：<span style={{ color: selectedZone.direction === 'uplift' ? (selectedZone.level === 'danger' ? '#a855f7' : '#3b82f6') : (selectedZone.level === 'danger' ? '#ff3e5f' : '#ff9e0d'), fontWeight: 900 }}>{selectedZone.level === 'danger' ? '显著' : '轻微'}</span></div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>点数：{selectedZone.point_count}</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>min速度：{selectedZone.min_velocity === null ? '—' : String(selectedZone.min_velocity)} mm/年</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>p95速度：{selectedZone.p95_velocity === null ? '—' : String(selectedZone.p95_velocity)} mm/年</div>
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

      {showZones && zonesLoading ? <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 560, fontSize: 12, opacity: 0.85, padding: '6px 10px', borderRadius: 8, background: 'rgba(10,25,47,.78)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff' }}>危险区计算中…</div> : null}
      {showZones && zonesError ? <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 560, fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'rgba(10,25,47,.78)', border: '1px solid rgba(255,139,139,.35)', color: '#ff8b8b', whiteSpace: 'pre-wrap', maxWidth: 360 }}>{zonesError}</div> : null}
    </div>
  )
}

export default function Insar() {
  const [mode, setMode] = useState<'native' | 'iframe'>('native')
  const [tab, setTab] = useState<'map' | 'ops'>(() => {
    try {
      const raw = localStorage.getItem('insar_tab_v1')
      if (raw === 'map' || raw === 'ops') return raw
    } catch {
    }
    return 'map'
  })
  const [dataset, setDataset] = useState('yanggaozhong')
  const [datasets, setDatasets] = useState<string[]>(['yanggaozhong'])
  const [indicator, setIndicator] = useState<Indicator>('velocity')
  const [fieldsInfo, setFieldsInfo] = useState<FieldsInfo | null>(null)
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsError, setFieldsError] = useState<string | null>(null)
  const [keyDateField, setKeyDateField] = useState<string>('')
  const [useBbox, setUseBbox] = useState(false)
  const [riskSummary, setRiskSummary] = useState<RiskSummary>({ total: 0, danger: 0, warning: 0, normal: 0, unknown: 0, top: [] })
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
  const [zonesPanel, setZonesPanel] = useState<{ meta: Record<string, any> | null, top: ZoneSummary[] }>({ meta: null, top: [] })
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('insar_advice_v1', JSON.stringify(adviceStore))
    } catch {
    }
  }, [adviceStore])

  useEffect(() => {
    try {
      localStorage.setItem('insar_tab_v1', tab)
    } catch {
    }
  }, [tab])

  useEffect(() => {
    if (tab === 'ops' && mode !== 'native') setMode('native')
    if (tab === 'map') window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
  }, [tab, mode])

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
    } catch {
    }
  }, [showZones, zoneEpsM, zoneMinPts])

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
          [pid]: { text, updatedAt: Date.now() }
        }
      }
    }))
  }

  const appendAdvice = (base: string, line: string) => {
    const t = (base || '').trim()
    const add = (line || '').trim()
    if (!add) return t
    if (!t) return add
    return `${t}\n${add}`
  }

  const appendMeasureToAdvice = (m: ExpertMeasure) => {
    const line = `- ${m.title}：${m.detail}`
    if (selectedPoint?.id) setPointAdvice(appendAdvice(pointAdvice, line))
    else setGlobalAdvice(appendAdvice(globalAdvice, line))
  }

  const applyTemplate = (target: 'auto' | 'global' | 'point' = 'auto') => {
    const measures = expertMeasuresForRisk(contextLevel)
    const text = measures.map((m) => `- ${m.title}：${m.detail}`).join('\n')
    if (target === 'global') {
      setGlobalAdvice(text)
      return
    }
    if (target === 'point') {
      setPointAdvice(text)
      return
    }
    if (selectedPoint?.id) setPointAdvice(text)
    else setGlobalAdvice(text)
  }

  const exportAdvice = async () => {
    const payload = {
      dataset,
      exportedAt: new Date().toISOString(),
      thresholds,
      summary: { danger: riskSummary.danger, warning: riskSummary.warning, normal: riskSummary.normal, total: riskSummary.total },
      selectedPoint: selectedPoint ? { id: selectedPoint.id, lat: selectedPoint.lat, lng: selectedPoint.lng } : null,
      globalAdvice: (adviceStore.globalByDataset?.[dataset] || null),
      pointAdvice: (adviceStore.pointByDataset?.[dataset] || {})
    }
    const text = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
    }
  }

  return (
    <div style={{ padding: 16, color: '#aaddff' }}>
      <h2 style={{ marginBottom: 10 }}><i className="fas fa-satellite" /> InSAR监测系统</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', border: '1px solid rgba(64,174,255,.35)', borderRadius: 10, overflow: 'hidden' }}>
          <button type="button" onClick={() => setTab('map')} style={{ padding: '8px 12px', border: 'none', background: tab === 'map' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            地图
          </button>
          <button type="button" onClick={() => { setTab('ops'); setMode('native') }} style={{ padding: '8px 12px', border: 'none', background: tab === 'ops' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            预警/建议
          </button>
        </div>
        <div style={{ display: 'flex', border: '1px solid rgba(64,174,255,.35)', borderRadius: 10, overflow: 'hidden' }}>
          <button type="button" onClick={() => { setMode('native') }} style={{ padding: '8px 12px', border: 'none', background: mode === 'native' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            原生模式
          </button>
          <button type="button" onClick={() => { setMode('iframe'); setTab('map') }} style={{ padding: '8px 12px', border: 'none', background: mode === 'iframe' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            外链模式（备用）
          </button>
        </div>

        {mode === 'native' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.9 }}>数据集</span>
              <select value={dataset} onChange={(e) => setDataset(e.target.value)} style={{ width: 160, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }}>
                {datasets.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <span style={{ fontSize: 12, opacity: 0.8 }}>仓库路径：static/data/insar/raw/{safeDatasetName(dataset)}/</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.9 }}>指标</span>
              <div style={{ display: 'flex', border: '1px solid rgba(64,174,255,.35)', borderRadius: 10, overflow: 'hidden' }}>
                <button type="button" onClick={() => setIndicator('velocity')} style={{ padding: '8px 10px', border: 'none', background: indicator === 'velocity' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
                  速度
                </button>
                <button type="button" onClick={() => setIndicator('keyDate')} style={{ padding: '8px 10px', border: 'none', background: indicator === 'keyDate' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
                  关键日期
                </button>
                <button type="button" onClick={() => setIndicator('threshold')} style={{ padding: '8px 10px', border: 'none', background: indicator === 'threshold' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
                  阈值分级
                </button>
              </div>
            </div>

            {indicator === 'keyDate' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.9 }}>日期</span>
                <select value={keyDateField} onChange={(e) => setKeyDateField(e.target.value)} style={{ width: 180, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }}>
                  {(fieldsInfo?.d_fields || []).map((f) => <option key={f} value={f}>{formatKeyDateField(f)}</option>)}
                </select>
                <span style={{ fontSize: 12, opacity: 0.8 }}>负数=沉降</span>
              </div>
            ) : null}

            {indicator === 'threshold' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, opacity: 0.9 }}>阈值</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>显著</span>
                <input value={thresholds.strong} onChange={(e) => setThresholds((t) => ({ ...t, strong: Number(e.target.value) || 0 }))} style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }} />
                <span style={{ fontSize: 12, opacity: 0.8 }}>轻微</span>
                <input value={thresholds.mild} onChange={(e) => setThresholds((t) => ({ ...t, mild: Number(e.target.value) || 0 }))} style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }} />
                <span style={{ fontSize: 12, opacity: 0.8 }}>mm/年</span>
              </div>
            ) : null}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.9, cursor: 'pointer' }}>
              <input type="checkbox" checked={useBbox} onChange={(e) => setUseBbox(e.target.checked)} />
              视窗裁剪（范围）
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.9, cursor: 'pointer' }}>
              <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} />
              危险区
            </label>
            {showZones ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, opacity: 0.85 }}>eps</span>
                <input value={zoneEpsM} onChange={(e) => setZoneEpsM(Number(e.target.value) || 0)} style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }} />
                <span style={{ fontSize: 12, opacity: 0.85 }}>m</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>minPts</span>
                <input value={zoneMinPts} onChange={(e) => setZoneMinPts(Math.max(1, Math.round(Number(e.target.value) || 0)))} style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }} />
              </div>
            ) : null}
          </>
        ) : null}

        <a href="http://47.96.7.238:38089/mapLayer" target="_blank" rel="noreferrer" style={{
          display: 'inline-block',
          color: '#40aeff',
          border: '1px solid rgba(64,174,255,.6)',
          borderRadius: 6,
          padding: '6px 12px',
          background: 'rgba(64,174,255,.1)',
          textDecoration: 'none'
        }}>
          <i className="fas fa-external-link-alt" /> 新窗口打开外链地图
        </a>
      </div>

      {tab === 'ops' ? (
        <>
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(10,25,47,.55)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>施工危险预警</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>总点数：{riskSummary.total}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setTab('map'); setMode('native'); setIndicator('threshold') }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(64,174,255,.12)', color: '#aaddff', cursor: 'pointer' }}>
                  一键切到阈值分级
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.95 }}>
                  <span>阈值：</span>
                  <span style={{ color: '#ff3e5f' }}>危险 ≤ -{thresholds.strong}</span>
                  <span style={{ opacity: 0.7 }}>/</span>
                  <span style={{ color: '#ff9e0d' }}>预警 ≤ -{thresholds.mild}</span>
                  <span style={{ opacity: 0.85 }}>（mm/年，负数=沉降）</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,62,95,.10)', border: '1px solid rgba(255,62,95,.25)' }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>危险</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#ff3e5f' }}>{riskSummary.danger}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,158,13,.10)', border: '1px solid rgba(255,158,13,.25)' }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>预警</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#ff9e0d' }}>{riskSummary.warning}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,118,.10)', border: '1px solid rgba(0,230,118,.22)' }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>正常</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#00e676' }}>{riskSummary.normal}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, opacity: 0.85 }}>推荐预设</span>
                <button type="button" onClick={() => setThresholds({ strong: 6, mild: 1.5 })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: 'pointer' }}>保守</button>
                <button type="button" onClick={() => setThresholds({ strong: 10, mild: 2 })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: 'pointer' }}>标准</button>
                <button type="button" onClick={() => setThresholds({ strong: 15, mild: 3 })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: 'pointer' }}>宽松</button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.95, lineHeight: 1.7 }}>
              {riskSummary.danger > 0 ? (
                <div style={{ color: '#ff8b8b' }}>提示：当前存在危险点。建议优先定位红色点位，查看时序并立即制定干预措施。</div>
              ) : riskSummary.warning > 0 ? (
                <div style={{ color: '#ffb86b' }}>提示：当前存在预警点。建议重点关注橙色点位，评估趋势并提前准备处置。</div>
              ) : (
                <div style={{ color: '#8ef5c7' }}>提示：当前未识别出危险/预警点，可保持常规监测与巡检。</div>
              )}
              <div style={{ opacity: 0.9 }}>操作：点击高风险点 → 切到地图定位 → 左侧看坐标与时序 → 下方按清单填写施工建议。</div>
            </div>

            {riskSummary.top.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>高风险点（Top {Math.min(10, riskSummary.top.length)}）</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflow: 'auto', paddingRight: 4 }}>
                  {riskSummary.top.slice(0, 10).map((p) => {
                    const color = p.risk === 'danger' ? '#ff3e5f' : '#ff9e0d'
                    const label = p.risk === 'danger' ? '危险' : '预警'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setTab('map')
                          setMode('native')
                          setIndicator('threshold')
                          setFocusId(null)
                          window.setTimeout(() => setFocusId(p.id), 0)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: `1px solid ${p.risk === 'danger' ? 'rgba(255,62,95,.28)' : 'rgba(255,158,13,.28)'}`,
                          background: 'rgba(255,255,255,.04)',
                          color: '#aaddff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ minWidth: 44, fontWeight: 900, color }}>{label}</span>
                        <span style={{ flex: 1, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id || '未命名'}</span>
                        <span style={{ fontSize: 12, opacity: 0.95, color }}>{p.velocity.toFixed(2)} mm/年</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {showZones && zonesPanel?.top?.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>高风险区（Top {Math.min(10, zonesPanel.top.length)}）</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    {(() => {
                      const z = (zonesPanel.meta as any)?.zones || {}
                      const dz = typeof z.danger_zone_count === 'number' ? z.danger_zone_count : null
                      const wz = typeof z.warning_zone_count === 'number' ? z.warning_zone_count : null
                      const all = typeof z.zone_count === 'number' ? z.zone_count : null
                      const parts = [all !== null ? `总${all}` : null, dz !== null ? `危险${dz}` : null, wz !== null ? `预警${wz}` : null].filter(Boolean)
                      return parts.join(' / ') || '—'
                    })()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'auto', paddingRight: 4 }}>
                  {zonesPanel.top.slice(0, 10).map((z) => {
                    const color =
                      z.direction === 'uplift'
                        ? (z.level === 'danger' ? '#a855f7' : '#3b82f6')
                        : (z.level === 'danger' ? '#ff3e5f' : '#ff9e0d')
                    const dirLabel = z.direction === 'uplift' ? '抬升' : '沉降'
                    const lvlLabel = z.level === 'danger' ? '显著' : '轻微'
                    const label = `${dirLabel}${lvlLabel}区`
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          setTab('map')
                          setMode('native')
                          setIndicator('threshold')
                          if (!showZones) setShowZones(true)
                          setFocusId(null)
                          setFocusZoneId(null)
                          window.setTimeout(() => setFocusZoneId(z.id), 0)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: `1px solid ${z.level === 'danger' ? 'rgba(255,62,95,.28)' : 'rgba(255,158,13,.28)'}`,
                          background: 'rgba(255,255,255,.04)',
                          color: '#aaddff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ minWidth: 56, fontWeight: 900, color }}>{label}</span>
                        <span style={{ flex: 1, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.id}</span>
                        <span style={{ fontSize: 12, opacity: 0.95, color }}>{z.min_velocity === null ? '—' : `${z.min_velocity.toFixed(2)} mm/年`}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {(() => {
            const badge = riskLabel(contextLevel)
            const measures = expertMeasuresForRisk(contextLevel)
            const title = selectedPoint?.id ? `当前点位：${selectedPoint.id}` : '当前数据集总体'
            return (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(10,25,47,.55)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontWeight: 900 }}>智能处置清单</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{title}</div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: badge.color, border: `1px solid ${badge.color}55`, padding: '4px 10px', borderRadius: 999, background: `${badge.color}14` }}>{badge.label}</span>
                    <button type="button" onClick={applyTemplate} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: 'pointer', fontSize: 12 }}>套用模板</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {measures.map((m) => (
                    <div key={m.key} style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ fontWeight: 900, flex: 1 }}>{m.title}</div>
                        <button type="button" onClick={() => appendMeasureToAdvice(m)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(64,174,255,.10)', color: '#aaddff', cursor: 'pointer', fontSize: 12 }}>加入建议</button>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.92, lineHeight: 1.7 }}>{m.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(10,25,47,.55)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontWeight: 900 }}>施工建议</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>输入内容会自动保存到本机浏览器</div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={exportAdvice} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(64,174,255,.12)', color: '#aaddff', cursor: 'pointer', fontSize: 12 }}>导出（复制JSON）</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 900 }}>全局建议（{dataset}）</div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => applyTemplate('global')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: 'pointer', fontSize: 12 }}>按等级生成</button>
                    <button type="button" onClick={() => setGlobalAdvice('')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: 'pointer', fontSize: 12 }}>清空</button>
                  </div>
                </div>
                <textarea
                  value={globalAdvice}
                  onChange={(e) => setGlobalAdvice(e.target.value)}
                  placeholder="例如：本周降水工况、关键工序限制、监测频率要求、上报与复核流程等。"
                  style={{ width: '100%', height: 140, resize: 'vertical', padding: 10, borderRadius: 10, border: '1px solid rgba(64,174,255,.22)', background: 'rgba(10,25,47,.35)', color: '#aaddff', outline: 'none', fontSize: 12, lineHeight: 1.6 }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 280, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)', opacity: selectedPoint?.id ? 1 : 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 900 }}>点位建议{selectedPoint?.id ? `（${selectedPoint.id}）` : ''}</div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" disabled={!selectedPoint?.id} onClick={() => applyTemplate('point')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: selectedPoint?.id ? 'pointer' : 'not-allowed', fontSize: 12 }}>按等级生成</button>
                    <button type="button" disabled={!selectedPoint?.id} onClick={() => setPointAdvice('')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.25)', background: 'rgba(255,255,255,.05)', color: '#aaddff', cursor: selectedPoint?.id ? 'pointer' : 'not-allowed', fontSize: 12 }}>清空</button>
                  </div>
                </div>
                <textarea
                  value={pointAdvice}
                  onChange={(e) => setPointAdvice(e.target.value)}
                  disabled={!selectedPoint?.id}
                  placeholder={selectedPoint?.id ? '例如：该点位周边工序调整、加固/注浆方案、降水限制、复测安排等。' : '请先在地图中点击一个点位'}
                  style={{ width: '100%', height: 140, resize: 'vertical', padding: 10, borderRadius: 10, border: '1px solid rgba(64,174,255,.22)', background: 'rgba(10,25,47,.35)', color: '#aaddff', outline: 'none', fontSize: 12, lineHeight: 1.6 }}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {mode === 'native' ? (
        <>
          {fieldsLoading ? <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>加载字段信息…</div> : null}
          {fieldsError ? <div style={{ fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{fieldsError}</div> : null}
          {indicator === 'keyDate' && fieldsInfo && (!fieldsInfo.d_fields || fieldsInfo.d_fields.length === 0) ? (
            <div style={{ fontSize: 12, color: '#ffb86b', whiteSpace: 'pre-wrap', marginBottom: 8 }}>当前数据集未发现 D_YYYYMMDD 字段，无法显示关键日期位移。</div>
          ) : null}
          <div style={tab === 'map' ? undefined : { height: 1, overflow: 'hidden', opacity: 0.001, pointerEvents: 'none' }}>
            <InsarNativeMap dataset={dataset} indicator={indicator} valueField={valueField} velocityFieldName={velocityField} thresholds={thresholds} useBbox={useBbox} showZones={showZones} zoneEpsM={zoneEpsM} zoneMinPts={zoneMinPts} onSummaryChange={setRiskSummary} onZonesChange={setZonesPanel} focusId={focusId} focusZoneId={focusZoneId} onSelectedChange={setSelectedPoint} />
          </div>
        </>
      ) : (
        tab === 'map' ? <div style={{
          position: 'relative',
          width: '100%',
          height: '70vh',
          border: '1px solid rgba(64,174,255,.3)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 0 12px rgba(64,174,255,.15) inset',
          background: 'rgba(10,25,47,.6)'
        }}>
          <iframe
            title="insar-map"
            src="http://47.96.7.238:38089/mapLayer"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div> : null
      )}
    </div>
  )
}
