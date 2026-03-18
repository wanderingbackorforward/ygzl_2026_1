import { useState, useEffect } from 'react'
import { apiGet } from '../lib/api'
import type { MonitoringPoint } from '../types/three'

interface ApiPoint {
  point_id?: string
  id?: string
  name?: string
  latest_value?: number
  value?: number
  status?: string
  x?: number
  y?: number
  z?: number
}

function mapStatus(s?: string): MonitoringPoint['status'] {
  if (s === 'danger' || s === 'warning') return s
  return 'normal'
}

export function useMonitoringPoints(dataType: 'settlement' | 'temperature') {
  const [points, setPoints] = useState<MonitoringPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const path = dataType === 'settlement' ? '/points' : '/temperature/points'
    apiGet<ApiPoint[]>(path)
      .then(data => {
        const mapped: MonitoringPoint[] = (data || []).map((p, i) => ({
          id: p.point_id ?? p.id ?? String(i),
          name: p.name ?? p.point_id ?? p.id ?? String(i),
          x: p.x ?? 0,
          y: p.y ?? 0,
          z: p.z ?? 0,
          value: p.latest_value ?? p.value,
          status: mapStatus(p.status),
          type: dataType,
        }))
        setPoints(mapped)
      })
      .catch(e => {
        console.warn('[3D] 监测点加载失败:', e)
        setError(String(e))
        setPoints([])
      })
      .finally(() => setLoading(false))
  }, [dataType])

  return { points, loading, error }
}
