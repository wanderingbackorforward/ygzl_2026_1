import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from '../../lib/api'

type MetricRange = {
  max_date?: string | null
  table?: string
  analysis_updated?: string | null
  archived?: boolean
}

type DataRange = {
  sensor_data?: MetricRange
  settlement?: MetricRange
  temperature?: MetricRange
  crack?: MetricRange
  vibration?: MetricRange
  tickets?: MetricRange
  generated_at?: string
}

type InsarDatasetItem = {
  name: string
  source: string
  updated_at: string | null
}

type InsarMeta = {
  items?: InsarDatasetItem[]
  source?: string
  updated_at?: string | null
}

// 同一会话只拉一次，页面切换不重复请求
let cached: DataRange | null = null
let inflight: Promise<DataRange> | null = null
let cachedInsar: InsarMeta | null = null

function loadDataRange(): Promise<DataRange> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = apiGet<DataRange>('/meta/data-range')
      .then(data => {
        cached = data
        inflight = null
        return data
      })
      .catch(err => {
        inflight = null
        throw err
      })
  }
  return inflight
}

function fmt(value?: string | null): string {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 16)
}

function routeKeys(pathname: string): { key: keyof DataRange; label: string }[] {
  if (pathname.startsWith('/overview')) {
    return [
      { key: 'settlement', label: '沉降' },
      { key: 'temperature', label: '温度' },
      { key: 'crack', label: '裂缝' },
    ]
  }
  if (pathname.startsWith('/settlement') || pathname.startsWith('/advanced')) {
    return [{ key: 'settlement', label: '沉降' }]
  }
  if (pathname.startsWith('/temperature')) return [{ key: 'temperature', label: '温度' }]
  if (pathname.startsWith('/cracks')) return [{ key: 'crack', label: '裂缝' }]
  if (pathname.startsWith('/vibration')) return [{ key: 'vibration', label: '振动' }]
  if (pathname.startsWith('/tickets')) return [{ key: 'tickets', label: '工单' }]
  return []
}

const HIDDEN_PREFIXES = ['/cover', '/three', '/shield-trajectory', '/modules', '/']

export default function DataCutoffBar() {
  const { pathname } = useLocation()
  const [range, setRange] = useState<DataRange | null>(cached)
  const [failed, setFailed] = useState(false)
  const [insarMeta, setInsarMeta] = useState<InsarMeta | null>(cachedInsar)
  const [insarFailed, setInsarFailed] = useState(false)

  const isHidden =
    HIDDEN_PREFIXES.includes(pathname) || pathname.startsWith('/cover')
  const keys = routeKeys(pathname)

  useEffect(() => {
    if (isHidden) return
    let alive = true
    loadDataRange()
      .then(data => { if (alive) setRange(data) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [isHidden])

  // InSAR 是文件数据集（Shapefile + GeoJSON），单独取数据集清单与更新时间
  useEffect(() => {
    if (!pathname.startsWith('/insar')) return
    if (cachedInsar) {
      setInsarMeta(cachedInsar)
      return
    }
    let alive = true
    apiGet<InsarMeta>('/insar/datasets')
      .then(data => {
        cachedInsar = data
        if (alive) {
          setInsarMeta(data)
          setInsarFailed(false)
        }
      })
      .catch(() => { if (alive) setInsarFailed(true) })
    return () => { alive = false }
  }, [pathname])

  if (isHidden) return null

  if (pathname.startsWith('/insar')) {
    const items = insarMeta?.items || []
    return (
      <div style={barStyle}>
        <span style={{ color: '#6b8db5' }}>InSAR 文件数据集</span>
        {insarFailed && (
          <span style={{ color: '#fbbf24' }}>数据集清单接口不可用（/api/insar/datasets）</span>
        )}
        {!insarFailed && !insarMeta && (
          <span style={{ color: '#8bb8e0' }}>加载中…</span>
        )}
        {items.map(item => (
          <span key={item.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#b0cfee' }}>{item.name}</span>
            <span style={{ color: '#8bb8e0' }}>{item.source || '—'}</span>
            <span style={{ color: '#8bb8e0' }}>更新 {fmt(item.updated_at)}</span>
          </span>
        ))}
      </div>
    )
  }

  if (keys.length === 0) return null

  if (failed) {
    return (
      <div style={barStyle}>
        <span style={{ color: '#fbbf24' }}>数据截止时间接口不可用（/api/meta/data-range）</span>
      </div>
    )
  }

  if (!range) return null

  return (
    <div style={barStyle}>
      <span style={{ color: '#6b8db5' }}>数据截止</span>
      {keys.map(({ key, label }) => {
        const item = range[key]
        const archived = !!item?.archived
        return (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#b0cfee' }}>{label}</span>
            <span style={{ color: archived ? '#fbbf24' : '#8bb8e0' }}>{fmt(item?.max_date)}</span>
            {archived && (
              <span style={{ fontSize: 11, color: '#fbbf24', border: '1px solid rgba(251,191,36,.5)', borderRadius: 4, padding: '0 4px' }}>
                归档
              </span>
            )}
          </span>
        )
      })}
      {pathname.startsWith('/temperature') && range.sensor_data?.max_date && (
        <span style={{ color: '#6b8db5' }}>原始监测 {fmt(range.sensor_data.max_date)}</span>
      )}
    </div>
  )
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 14,
  padding: '6px 18px',
  fontSize: 13,
  background: 'rgba(6,16,30,.92)',
  borderBottom: '1px solid rgba(64,174,255,.16)',
  color: '#8bb8e0',
}
