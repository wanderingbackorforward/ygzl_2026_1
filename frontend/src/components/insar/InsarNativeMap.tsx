import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE, STATIC_BASE } from '../../lib/api'
import type { EChartsOption } from 'echarts'
import EChartsWrapper from '../charts/EChartsWrapper'
import {
  classifyVelocity,
  clamp,
  extractLineCoords,
  getFeatureId,
  getLatLngFromFeature,
  getVelocityFromProps,
  percentile,
  riskFromVelocity,
  safeDatasetName,
  toNumberOrNull,
  valueToColor,
  type FeatureCollection,
  type Indicator,
  type InsarMeta,
  type RiskFilter,
  type RiskLevel,
  type RiskPoint,
  type RiskStats,
  type RiskSummary,
  type SeriesData,
  type Thresholds,
  type ZoneDirection,
  type ZoneLevel,
  type ZoneSummary,
} from '../../lib/insar'
import { kmlToBestLineStringFeature } from '../../lib/kml'
import { createBuiltInBaseLayers, createRasterLayer, loadOpticalRasterLayers } from '../../lib/mapLayers'

type BaseLayerItem = { name: string, layer: L.Layer }

export function InsarNativeMap(
  { dataset, indicator, valueField, velocityFieldName, thresholds, useBbox, showZones, zoneEpsM, zoneMinPts, chainageBinSize, chainageMaxDistance, onSummaryChange, onStatsChange, onZonesChange, focusId, focusZoneId, onSelectedChange, riskFilter, showRiskGrid }:
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
    onSelectedChange?: (selected: { id: string, props: Record<string, any>, lat: number, lng: number } | null) => void,
    riskFilter?: RiskFilter,
    showRiskGrid?: boolean
  }
) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const layerByIdRef = useRef<Map<string, any>>(new Map())
  const zonesLayerRef = useRef<L.GeoJSON | null>(null)
  const zonesLayerByIdRef = useRef<Map<string, any>>(new Map())
  const alertLayerRef = useRef<L.LayerGroup | null>(null)
  const riskGridLayerRef = useRef<L.LayerGroup | null>(null)
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
      // 触屏/大屏：关滚轮缩放（壁挂屏无滚轮，避免外接鼠标误触），开捏合/拖拽/tap
      scrollWheelZoom: false,
      touchZoom: true,
      dragging: true,
      tap: true,
      doubleClickZoom: true,
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

    map.createPane('riskGrid')
    map.createPane('insarZones')
    map.createPane('insarPoints')
    map.createPane('tunnelAlignment')
    const riskGridPane = map.getPane('riskGrid')
    const zonesPane = map.getPane('insarZones')
    const pointsPane = map.getPane('insarPoints')
    const tunnelPane = map.getPane('tunnelAlignment')
    if (riskGridPane) riskGridPane.style.zIndex = '370'
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
    let resizeObserver: ResizeObserver | null = null
    if (mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => map.invalidateSize())
      resizeObserver.observe(mapContainerRef.current)
    }
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
      if (resizeObserver) resizeObserver.disconnect()
      map.off('moveend', handleMoveEnd)
      if (moveendTimerRef.current) window.clearTimeout(moveendTimerRef.current)
      if (pulseTimerRef.current) window.clearInterval(pulseTimerRef.current)
      pulseTimerRef.current = null
      pulseMarkersRef.current = []
      alertLayerRef.current = null
      if (riskGridLayerRef.current) {
        riskGridLayerRef.current.remove()
        riskGridLayerRef.current = null
      }
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
        const velocity = getVelocityFromProps(p, velocityFieldName)
        const risk = riskFromVelocity(velocity, thresholds)
        const matchesFilter = !riskFilter || riskFilter === 'all' || risk === riskFilter
        return L.circleMarker(latlng, {
          radius: matchesFilter ? 5 : 3,
          color,
          fillColor: color,
          fillOpacity: matchesFilter ? 0.75 : 0.06,
          weight: matchesFilter ? 1 : 0.5,
          opacity: matchesFilter ? 1 : 0.15,
          pane: 'insarPoints',
        })
      },
      onEachFeature: (feature, l) => {
        const p: any = (feature as any)?.properties || {}
        const v = p.value ?? (p.value_field ? p[p.value_field] : undefined)
        const id = (feature as any)?.id ?? p.id ?? ''
        const velocity = getVelocityFromProps(p, velocityFieldName)
        const cls = classifyVelocity(velocity, thresholds)
        const idKey = id === undefined || id === null ? '' : String(id)
        if (idKey) layerByIdRef.current.set(idKey, l)
        const lines = [
          id !== '' ? `<div><b>ID</b>: ${String(id)}</div>` : '',
          v !== undefined ? `<div><b>${indicator === 'keyDate' ? '位移' : (indicator === 'velocity' ? '速度' : '速度')}</b>: ${String(v)}</div>` : '',
          indicator === 'threshold' ? `<div><b>分级</b>: <span style="color:${cls.color}">${cls.label}</span></div>` : '',
        ].filter(Boolean).join('')
        l.bindPopup(`<div style="min-width:140px;max-width:240px">${lines || '<div>无属性</div>'}</div>`, { autoPan: false, maxWidth: 260 })
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
  }, [data, maxAbs, indicator, thresholds, riskFilter, velocityFieldName])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (riskGridLayerRef.current) {
      riskGridLayerRef.current.remove()
      riskGridLayerRef.current = null
    }

    if (!showRiskGrid || !data?.features?.length) return

    const features = data.features
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
    const pts: { lat: number, lng: number, risk: RiskLevel }[] = []
    for (const f of features) {
      const ll = getLatLngFromFeature(f)
      if (!ll) continue
      const p = f?.properties || {}
      const v = getVelocityFromProps(p, velocityFieldName)
      const risk = riskFromVelocity(v, thresholds)
      pts.push({ lat: ll.lat, lng: ll.lng, risk })
      if (ll.lat < minLat) minLat = ll.lat
      if (ll.lat > maxLat) maxLat = ll.lat
      if (ll.lng < minLng) minLng = ll.lng
      if (ll.lng > maxLng) maxLng = ll.lng
    }
    if (!pts.length) return

    const pad = 0.001
    minLat -= pad; maxLat += pad; minLng -= pad; maxLng += pad
    const GRID = 20
    const cellH = (maxLat - minLat) / GRID
    const cellW = (maxLng - minLng) / GRID
    if (cellH <= 0 || cellW <= 0) return

    const grid: { danger: number, warning: number, normal: number }[][] = []
    for (let r = 0; r < GRID; r++) {
      grid[r] = []
      for (let c = 0; c < GRID; c++) {
        grid[r][c] = { danger: 0, warning: 0, normal: 0 }
      }
    }

    for (const pt of pts) {
      const r = Math.min(GRID - 1, Math.max(0, Math.floor((pt.lat - minLat) / cellH)))
      const c = Math.min(GRID - 1, Math.max(0, Math.floor((pt.lng - minLng) / cellW)))
      grid[r][c][pt.risk] += 1
    }

    const gridLayer = L.layerGroup()
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = grid[r][c]
        const total = cell.danger + cell.warning + cell.normal
        if (total === 0) continue

        const south = minLat + r * cellH
        const north = south + cellH
        const west = minLng + c * cellW
        const east = west + cellW

        let color: string
        let fillOpacity: number
        if (cell.danger > 0) {
          const ratio = cell.danger / total
          color = '#ff3e5f'
          fillOpacity = 0.12 + ratio * 0.25
        } else if (cell.warning > 0) {
          const ratio = cell.warning / total
          color = '#ff9e0d'
          fillOpacity = 0.08 + ratio * 0.18
        } else {
          color = '#00e676'
          fillOpacity = 0.06
        }

        L.rectangle([[south, west], [north, east]], {
          pane: 'riskGrid',
          color: 'transparent',
          weight: 0,
          fillColor: color,
          fillOpacity,
          interactive: false,
        }).addTo(gridLayer)
      }
    }

    gridLayer.addTo(map)
    riskGridLayerRef.current = gridLayer
  }, [data, showRiskGrid, thresholds, velocityFieldName])

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
        l.bindPopup(`<div style="min-width:140px;max-width:240px">${lines || '<div>无属性</div>'}</div>`, { autoPan: false, maxWidth: 260 })
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
      series: [{ name: 'D', type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2.5, shadowColor: 'rgba(0,229,255,0.7)', shadowBlur: 10 }, itemStyle: { color: '#00e5ff' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.35)' }, { offset: 1, color: 'rgba(0,229,255,0)' }] } } }],
      animationDuration: 600
    }
  }, [series?.id, series?.series, selected?.id])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
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
          <div style={{ marginTop: 6, opacity: 1 }}>光学配置：{opticalCount} 层</div>
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
