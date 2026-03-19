import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { installRasterBaseLayers } from '../../lib/mapLayers'
import type { DeviationRecord } from './types'
import { deviationToColor } from './types'

interface Props {
  alignmentGeoJSON: unknown
  records: DeviationRecord[]
  selectedRing: number | null
  onRingClick: (ring: number) => void
}

/** Interpolate a point along a LineString at fraction t (0..1) */
function interpolateLineString(coords: number[][], t: number): [number, number] | null {
  if (!coords || coords.length < 2) return null
  // compute total length
  let total = 0
  const segs: number[] = []
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0]
    const dy = coords[i][1] - coords[i - 1][1]
    const d = Math.sqrt(dx * dx + dy * dy)
    segs.push(d)
    total += d
  }
  if (total === 0) return [coords[0][1], coords[0][0]]
  let target = t * total
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const frac = segs[i] > 0 ? target / segs[i] : 0
      const lng = coords[i][0] + frac * (coords[i + 1][0] - coords[i][0])
      const lat = coords[i][1] + frac * (coords[i + 1][1] - coords[i][1])
      return [lat, lng]
    }
    target -= segs[i]
  }
  return [coords[coords.length - 1][1], coords[coords.length - 1][0]]
}

export default function TrajectoryMap({ alignmentGeoJSON, records, selectedRing, onRingClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    }).setView([31.245, 121.575], 14)
    const { cleanup } = installRasterBaseLayers(map, { defaultBaseLayerName: '影像(Esri)' })
    mapRef.current = map
    layersRef.current = L.layerGroup().addTo(map)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => {
      cleanup()
      window.removeEventListener('resize', onResize)
      map.remove()
      mapRef.current = null
      layersRef.current = null
    }
  }, [])

  // render layers
  const render = useCallback(() => {
    const map = mapRef.current
    const lg = layersRef.current
    if (!map || !lg) return
    lg.clearLayers()

    // parse alignment geojson
    let coords: number[][] | null = null
    const geo: any = typeof alignmentGeoJSON === 'string'
      ? (() => { try { return JSON.parse(alignmentGeoJSON) } catch { return null } })()
      : alignmentGeoJSON
    if (geo) {
      const geom = geo.type === 'Feature' ? geo.geometry : geo
      if (geom && geom.type === 'LineString') {
        coords = geom.coordinates as number[][]
        // design alignment line (cyan)
        L.geoJSON({ type: 'Feature', geometry: geom, properties: {} } as any, {
          style: { color: '#22d3ee', weight: 4, opacity: 0.9 },
        }).addTo(lg)
      }
    }

    if (!records.length) return

    // compute total chainage range for interpolation
    const minCh = records[0]?.chainage_m ?? 0
    const maxCh = records[records.length - 1]?.chainage_m ?? 1
    const chRange = maxCh - minCh || 1

    // plot deviation circles
    const latLngs: L.LatLng[] = []
    records.forEach((r) => {
      let pos: [number, number] | null = null
      if (coords) {
        const t = (r.chainage_m - minCh) / chRange
        pos = interpolateLineString(coords, Math.max(0, Math.min(1, t)))
      }
      if (!pos) return
      const color = deviationToColor(Math.max(Math.abs(r.h_dev_mm), Math.abs(r.v_dev_mm)))
      const isSelected = r.ring_no === selectedRing
      const marker = L.circleMarker([pos[0], pos[1]], {
        radius: isSelected ? 8 : 4,
        fillColor: color,
        color: isSelected ? '#fff' : color,
        weight: isSelected ? 2 : 1,
        fillOpacity: 0.85,
      })
      marker.bindTooltip(
        `环${r.ring_no} | ${r.chainage_m}m\n水平${r.h_dev_mm}mm 竖直${r.v_dev_mm}mm`,
        { direction: 'top' },
      )
      marker.on('click', () => onRingClick(r.ring_no))
      marker.addTo(lg)
      latLngs.push(L.latLng(pos[0], pos[1]))
    })

    // pulse marker for latest ring
    const last = records[records.length - 1]
    if (last && coords) {
      const t = (last.chainage_m - minCh) / chRange
      const pos = interpolateLineString(coords, Math.max(0, Math.min(1, t)))
      if (pos) {
        L.circleMarker([pos[0], pos[1]], {
          radius: 10, fillColor: '#00e5ff', color: '#00e5ff',
          weight: 2, fillOpacity: 0.4,
        }).addTo(lg)
      }
    }

    // fit bounds
    if (latLngs.length > 1) {
      const bounds = L.latLngBounds(latLngs)
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.15), { animate: false })
    }
  }, [alignmentGeoJSON, records, selectedRing, onRingClick])

  useEffect(() => { render() }, [render])

  return (
    <div
      ref={containerRef}
      className="w-full rounded border border-slate-700"
      style={{ height: 400 }}
    />
  )
}
