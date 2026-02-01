import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EChartsOption } from 'echarts'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiGet, apiPost } from '../lib/api'
import { EChartsWrapper } from '../components/charts/EChartsWrapper'
import { kmlToBestLineStringFeature, type GeoJSONLineStringFeature } from '../lib/kml'

type TunnelProject = {
  project_id: string
  name: string
  description?: string | null
  created_at?: string | null
}

type TunnelAlignment = {
  alignment_id: string
  project_id: string
  name: string
  geojson?: unknown
  srid?: number | null
  created_at?: string | null
}

type RiskBin = {
  chainage_start: number
  chainage_end: number
  point_count: number
  max_abs_current_value?: number | null
  max_abs_change_rate?: number | null
  worst_alert_level?: string | null
  worst_point_id?: string | null
  risk_score: number
  risk_priority: string
  reasons: string[]
}

type RiskBinsResponse = {
  project_id: string
  alignment_id?: string | null
  machine_id?: string | null
  bin_m: number
  start_chainage?: number | null
  end_chainage?: number | null
  points: number
  bins: RiskBin[]
}

type AutoTicketResult = {
  created: Array<Record<string, unknown>>
  skipped: Array<Record<string, unknown>>
}

type GeoJSONLineString = {
  type: 'LineString'
  coordinates: number[][]
}

type GeoJSONFeature = {
  type: 'Feature'
  geometry?: GeoJSONLineString | null
  properties?: Record<string, unknown> | null
}

function parseGeojson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const s = value.trim()
  if (!s) return value
  if (!s.startsWith('{') && !s.startsWith('[')) return value
  try {
    return JSON.parse(s)
  } catch {
    return value
  }
}

function toLineStringFeature(value: unknown): GeoJSONFeature | null {
  const g: any = parseGeojson(value)
  if (!g || typeof g !== 'object') return null
  if (g.type === 'Feature' && g.geometry && g.geometry.type === 'LineString') return g as GeoJSONFeature
  if (g.type === 'LineString') return { type: 'Feature', geometry: g as GeoJSONLineString, properties: {} }
  return null
}

export default function Tunnel() {
  const [projects, setProjects] = useState<TunnelProject[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [alignments, setAlignments] = useState<TunnelAlignment[]>([])
  const [alignmentId, setAlignmentId] = useState<string>('')
  const [showKml, setShowKml] = useState(true)
  const [kmlSource, setKmlSource] = useState<'repo' | 'local'>('repo')
  const [localKmlFile, setLocalKmlFile] = useState<File | null>(null)
  const [kmlFeature, setKmlFeature] = useState<GeoJSONLineStringFeature | null>(null)
  const [kmlInfo, setKmlInfo] = useState<{ name: string | null, points: number } | null>(null)
  const [machineId, setMachineId] = useState<string>('')
  const [binM, setBinM] = useState<number>(20)
  const [thresholdScore, setThresholdScore] = useState<number>(70)
  const [loading, setLoading] = useState(false)
  const [riskData, setRiskData] = useState<RiskBinsResponse | null>(null)
  const [error, setError] = useState<string>('')
  const [autoTicketResult, setAutoTicketResult] = useState<AutoTicketResult | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const alignmentLayerRef = useRef<L.Layer | null>(null)
  const kmlLayerRef = useRef<L.Layer | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    apiGet<TunnelProject[]>('/tunnel/projects')
      .then((rows) => {
        setProjects(rows || [])
        if (!projectId && rows && rows.length) setProjectId(rows[0].project_id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [projectId])

  const loadAlignments = useCallback(async () => {
    if (!projectId) {
      setAlignments([])
      setAlignmentId('')
      return
    }
    const rows = await apiGet<TunnelAlignment[]>(`/tunnel/alignments?project_id=${encodeURIComponent(projectId)}`)
    const list = (rows || []).map((a) => ({ ...a, geojson: parseGeojson(a.geojson) }))
    setAlignments(list)
    if (!alignmentId && list.length) setAlignmentId(list[0].alignment_id)
    if (alignmentId && !list.some((x) => x.alignment_id === alignmentId)) {
      setAlignmentId(list[0]?.alignment_id || '')
    }
  }, [projectId, alignmentId])

  useEffect(() => {
    loadAlignments().catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [loadAlignments])

  const loadRisk = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    setAutoTicketResult(null)
    try {
      const qs = new URLSearchParams()
      qs.set('project_id', projectId)
      qs.set('bin_m', String(binM))
      if (alignmentId) qs.set('alignment_id', alignmentId)
      if (machineId) qs.set('machine_id', machineId)
      const data = await apiGet<RiskBinsResponse>(`/tunnel/risk/bins?${qs.toString()}`)
      setRiskData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId, alignmentId, machineId, binM])

  useEffect(() => {
    if (!projectId) return
    loadRisk()
  }, [projectId, alignmentId, loadRisk])

  const topBins = useMemo(() => {
    const bins = riskData?.bins || []
    return [...bins].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 8)
  }, [riskData])

  const chartOption: EChartsOption = useMemo(() => {
    const bins = riskData?.bins || []
    const xs = bins.map((b) => Number(((b.chainage_start + b.chainage_end) / 2).toFixed(1)))
    const ys = bins.map((b) => b.risk_score || 0)
    return {
      backgroundColor: 'transparent',
      grid: { left: 45, right: 20, top: 25, bottom: 35 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: xs, name: '里程(m)', nameGap: 22 },
      yAxis: { type: 'value', min: 0, max: 100, name: '风险分' },
      series: [
        {
          type: 'line',
          data: ys,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
        },
      ],
    }
  }, [riskData])

  const runAutoTickets = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    setAutoTicketResult(null)
    try {
      const data = await apiPost<AutoTicketResult>('/tunnel/risk/auto-tickets', {
        project_id: projectId,
        alignment_id: alignmentId || undefined,
        machine_id: machineId || undefined,
        bin_m: binM,
        threshold_score: thresholdScore,
        creator_id: 'system',
        creator_name: '系统',
      })
      setAutoTicketResult(data)
      await loadRisk()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId, alignmentId, machineId, binM, thresholdScore, loadRisk])

  const selectedAlignment = useMemo(() => {
    const a = alignments.find((x) => x.alignment_id === alignmentId)
    if (!a) return null
    const feat = toLineStringFeature(a.geojson)
    return feat ? { ...a, geojson: feat } : { ...a, geojson: null }
  }, [alignments, alignmentId])

  const loadKmlForDisplay = useCallback(async () => {
    setError('')
    setKmlFeature(null)
    setKmlInfo(null)
    if (!showKml) return
    try {
      let text = ''
      if (kmlSource === 'repo') {
        const res = await fetch('/static/data/tunnel/YGL_KML.kml')
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        text = await res.text()
      } else {
        if (!localKmlFile) return
        text = await localKmlFile.text()
      }
      const feat = kmlToBestLineStringFeature(text)
      if (!feat) throw new Error('KML 解析失败（未找到 LineString）')
      const name = String((feat.properties || {}).name || '').trim()
      const coords = feat.geometry?.coordinates || []
      setKmlFeature(feat)
      setKmlInfo({ name: name || null, points: Array.isArray(coords) ? coords.length : 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [showKml, kmlSource, localKmlFile])

  useEffect(() => {
    loadKmlForDisplay()
  }, [loadKmlForDisplay])

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
    return () => {
      window.removeEventListener('resize', handleResize)
      if (alignmentLayerRef.current) alignmentLayerRef.current.remove()
      if (kmlLayerRef.current) kmlLayerRef.current.remove()
      alignmentLayerRef.current = null
      kmlLayerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (alignmentLayerRef.current) {
      alignmentLayerRef.current.remove()
      alignmentLayerRef.current = null
    }
    const feat = selectedAlignment?.geojson ? (selectedAlignment.geojson as any) : null
    if (!feat) return
    const layer = L.geoJSON(feat, {
      style: { color: '#22d3ee', weight: 4, opacity: 0.95 },
    })
    layer.addTo(map)
    alignmentLayerRef.current = layer
    try {
      const layers = [alignmentLayerRef.current, kmlLayerRef.current].filter(Boolean) as any[]
      if (!layers.length) return
      const bounds = layers.reduce((b, l) => {
        const lb = l.getBounds?.()
        if (!lb || !lb.isValid?.() ) return b
        return b ? b.extend(lb) : lb
      }, null as any)
      if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds.pad(0.1), { animate: false })
    } catch {
    }
  }, [selectedAlignment?.alignment_id, selectedAlignment?.geojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (kmlLayerRef.current) {
      kmlLayerRef.current.remove()
      kmlLayerRef.current = null
    }
    if (!showKml || !kmlFeature) return
    const layer = L.geoJSON(kmlFeature as any, {
      style: { color: '#f97316', weight: 4, opacity: 0.95 },
    })
    layer.addTo(map)
    kmlLayerRef.current = layer
    try {
      const layers = [alignmentLayerRef.current, kmlLayerRef.current].filter(Boolean) as any[]
      if (!layers.length) return
      const bounds = layers.reduce((b, l) => {
        const lb = l.getBounds?.()
        if (!lb || !lb.isValid?.() ) return b
        return b ? b.extend(lb) : lb
      }, null as any)
      if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds.pad(0.1), { animate: false })
    } catch {
    }
  }, [showKml, kmlFeature])

  return (
    <div className="p-4 text-slate-200">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">项目</div>
          <select
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">选择项目</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.name} ({p.project_id.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[220px]">
          <div className="text-xs text-slate-400">对齐线</div>
          <select
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
            value={alignmentId}
            onChange={(e) => setAlignmentId(e.target.value)}
          >
            <option value="">不指定（用已有映射）</option>
            {alignments.map((a) => (
              <option key={a.alignment_id} value={a.alignment_id}>
                {a.name} ({a.alignment_id.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">TBM 机号（可选）</div>
          <input
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            placeholder="TBM-01"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">分箱(m)</div>
          <input
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-24"
            type="number"
            value={binM}
            onChange={(e) => setBinM(Number(e.target.value))}
            min={1}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">工单阈值</div>
          <input
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-24"
            type="number"
            value={thresholdScore}
            onChange={(e) => setThresholdScore(Number(e.target.value))}
            min={0}
            max={100}
          />
        </div>

        <button
          className="bg-cyan-700 hover:bg-cyan-600 text-white rounded px-3 py-2 disabled:opacity-50"
          onClick={loadRisk}
          disabled={!projectId || loading}
        >
          刷新
        </button>

        <button
          className="bg-amber-700 hover:bg-amber-600 text-white rounded px-3 py-2 disabled:opacity-50"
          onClick={runAutoTickets}
          disabled={!projectId || loading}
        >
          生成工单
        </button>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded p-3 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={showKml} onChange={(e) => setShowKml(e.target.checked)} />
            显示隧道走向（KML）
          </label>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-400">来源</div>
            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
              value={kmlSource}
              onChange={(e) => setKmlSource(e.target.value === 'local' ? 'local' : 'repo')}
              disabled={!showKml}
            >
              <option value="repo">仓库内：YGL_KML.kml</option>
              <option value="local">本地选择</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-400">选择本地 KML（不上传）</div>
            <input
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml,text/xml,application/xml"
              className="text-sm"
              onChange={(e) => setLocalKmlFile(e.target.files?.[0] || null)}
              disabled={!showKml || kmlSource !== 'local'}
            />
          </div>
          <button
            className="bg-slate-800 hover:bg-slate-700 text-white rounded px-3 py-2 disabled:opacity-50"
            onClick={loadKmlForDisplay}
            disabled={!showKml || (kmlSource === 'local' && !localKmlFile) || loading}
          >
            刷新走向线
          </button>
          <div className="text-xs text-slate-400">KML：{kmlSource === 'repo' ? 'YGL_KML.kml' : (localKmlFile?.name || '未选择')}</div>
          <div className="text-xs text-slate-400">点数：{kmlInfo ? String(kmlInfo.points) : '-'}</div>
          <div className="text-xs text-slate-400">名称：{kmlInfo?.name || '-'}</div>
        </div>
      </div>

      {error && <div className="mb-3 text-red-300">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
          <div className="text-sm text-slate-300 mb-2">里程风险纵断面</div>
          <div style={{ height: 320 }}>
            <EChartsWrapper option={chartOption} loading={loading} />
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
          <div className="text-sm text-slate-300 mb-2">高风险区段（Top 8）</div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left py-1">里程段</th>
                  <th className="text-right py-1">风险</th>
                  <th className="text-right py-1">点位</th>
                  <th className="text-left py-1">原因</th>
                </tr>
              </thead>
              <tbody>
                {topBins.map((b) => (
                  <tr key={`${b.chainage_start}-${b.chainage_end}`} className="border-t border-slate-800">
                    <td className="py-1">{Math.round(b.chainage_start)}~{Math.round(b.chainage_end)}m</td>
                    <td className="py-1 text-right">{b.risk_score}</td>
                    <td className="py-1 text-right">{b.point_count}</td>
                    <td className="py-1">{(b.reasons || []).join('、')}</td>
                  </tr>
                ))}
                {!topBins.length && (
                  <tr>
                    <td className="py-2 text-slate-500" colSpan={4}>
                      暂无数据（需要先完成点位里程映射与沉降分析表）
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded p-3">
        <div className="text-sm text-slate-300 mb-2">对齐线预览</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <div ref={mapContainerRef} style={{ height: 320 }} className="rounded border border-slate-800" />
          </div>
          <div className="text-sm text-slate-400">
            <div>alignment_id：{alignmentId ? alignmentId.slice(0, 12) : '未选择'}</div>
            <div>名称：{selectedAlignment?.name || '-'}</div>
            <div>坐标点：{(() => {
              const feat: any = selectedAlignment?.geojson
              const coords = feat?.geometry?.coordinates
              return Array.isArray(coords) ? coords.length : '-'
            })()}</div>
            <div className="mt-2">KML：{showKml ? (kmlSource === 'repo' ? 'YGL_KML.kml' : (localKmlFile?.name || '未选择')) : '未显示'}</div>
            <div>KML 点数：{kmlInfo ? String(kmlInfo.points) : '-'}</div>
          </div>
        </div>
      </div>

      {autoTicketResult && (
        <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded p-3 text-sm">
          <div className="text-slate-300 mb-1">工单结果</div>
          <div className="text-slate-400">创建：{autoTicketResult.created?.length || 0}，跳过：{autoTicketResult.skipped?.length || 0}</div>
        </div>
      )}
    </div>
  )
}
