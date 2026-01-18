// -*- coding: utf-8 -*-
// Metrics Engine API Service
// Type-safe API calls for the metrics engine endpoints

import { API_BASE } from './api'
import type {
  MonitoringPoint,
  MonitoringPointWithMetrics,
  RawDataPoint,
  RawDataStats,
  MetricConfig,
  EngineeringMetric,
  AlertRule,
  MetricSnapshot,
  EngineStatus,
  AlertSummary,
  CalculationResult,
  MetricsApiResponse,
  MetricsListResponse,
} from '../types/metrics'

const METRICS_BASE = `${API_BASE}/metrics`

// =============================================================================
// Generic API helpers
// =============================================================================

async function metricsGet<T>(path: string): Promise<T> {
  const res = await fetch(`${METRICS_BASE}${path}`)
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Request failed: ${res.status}`)
  }
  const body = await res.json()
  if (!body.success && body.error) {
    throw new Error(body.error)
  }
  return body.data as T
}

async function metricsPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch(`${METRICS_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Request failed: ${res.status}`)
  }
  const body = await res.json()
  if (!body.success && body.error) {
    throw new Error(body.error)
  }
  return body.data as T
}

async function metricsPut<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${METRICS_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Request failed: ${res.status}`)
  }
  const body = await res.json()
  if (!body.success && body.error) {
    throw new Error(body.error)
  }
  return body.data as T
}

async function metricsDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${METRICS_BASE}${path}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Request failed: ${res.status}`)
  }
  const body = await res.json()
  if (!body.success && body.error) {
    throw new Error(body.error)
  }
  return body.data as T
}

// =============================================================================
// Monitoring Points API
// =============================================================================

export async function getMonitoringPoints(
  pointType?: string,
  status?: string
): Promise<MonitoringPoint[]> {
  const params = new URLSearchParams()
  if (pointType) params.append('point_type', pointType)
  if (status) params.append('status', status)
  const query = params.toString()
  return metricsGet<MonitoringPoint[]>(`/points${query ? `?${query}` : ''}`)
}

export async function getMonitoringPoint(
  pointId: string
): Promise<MonitoringPointWithMetrics> {
  return metricsGet<MonitoringPointWithMetrics>(`/points/${pointId}`)
}

export async function createMonitoringPoint(
  point: Partial<MonitoringPoint>
): Promise<MonitoringPoint> {
  return metricsPost<MonitoringPoint>('/points', point)
}

export async function updateMonitoringPoint(
  pointId: string,
  updates: Partial<MonitoringPoint>
): Promise<MonitoringPoint> {
  return metricsPut<MonitoringPoint>(`/points/${pointId}`, updates)
}

export async function deleteMonitoringPoint(pointId: string): Promise<void> {
  await metricsDelete<void>(`/points/${pointId}`)
}

// =============================================================================
// Raw Data API
// =============================================================================

export async function getRawData(
  pointId: string,
  options?: {
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<RawDataPoint[]> {
  const params = new URLSearchParams()
  if (options?.startDate) params.append('start_date', options.startDate)
  if (options?.endDate) params.append('end_date', options.endDate)
  if (options?.limit) params.append('limit', options.limit.toString())
  const query = params.toString()
  return metricsGet<RawDataPoint[]>(`/raw-data/${pointId}${query ? `?${query}` : ''}`)
}

export async function createRawData(data: {
  point_id: string
  measured_at: string
  raw_value: number
  unit?: string
  quality_flag?: string
  sensor_id?: string
}): Promise<RawDataPoint> {
  return metricsPost<RawDataPoint>('/raw-data', data)
}

export async function createRawDataBatch(
  dataPoints: Array<{
    point_id: string
    measured_at: string
    raw_value: number
    unit?: string
    quality_flag?: string
  }>
): Promise<{ created: number }> {
  return metricsPost<{ created: number }>('/raw-data/batch', { data: dataPoints })
}

export async function getRawDataStatistics(pointId: string): Promise<RawDataStats> {
  return metricsGet<RawDataStats>(`/raw-data/${pointId}/statistics`)
}

// =============================================================================
// Engineering Metrics API
// =============================================================================

export async function getEngineeringMetrics(
  pointId: string,
  metricType?: string
): Promise<EngineeringMetric[]> {
  const params = new URLSearchParams()
  if (metricType) params.append('metric_type', metricType)
  const query = params.toString()
  return metricsGet<EngineeringMetric[]>(`/engineering/${pointId}${query ? `?${query}` : ''}`)
}

export async function getLatestMetrics(pointId: string): Promise<EngineeringMetric[]> {
  return metricsGet<EngineeringMetric[]>(`/engineering/${pointId}/latest`)
}

export async function calculateMetrics(
  pointId: string,
  metricTypes?: string[]
): Promise<CalculationResult[]> {
  return metricsPost<CalculationResult[]>(`/engineering/${pointId}/calculate`, {
    metric_types: metricTypes,
  })
}

export async function processAllActivePoints(): Promise<{
  processed: number
  results: Record<string, CalculationResult[]>
}> {
  return metricsPost<{ processed: number; results: Record<string, CalculationResult[]> }>(
    '/engineering/process-all'
  )
}

export async function getAlerts(
  status?: 'warning' | 'critical',
  pointType?: string
): Promise<AlertSummary[]> {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (pointType) params.append('point_type', pointType)
  const query = params.toString()
  return metricsGet<AlertSummary[]>(`/engineering/alerts${query ? `?${query}` : ''}`)
}

// =============================================================================
// Metric Configurations API
// =============================================================================

export async function getMetricConfigs(
  metricType?: string,
  pointType?: string
): Promise<MetricConfig[]> {
  const params = new URLSearchParams()
  if (metricType) params.append('metric_type', metricType)
  if (pointType) params.append('point_type', pointType)
  const query = params.toString()
  return metricsGet<MetricConfig[]>(`/configs${query ? `?${query}` : ''}`)
}

export async function createMetricConfig(
  config: Partial<MetricConfig>
): Promise<MetricConfig> {
  return metricsPost<MetricConfig>('/configs', config)
}

export async function updateMetricConfig(
  metricType: string,
  updates: Partial<MetricConfig>
): Promise<MetricConfig> {
  return metricsPut<MetricConfig>(`/configs/${metricType}`, updates)
}

// =============================================================================
// Alert Rules API
// =============================================================================

export async function getAlertRules(isActive?: boolean): Promise<AlertRule[]> {
  const params = new URLSearchParams()
  if (isActive !== undefined) params.append('is_active', isActive.toString())
  const query = params.toString()
  return metricsGet<AlertRule[]>(`/alert-rules${query ? `?${query}` : ''}`)
}

export async function createAlertRule(rule: Partial<AlertRule>): Promise<AlertRule> {
  return metricsPost<AlertRule>('/alert-rules', rule)
}

export async function updateAlertRule(
  ruleId: number,
  updates: Partial<AlertRule>
): Promise<AlertRule> {
  return metricsPut<AlertRule>(`/alert-rules/${ruleId}`, updates)
}

// =============================================================================
// Snapshots API
// =============================================================================

export async function getSnapshots(options?: {
  snapshotType?: string
  ticketId?: number
  limit?: number
}): Promise<MetricSnapshot[]> {
  const params = new URLSearchParams()
  if (options?.snapshotType) params.append('snapshot_type', options.snapshotType)
  if (options?.ticketId) params.append('ticket_id', options.ticketId.toString())
  if (options?.limit) params.append('limit', options.limit.toString())
  const query = params.toString()
  return metricsGet<MetricSnapshot[]>(`/snapshots${query ? `?${query}` : ''}`)
}

export async function createSnapshot(options: {
  snapshot_type?: string
  point_ids?: string[]
  metric_types?: string[]
  notes?: string
}): Promise<MetricSnapshot> {
  return metricsPost<MetricSnapshot>('/snapshots', options)
}

export async function getTicketSnapshots(ticketId: number): Promise<MetricSnapshot[]> {
  return metricsGet<MetricSnapshot[]>(`/snapshots/ticket/${ticketId}`)
}

// =============================================================================
// Engine Control API
// =============================================================================

export async function getEngineStatus(): Promise<EngineStatus> {
  return metricsGet<EngineStatus>('/engine/status')
}

export async function startEngine(intervalSeconds?: number): Promise<{ message: string }> {
  return metricsPost<{ message: string }>('/engine/start', {
    interval_seconds: intervalSeconds,
  })
}

export async function stopEngine(): Promise<{ message: string }> {
  return metricsPost<{ message: string }>('/engine/stop')
}

// =============================================================================
// Dashboard Helper Functions
// =============================================================================

export async function getDashboardData(): Promise<{
  points: MonitoringPoint[]
  alerts: AlertSummary[]
  engineStatus: EngineStatus
  configs: MetricConfig[]
}> {
  const [points, alerts, engineStatus, configs] = await Promise.all([
    getMonitoringPoints(undefined, 'active'),
    getAlerts(),
    getEngineStatus(),
    getMetricConfigs(),
  ])
  return { points, alerts, engineStatus, configs }
}

export async function getPointDashboardData(pointId: string): Promise<{
  point: MonitoringPointWithMetrics
  rawData: RawDataPoint[]
  stats: RawDataStats
  metrics: EngineeringMetric[]
}> {
  const [point, rawData, stats, metrics] = await Promise.all([
    getMonitoringPoint(pointId),
    getRawData(pointId, { limit: 100 }),
    getRawDataStatistics(pointId),
    getLatestMetrics(pointId),
  ])
  return { point, rawData, stats, metrics }
}
