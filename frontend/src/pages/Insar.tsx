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

function InsarNativeMap({ dataset, indicator, valueField, thresholds, useBbox }: { dataset: string, indicator: Indicator, valueField: string, thresholds: Thresholds, useBbox: boolean }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const lastBoundsRef = useRef<L.LatLngBounds | null>(null)
  const useBboxRef = useRef(useBbox)
  const moveendTimerRef = useRef<number | null>(null)
  const lastBboxKeyRef = useRef<string>('')

  const [data, setData] = useState<FeatureCollection | null>(null)
  const [meta, setMeta] = useState<InsarMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<{ id: string, props: Record<string, any> } | null>(null)
  const [series, setSeries] = useState<SeriesData | null>(null)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [bboxToken, setBboxToken] = useState(0)

  useEffect(() => {
    useBboxRef.current = useBbox
  }, [useBbox])

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

    mapRef.current = map
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
      map.remove()
      mapRef.current = null
      layerRef.current = null
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
        })
      },
      onEachFeature: (feature, l) => {
        const p: any = (feature as any)?.properties || {}
        const v = p.value ?? (p.value_field ? p[p.value_field] : undefined)
        const id = (feature as any)?.id ?? p.id ?? ''
        const velocity = toNumberOrNull(p.velocity ?? p.vel ?? p.rate)
        const cls = classifyVelocity(velocity, thresholds)
        const lines = [
          id !== '' ? `<div><b>ID</b>: ${String(id)}</div>` : '',
          v !== undefined ? `<div><b>${indicator === 'keyDate' ? '位移' : (indicator === 'velocity' ? '速度' : '速度')}</b>: ${String(v)}</div>` : '',
          indicator === 'threshold' ? `<div><b>分级</b>: <span style="color:${cls.color}">${cls.label}</span></div>` : '',
        ].filter(Boolean).join('')
        l.bindPopup(`<div style="min-width:180px">${lines || '<div>无属性</div>'}</div>`)
        l.on('click', () => {
          setSelected({ id: String(id), props: p })
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
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>ID：{selected.id}</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>速度：{String(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate ?? '—')} mm/年</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 10 }}>分级：<span style={{ color: classifyVelocity(toNumberOrNull(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate), thresholds).color }}>{classifyVelocity(toNumberOrNull(selected.props?.velocity ?? selected.props?.vel ?? selected.props?.rate), thresholds).label}</span></div>
          <div style={{ height: 220, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(64,174,255,.2)', background: 'rgba(255,255,255,.03)' }}>
            <EChartsWrapper option={seriesOption} loading={seriesLoading} />
          </div>
          {seriesError ? <div style={{ marginTop: 8, fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap' }}>{seriesError}</div> : null}
        </div>
      ) : null}
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

  return (
    <div style={{ padding: 16, color: '#aaddff' }}>
      <h2 style={{ marginBottom: 10 }}><i className="fas fa-satellite" /> InSAR监测系统</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', border: '1px solid rgba(64,174,255,.35)', borderRadius: 10, overflow: 'hidden' }}>
          <button type="button" onClick={() => setMode('native')} style={{ padding: '8px 12px', border: 'none', background: mode === 'native' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            原生模式
          </button>
          <button type="button" onClick={() => setMode('iframe')} style={{ padding: '8px 12px', border: 'none', background: mode === 'iframe' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
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

      {mode === 'native' ? (
        <>
          {fieldsLoading ? <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>加载字段信息…</div> : null}
          {fieldsError ? <div style={{ fontSize: 12, color: '#ff8b8b', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{fieldsError}</div> : null}
          {indicator === 'keyDate' && fieldsInfo && (!fieldsInfo.d_fields || fieldsInfo.d_fields.length === 0) ? (
            <div style={{ fontSize: 12, color: '#ffb86b', whiteSpace: 'pre-wrap', marginBottom: 8 }}>当前数据集未发现 D_YYYYMMDD 字段，无法显示关键日期位移。</div>
          ) : null}
          <InsarNativeMap dataset={dataset} indicator={indicator} valueField={valueField} thresholds={thresholds} useBbox={useBbox} />
        </>
      ) : (
        <div style={{
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
        </div>
      )}
    </div>
  )
}
