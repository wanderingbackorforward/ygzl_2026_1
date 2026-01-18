// -*- coding: utf-8 -*-
// Metrics Engine Data Hooks
// Custom hooks for fetching and managing metrics engine data

import { useState, useEffect, useCallback } from 'react'
import * as metricsApi from '../lib/metricsApi'
import type {
  MonitoringPoint,
  MonitoringPointWithMetrics,
  RawDataPoint,
  RawDataStats,
  MetricConfig,
  EngineeringMetric,
  AlertRule,
  AlertSummary,
  AlertsResponse,
  EngineStatus,
  CalculationResult,
} from '../types/metrics'

// =============================================================================
// Generic Hook Result Interface
// =============================================================================

export interface UseDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// =============================================================================
// Monitoring Points Hooks
// =============================================================================

export function useMonitoringPoints(
  pointType?: string,
  status?: string
): UseDataResult<MonitoringPoint[]> {
  const [data, setData] = useState<MonitoringPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getMonitoringPoints(pointType, status)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring points')
    } finally {
      setLoading(false)
    }
  }, [pointType, status])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useMonitoringPoint(
  pointId: string | null
): UseDataResult<MonitoringPointWithMetrics> {
  const [data, setData] = useState<MonitoringPointWithMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getMonitoringPoint(pointId)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring point')
    } finally {
      setLoading(false)
    }
  }, [pointId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// =============================================================================
// Raw Data Hooks
// =============================================================================

export function useRawData(
  pointId: string | null,
  options?: { startDate?: string; endDate?: string; limit?: number }
): UseDataResult<RawDataPoint[]> {
  const [data, setData] = useState<RawDataPoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getRawData(pointId, options)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load raw data')
    } finally {
      setLoading(false)
    }
  }, [pointId, options?.startDate, options?.endDate, options?.limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useRawDataStats(pointId: string | null): UseDataResult<RawDataStats> {
  const [data, setData] = useState<RawDataStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getRawDataStatistics(pointId)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }, [pointId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// =============================================================================
// Engineering Metrics Hooks
// =============================================================================

export function useEngineeringMetrics(
  pointId: string | null,
  metricType?: string
): UseDataResult<EngineeringMetric[]> {
  const [data, setData] = useState<EngineeringMetric[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getEngineeringMetrics(pointId, metricType)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load engineering metrics')
    } finally {
      setLoading(false)
    }
  }, [pointId, metricType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useLatestMetrics(pointId: string | null): UseDataResult<EngineeringMetric[]> {
  const [data, setData] = useState<EngineeringMetric[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getLatestMetrics(pointId)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load latest metrics')
    } finally {
      setLoading(false)
    }
  }, [pointId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// =============================================================================
// Alerts Hook
// =============================================================================

export function useAlerts(
  status?: 'warning' | 'critical',
  pointType?: string
): UseDataResult<AlertsResponse> {
  const [data, setData] = useState<AlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getAlerts(status, pointType)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [status, pointType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// =============================================================================
// Metric Configurations Hook
// =============================================================================

export function useMetricConfigs(
  metricType?: string,
  pointType?: string
): UseDataResult<MetricConfig[]> {
  const [data, setData] = useState<MetricConfig[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getMetricConfigs(metricType, pointType)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metric configs')
    } finally {
      setLoading(false)
    }
  }, [metricType, pointType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// =============================================================================
// Alert Rules Hook
// =============================================================================

export function useAlertRules(isActive?: boolean): UseDataResult<AlertRule[]> {
  const [data, setData] = useState<AlertRule[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getAlertRules(isActive)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alert rules')
    } finally {
      setLoading(false)
    }
  }, [isActive])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// =============================================================================
// Engine Status Hook
// =============================================================================

export function useEngineStatus(): UseDataResult<EngineStatus> & {
  startEngine: (interval?: number) => Promise<void>
  stopEngine: () => Promise<void>
} {
  const [data, setData] = useState<EngineStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getEngineStatus()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load engine status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const startEngine = useCallback(async (interval?: number) => {
    try {
      await metricsApi.startEngine(interval)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start engine')
    }
  }, [fetchData])

  const stopEngine = useCallback(async () => {
    try {
      await metricsApi.stopEngine()
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop engine')
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData, startEngine, stopEngine }
}

// =============================================================================
// Calculate Metrics Hook
// =============================================================================

export function useCalculateMetrics(): {
  calculating: boolean
  error: string | null
  calculateForPoint: (pointId: string, metricTypes?: string[]) => Promise<CalculationResult[]>
  processAll: () => Promise<{ processed: number; results: Record<string, CalculationResult[]> }>
} {
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateForPoint = useCallback(
    async (pointId: string, metricTypes?: string[]) => {
      setCalculating(true)
      setError(null)
      try {
        const result = await metricsApi.calculateMetrics(pointId, metricTypes)
        return result
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Calculation failed'
        setError(errMsg)
        throw e
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  const processAll = useCallback(async () => {
    setCalculating(true)
    setError(null)
    try {
      const result = await metricsApi.processAllActivePoints()
      return result
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Processing failed'
      setError(errMsg)
      throw e
    } finally {
      setCalculating(false)
    }
  }, [])

  return { calculating, error, calculateForPoint, processAll }
}

// =============================================================================
// Dashboard Data Hook (combines multiple data sources)
// =============================================================================

export function useMetricsDashboard(): {
  points: MonitoringPoint[] | null
  alerts: AlertSummary[] | null
  engineStatus: EngineStatus | null
  configs: MetricConfig[] | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [points, setPoints] = useState<MonitoringPoint[] | null>(null)
  const [alerts, setAlerts] = useState<AlertSummary[] | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null)
  const [configs, setConfigs] = useState<MetricConfig[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricsApi.getDashboardData()
      setPoints(result.points)
      setAlerts(result.alerts)
      setEngineStatus(result.engineStatus)
      setConfigs(result.configs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { points, alerts, engineStatus, configs, loading, error, refetch: fetchData }
}
