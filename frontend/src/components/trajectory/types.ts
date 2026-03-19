// Trajectory V2 types

export interface DeviationRecord {
  ring_no: number
  chainage_m: number
  ts: string | null
  pitch_deg: number
  yaw_deg: number
  roll_deg: number
  h_dev_mm: number
  v_dev_mm: number
  thrust_kN?: number | null
  torque_kNm?: number | null
  face_pressure_kPa?: number | null
  advance_rate_mm_min?: number | null
  cutterhead_rpm?: number | null
}

export interface StatGroup {
  max: number
  min: number
  mean: number
  std: number
  skewness: number
  kurtosis: number
  exceed_count: number
  exceed_total: number
}

export interface TrendInfo {
  slope: number
  label: string
  recent_rings: number
  intercept: number
  r2: number
}

export interface DeviationSummary {
  current_ring: number
  current_chainage_m: number
  total_length_m: number
  h_dev: StatGroup
  v_dev: StatGroup
  roll: StatGroup
  h_trend: TrendInfo
  v_trend: TrendInfo
  quality: { skewness: number; kurtosis: number; label: string }
}

export interface AdviceItem {
  type: 'horizontal' | 'vertical' | 'roll'
  severity: 'info' | 'warning' | 'critical'
  text: string
  monitor_rings: number
}

export interface CorrectionAdvice {
  based_on_recent_rings: number
  current_h_dev_mm: number
  current_v_dev_mm: number
  current_roll_deg: number
  h_direction: string
  v_direction: string
  advice: AdviceItem[]
  overall_status: string
}

export interface PredictionPoint {
  ring_no: number
  predicted_mm: number
  upper_mm: number
  lower_mm: number
}

export interface PredictionResult {
  h_prediction: PredictionPoint[]
  v_prediction: PredictionPoint[]
  h_exceed_ring: number | null
  v_exceed_ring: number | null
  regression: { h_slope: number; h_r2: number; v_slope: number; v_r2: number }
}

export interface RiskBin {
  chainage_start: number
  chainage_end: number
  point_count: number
  risk_score: number
  risk_priority: string
  reasons: string[]
  max_abs_current_value?: number | null
  max_abs_change_rate?: number | null
  worst_point_id?: string | null
}

export interface RiskBinsResponse {
  project_id: string
  bins: RiskBin[]
  points: number
  bin_m: number
}

/** Color scale: dev_mm -> hex color */
export function deviationToColor(dev_mm: number): string {
  const a = Math.abs(dev_mm)
  if (a <= 20) return '#22c55e'
  if (a <= 35) return '#eab308'
  if (a <= 50) return '#f97316'
  return '#ef4444'
}

/** Sliding window mean */
export function slidingMean(values: number[], w = 10): (number | null)[] {
  return values.map((_, i) => {
    if (i < w - 1) return null
    let s = 0
    for (let j = i - w + 1; j <= i; j++) s += values[j]
    return s / w
  })
}

/** Histogram bins */
export function computeHistogram(values: number[], binCount = 20) {
  if (!values.length) return { bins: [], binWidth: 0, min: 0, max: 0 }
  const mn = Math.min(...values)
  const mx = Math.max(...values)
  const bw = (mx - mn) / binCount || 1
  const bins = Array.from({ length: binCount }, (_, i) => ({
    center: mn + (i + 0.5) * bw,
    count: 0,
  }))
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - mn) / bw), binCount - 1)
    if (idx >= 0) bins[idx].count++
  })
  return { bins, binWidth: bw, min: mn, max: mx }
}
