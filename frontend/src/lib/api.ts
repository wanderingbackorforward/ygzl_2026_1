function normalizeBase(base: string): string {
  const trimmed = base.trim()
  if (!trimmed) return '/api'
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

function getDefaultApiBase(): string {
  const envBase = normalizeBase(import.meta.env.VITE_API_BASE || '')
  if (envBase && envBase !== '/api') return envBase

  if (typeof window === 'undefined') return '/api'

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'

  const isVitePreviewPort = window.location.port === '5173' || window.location.port === '4173'

  if (!import.meta.env.DEV && isLocalhost && isVitePreviewPort) {
    return 'http://127.0.0.1:5000/api'
  }

  return '/api'
}

export const API_BASE = getDefaultApiBase()

function getStaticBase(): string {
  const envBase = import.meta.env.VITE_API_BASE || ''
  if (!envBase || envBase === '/api') return ''
  // 从 https://xxx.vercel.app/api 提取 https://xxx.vercel.app
  return envBase.replace(/\/api\/?$/, '')
}

export const STATIC_BASE = getStaticBase()

export async function apiGet<T>(path: string): Promise<T> {
  let res = await fetch(`${API_BASE}${path}`)
  // 冷启动偶发 500 → 等 1.5s 后自动重试一次
  if (res.status === 500) {
    await new Promise(r => setTimeout(r, 1500))
    res = await fetch(`${API_BASE}${path}`)
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const body = await res.json()
  if (body && typeof body === 'object') {
    if ('status' in body && body.status !== 'success' && 'message' in body) {
      throw new Error(body.message || 'API error')
    }
    if ('data' in body) return body.data as T
  }
  return body as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const resp = await res.json()
  if (resp && typeof resp === 'object') {
    if ('status' in resp && resp.status !== 'success' && 'message' in resp) {
      throw new Error(resp.message || 'API error')
    }
    if ('data' in resp) return resp.data as T
  }
  return resp as T
}

export interface AlertTicketInput {
  dataType: 'settlement' | 'temperature'
  pointId: string
  title: string
  description?: string
  anomalyType?: string
  severity?: string
  currentValue?: number | null
  threshold?: number | null
  sendEmail?: boolean
  source?: string
}

export interface CreatedTicket {
  id?: number | string
  ticket_number?: string
  priority?: string
}

/**
 * 唯一的建单入口：POST /api/tickets。
 * 只提交原始语义（data_type / severity / anomaly_type），
 * 类型、优先级、子类型映射全部由后端 modules/rules/tickets.py 决定。
 */
export async function createAlertTicket(input: AlertTicketInput): Promise<CreatedTicket> {
  return apiPost<CreatedTicket>('/tickets', {
    title: input.title,
    description: input.description || '',
    data_type: input.dataType,
    anomaly_type: input.anomalyType || '',
    severity: input.severity || 'medium',
    monitoring_point_id: input.pointId,
    current_value: input.currentValue ?? null,
    threshold_value: input.threshold ?? null,
    status: 'PENDING',
    creator_id: 'system',
    creator_name: '系统自动',
    auto_created: true,
    send_email: input.sendEmail !== false,
    alert_data: {
      anomaly_type: input.anomalyType || '',
      severity: input.severity || '',
      detected_at: new Date().toISOString(),
    },
    metadata: {
      source: input.source || 'frontend',
      auto_created: true,
      data_type: input.dataType,
    },
  })
}

// ==================== 振动规则（GB 6722 由后端 rules/vibration.py 唯一计算）====================

export interface VibrationChannelInput {
  channel_id: number
  ppv: number
  dominant_freq: number
}

export interface VibrationThresholds {
  warn: number
  alert: number
  stop: number
  frequency_band?: string
  frequency_label?: string
}

export interface VibrationAdvice {
  level: 'safe' | 'warn' | 'alert' | 'stop'
  icon: string
  color: string
  message: string
  actions: string[]
}

export interface VibrationChannelAnalysis {
  channel_id: number
  ppv: number
  dominant_freq: number
  thresholds: VibrationThresholds
  alert_level: 'safe' | 'warn' | 'alert' | 'stop'
  status: 'normal' | 'warning' | 'alert'
  advice: VibrationAdvice
}

export interface VibrationSafetyScore {
  score: number
  level: 'safe' | 'caution' | 'danger'
  factors: string[]
  recommendation: string
}

export interface VibrationAnalyzeResult {
  channels: VibrationChannelAnalysis[]
  summary: {
    max_ppv: number
    thresholds: VibrationThresholds
    alert_count: number
    exceed_ratio: number
    score: VibrationSafetyScore
  } | null
}

export async function analyzeVibration(input: {
  structure_type: string
  condition: string
  distance: number
  channels: VibrationChannelInput[]
}): Promise<VibrationAnalyzeResult> {
  return apiPost<VibrationAnalyzeResult>('/vibration/analyze', input)
}

export async function calculateVibration(input: {
  site_type: string
  Q: number
  R?: number
  v_limit?: number
}): Promise<{
  predicted_ppv: number | null
  safe_distance: number | null
  coefficients: { K: number; alpha: number }
}> {
  return apiPost('/vibration/calculate', input)
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const resp = await res.json()
  if (resp && typeof resp === 'object') {
    if ('status' in resp && resp.status !== 'success' && 'message' in resp) {
      throw new Error(resp.message || 'API error')
    }
    if ('success' in resp && resp.success === false && 'message' in resp) {
      throw new Error(resp.message || 'API error')
    }
    if ('data' in resp) return resp.data as T
  }
  return resp as T
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const resp = await res.json()
  if (resp && typeof resp === 'object') {
    if ('status' in resp && resp.status !== 'success' && 'message' in resp) {
      throw new Error(resp.message || 'API error')
    }
    if ('success' in resp && resp.success === false && 'message' in resp) {
      throw new Error(resp.message || 'API error')
    }
    if ('data' in resp) return resp.data as T
  }
  return resp as T
}
