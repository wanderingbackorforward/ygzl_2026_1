import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE } from '../lib/api'

type FeatureCollection = { type: 'FeatureCollection', features: any[] }
type InsarMeta = { dataset?: string, cached?: boolean, feature_count?: number, value_field?: string }

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

function valueToColor(value: number | null, maxAbs: number) {
  if (value === null || Number.isNaN(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) return '#7c8a9a'
  const v = clamp(value, -maxAbs, maxAbs)
  const n = v / maxAbs
  const t = Math.abs(n)
  if (n >= 0) {
    return rgbToHex(lerp(255, 255, t), lerp(255, 90, t), lerp(255, 90, t))
  }
  return rgbToHex(lerp(255, 60, t), lerp(255, 150, t), lerp(255, 255, t))
}

function InsarNativeMap({ dataset }: { dataset: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const lastBoundsRef = useRef<L.LatLngBounds | null>(null)

  const [data, setData] = useState<FeatureCollection | null>(null)
  const [meta, setMeta] = useState<InsarMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    setError(null)
    const url = `${API_BASE}/insar/points${dataset ? `?dataset=${encodeURIComponent(dataset)}` : ''}`
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => null as any)
        if (!res.ok || (body && typeof body === 'object' && body.status && body.status !== 'success')) {
          const msg = body?.message || `请求失败：${res.status}`
          const hint = body?.hint || ''
          throw new Error(`${msg}${hint ? `\n${hint}` : ''}`)
        }
        return body
      })
      .then((body) => {
        if (!mounted) return
        const nextMeta: InsarMeta | null = body?.meta && typeof body.meta === 'object' ? body.meta : null
        const nextData: FeatureCollection | null = body?.data && typeof body.data === 'object' ? body.data : (body as any)
        setMeta(nextMeta)
        setData(nextData)
      })
      .catch((e: any) => {
        if (!mounted) return
        setError(e?.message || '加载失败')
        setData(null)
        setMeta(null)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => { mounted = false }
  }, [dataset])

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([31.245, 121.575], 14)

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

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
        const n = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number(raw) : NaN)
        const v = Number.isFinite(n) ? n : null
        const color = valueToColor(v, maxAbs)
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
        const lines = [
          id !== '' ? `<div><b>ID</b>: ${String(id)}</div>` : '',
          v !== undefined ? `<div><b>value</b>: ${String(v)}</div>` : '',
        ].filter(Boolean).join('')
        l.bindPopup(`<div style="min-width:180px">${lines || '<div>无属性</div>'}</div>`)
      },
    })

    layer.addTo(map)
    layerRef.current = layer

    try {
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        lastBoundsRef.current = bounds
        map.fitBounds(bounds.pad(0.1))
      }
    } catch {
    }
  }, [data, maxAbs])

  const featureCount = meta?.feature_count ?? (data?.features?.length || 0)
  const valueField = meta?.value_field || (data?.features?.[0]?.properties?.value_field as string | undefined) || 'value'

  return (
    <div style={{ position: 'relative', width: '100%', height: '70vh' }}>
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(64,174,255,.3)' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 500, padding: 10, borderRadius: 8, background: 'rgba(10,25,47,.78)', border: '1px solid rgba(64,174,255,.25)', color: '#aaddff', width: 180 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>原生图层</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>点数：{featureCount}{meta?.cached ? '（缓存）' : ''}</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>字段：{valueField}</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>色标范围：±{maxAbs}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: valueToColor(-maxAbs, maxAbs) }} />
          <span style={{ fontSize: 12 }}>负向</span>
          <span style={{ flex: 1 }} />
          <span style={{ width: 14, height: 14, borderRadius: 3, background: valueToColor(maxAbs, maxAbs) }} />
          <span style={{ fontSize: 12 }}>正向</span>
        </div>
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
    </div>
  )
}

export default function Insar() {
  const [mode, setMode] = useState<'native' | 'iframe'>('native')
  const [dataset, setDataset] = useState('yanggaozhong')

  return (
    <div style={{ padding: 16, color: '#aaddff' }}>
      <h2 style={{ marginBottom: 10 }}><i className="fas fa-satellite" /> InSAR监测系统</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', border: '1px solid rgba(64,174,255,.35)', borderRadius: 10, overflow: 'hidden' }}>
          <button type="button" onClick={() => setMode('native')} style={{ padding: '8px 12px', border: 'none', background: mode === 'native' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            原生模式
          </button>
          <button type="button" onClick={() => setMode('iframe')} style={{ padding: '8px 12px', border: 'none', background: mode === 'iframe' ? 'rgba(64,174,255,.25)' : 'transparent', color: '#aaddff', cursor: 'pointer' }}>
            外链模式
          </button>
        </div>

        {mode === 'native' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.9 }}>dataset</span>
            <input
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              style={{ width: 160, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(64,174,255,.35)', background: 'rgba(10,25,47,.6)', color: '#aaddff' }}
            />
            <span style={{ fontSize: 12, opacity: 0.8 }}>对应目录：static/data/insar/raw/{dataset}/</span>
          </div>
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
        <InsarNativeMap dataset={dataset} />
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
