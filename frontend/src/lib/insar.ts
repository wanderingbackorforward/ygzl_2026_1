export type Thresholds = { strong: number, mild: number }

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

