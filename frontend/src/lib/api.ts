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

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
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
