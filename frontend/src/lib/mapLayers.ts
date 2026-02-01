import L from 'leaflet'

export type RasterLayerKind = 'xyz' | 'wms'

export type RasterLayerDef = {
  id: string
  name: string
  kind: RasterLayerKind
  url: string
  attribution?: string
  maxZoom?: number
  minZoom?: number
  opacity?: number
  tms?: boolean
  tileSize?: number
  bounds?: [number, number, number, number]
  default?: boolean
  wmsLayers?: string
  wmsFormat?: string
  wmsTransparent?: boolean
}

function safeId(input: unknown) {
  const s = String(input || '').trim()
  const cleaned = s.replace(/[^a-zA-Z0-9._-]/g, '')
  return cleaned || `layer_${Math.random().toString(16).slice(2)}`
}

function toNumberOrUndef(input: unknown) {
  if (input === null || input === undefined) return undefined
  const n = typeof input === 'number' ? input : Number(input)
  return Number.isFinite(n) ? n : undefined
}

function toBoundsOrUndef(input: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(input) || input.length !== 4) return undefined
  const a = input.map((x) => toNumberOrUndef(x))
  if (a.some((x) => x === undefined)) return undefined
  return a as [number, number, number, number]
}

function normalizeLayerDef(input: any): RasterLayerDef | null {
  if (!input || typeof input !== 'object') return null
  const name = String(input.name || '').trim()
  const url = String(input.url || '').trim()
  if (!name || !url) return null
  const kind: RasterLayerKind = input.kind === 'wms' ? 'wms' : 'xyz'
  return {
    id: safeId(input.id || name),
    name,
    kind,
    url,
    attribution: typeof input.attribution === 'string' ? input.attribution : undefined,
    maxZoom: toNumberOrUndef(input.maxZoom),
    minZoom: toNumberOrUndef(input.minZoom),
    opacity: toNumberOrUndef(input.opacity),
    tms: typeof input.tms === 'boolean' ? input.tms : undefined,
    tileSize: toNumberOrUndef(input.tileSize),
    bounds: toBoundsOrUndef(input.bounds),
    default: Boolean(input.default),
    wmsLayers: typeof input.wmsLayers === 'string' ? input.wmsLayers : (typeof input.layers === 'string' ? input.layers : undefined),
    wmsFormat: typeof input.wmsFormat === 'string' ? input.wmsFormat : undefined,
    wmsTransparent: typeof input.wmsTransparent === 'boolean' ? input.wmsTransparent : undefined,
  }
}

export async function loadOpticalRasterLayers(signal?: AbortSignal): Promise<RasterLayerDef[]> {
  try {
    const res = await fetch('/static/data/optical/layers.json', { signal })
    if (!res.ok) return []
    const body = await res.json().catch(() => null as any)
    if (!Array.isArray(body)) return []
    return body.map(normalizeLayerDef).filter(Boolean) as RasterLayerDef[]
  } catch (e: any) {
    if (e?.name === 'AbortError') return []
    return []
  }
}

export function createRasterLayer(def: RasterLayerDef): L.Layer | null {
  if (def.kind === 'wms') {
    if (!def.wmsLayers) return null
    const layer = L.tileLayer.wms(def.url, {
      layers: def.wmsLayers,
      format: def.wmsFormat || 'image/png',
      transparent: def.wmsTransparent ?? true,
      maxZoom: def.maxZoom,
      minZoom: def.minZoom,
      attribution: def.attribution,
      opacity: def.opacity,
      bounds: def.bounds ? L.latLngBounds([def.bounds[1], def.bounds[0]], [def.bounds[3], def.bounds[2]]) : undefined,
    } as any)
    return layer
  }

  const layer = L.tileLayer(def.url, {
    maxZoom: def.maxZoom,
    minZoom: def.minZoom,
    attribution: def.attribution,
    opacity: def.opacity,
    tms: def.tms,
    tileSize: def.tileSize,
    bounds: def.bounds ? L.latLngBounds([def.bounds[1], def.bounds[0]], [def.bounds[3], def.bounds[2]]) : undefined,
    crossOrigin: true,
  } as any)
  return layer
}

export function createBuiltInBaseLayers(): Record<string, L.Layer> {
  const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
  return {
    '影像(Esri)': esriImagery,
    '地形(Esri)': esriTopo,
    'OSM': osm,
  }
}

export type InstallRasterLayersOptions = {
  position?: L.ControlPosition
  defaultBaseLayerName?: string
  showControl?: boolean
  includeOpticalConfig?: boolean
}

export function installRasterBaseLayers(map: L.Map, options: InstallRasterLayersOptions = {}) {
  const builtIn = createBuiltInBaseLayers()
  const defaultName = options.defaultBaseLayerName || '影像(Esri)'
  const defaultLayer = builtIn[defaultName] || Object.values(builtIn)[0]
  if (defaultLayer) defaultLayer.addTo(map)

  const showControl = options.showControl ?? true
  const control = showControl ? L.control.layers(builtIn, {}, { position: options.position || 'topright' }).addTo(map) : null

  const abortController = new AbortController()
  const includeOpticalConfig = options.includeOpticalConfig ?? true

  let lastDefault: L.Layer | null = defaultLayer || null

  if (includeOpticalConfig) {
    ;(async () => {
      const defs = await loadOpticalRasterLayers(abortController.signal)
      if (abortController.signal.aborted) return
      for (const def of defs) {
        const layer = createRasterLayer(def)
        if (!layer) continue
        if (control) control.addBaseLayer(layer, def.name)
        if (def.default) {
          if (lastDefault && map.hasLayer(lastDefault)) map.removeLayer(lastDefault)
          layer.addTo(map)
          lastDefault = layer
        }
      }
    })()
  }

  const cleanup = () => {
    abortController.abort()
    if (control) control.remove()
  }

  return { control, cleanup }
}
