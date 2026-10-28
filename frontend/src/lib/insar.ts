export type Thresholds = { strong: number, mild: number }

export type RiskLevel = 'normal' | 'warning' | 'danger'

export type FeatureCollection = { type: 'FeatureCollection', features: any[] }
export type InsarMeta = { dataset?: string, cached?: boolean, feature_count?: number, total_feature_count?: number, value_field?: string, args?: Record<string, any> }

export type Indicator = 'velocity' | 'keyDate' | 'threshold'
export type FieldsInfo = { dataset: string, fields: string[], d_fields: string[], velocity_fields: string[], recommended_value_field: string }
export type SeriesData = { dataset: string, id: string, series: { date: string, value: number | null }[], properties?: Record<string, any> }
export type RiskPoint = { id: string, lat: number, lng: number, velocity: number, risk: RiskLevel }
export type RiskSummary = { total: number, danger: number, warning: number, normal: number, unknown: number, top: RiskPoint[] }
export type VelocityHistogram = { edges: number[], counts: number[], maxAbs: number, total: number }
export type VelocitySplit = { negative: number, positive: number, nearZero: number }
export type ChainageStats = { labels: string[], danger: number[], warning: number[], normal: number[], binSize: number, maxDistance: number, length: number, total: number }
export type RiskStats = { velocityHist: VelocityHistogram | null, velocitySplit: VelocitySplit, velocityTotal: number, chainage: ChainageStats | null }
export type ZoneLevel = 'danger' | 'warning'
export type ZoneDirection = 'subsidence' | 'uplift'
export type ZoneSummary = { id: string, level: ZoneLevel, direction: ZoneDirection, point_count: number, min_velocity: number | null, p95_velocity: number | null, bbox?: number[] | null, centroid?: number[] | null }
export type ExpertMeasure = { key: string, title: string, detail: string }
export type AdviceEntry = { text: string, updatedAt: number }
export type AdviceStore = { globalByDataset: Record<string, AdviceEntry>, pointByDataset: Record<string, Record<string, AdviceEntry>> }
export type RiskFilter = 'all' | 'danger' | 'warning' | 'normal'

export function formatKeyDateField(field: string) {
  const m = field.match(/^[dD]_(\d{8})$/)
  if (!m) return field
  const s = m[1]
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

export function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function classifyVelocity(v: number | null, thresholds: Thresholds) {
  if (v === null || !Number.isFinite(v)) return { label: '未知', color: '#7c8a9a' }
  const { strong, mild } = thresholds
  if (v <= -strong) return { label: `显著沉降 (≤ -${strong})`, color: '#ff3e5f' }
  if (v <= -mild) return { label: `轻微沉降 (-${strong}~-${mild})`, color: '#ff9e0d' }
  if (v < mild) return { label: `稳定 (-${mild}~${mild})`, color: '#00e676' }
  if (v < strong) return { label: `轻微抬升 (${mild}~${strong})`, color: '#0088ff' }
  return { label: `显著抬升 (≥ ${strong})`, color: '#bf5af2' }
}

/** Resolve velocity from feature properties, preferring an explicit field name. */
export function getVelocityFromProps(p: any, velocityFieldName?: string): number | null {
  const byField = velocityFieldName ? toNumberOrNull(p?.[velocityFieldName]) : null
  return byField ?? toNumberOrNull(p?.velocity ?? p?.vel ?? p?.rate ?? p?.value)
}

/**
 * Map velocity to risk buckets used by filters / grids.
 * Null/NaN → 'normal' (non-alerting) so map filters stay ternary; callers that
 * need an "unknown" count should check null before calling this.
 */
export function riskFromVelocity(v: number | null, thresholds: Thresholds): RiskLevel {
  if (v === null || !Number.isFinite(v)) return 'normal'
  if (v <= -thresholds.strong) return 'danger'
  if (v <= -thresholds.mild) return 'warning'
  return 'normal'
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * clamp(p, 0, 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const t = idx - lo
  return sorted[lo] * (1 - t) + sorted[hi] * t
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function safeDatasetName(s: string) {
  const cleaned = (s || '').trim().replace(/[^a-zA-Z0-9._-]/g, '')
  return cleaned || 'yanggaozhong'
}

export function valueToColor(value: number | null, maxAbs: number) {
  if (value === null || Number.isNaN(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) return '#7c8a9a'
  const v = clamp(value, -maxAbs, maxAbs)
  const n = v / maxAbs
  const t = Math.abs(n)
  if (n <= 0) return rgbToHex(lerp(255, 255, t), lerp(255, 90, t), lerp(255, 90, t))
  return rgbToHex(lerp(255, 60, t), lerp(255, 150, t), lerp(255, 255, t))
}

export function getFeatureId(feature: any, props: any) {
  const id = feature?.id ?? props?.id
  return id === undefined || id === null ? '' : String(id)
}

export function getLatLngFromFeature(feature: any) {
  const coords = feature?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = typeof coords[0] === 'number' ? coords[0] : Number(coords[0])
  const lat = typeof coords[1] === 'number' ? coords[1] : Number(coords[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function extractLineCoords(feature: any) {
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

export function expertMeasuresForRisk(level: RiskLevel): ExpertMeasure[] {
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

export function loadAdviceStore(): AdviceStore {
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
