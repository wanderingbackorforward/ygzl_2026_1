// -*- coding: utf-8 -*-
// Metrics Engine Context
// Provides centralized state management for metrics dashboard

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  useMonitoringPoints,
  useMonitoringPoint,
  useAlerts,
  useMetricConfigs,
  useEngineStatus,
  useCalculateMetrics,
} from '../hooks/useMetricsData'
import type {
  MonitoringPoint,
  MonitoringPointWithMetrics,
  AlertSummary,
  MetricConfig,
  EngineStatus,
  CalculationResult,
  PointType,
} from '../types/metrics'

// =============================================================================
// Context Value Interface
// =============================================================================

interface MetricsContextValue {
  // Monitoring Points
  points: MonitoringPoint[] | null
  pointsLoading: boolean
  pointsError: string | null
  refetchPoints: () => void

  // Selected Point
  selectedPointId: string | null
  selectPoint: (pointId: string | null) => void
  selectedPoint: MonitoringPointWithMetrics | null
  selectedPointLoading: boolean
  selectedPointError: string | null

  // Alerts
  alerts: AlertSummary[] | null
  alertsLoading: boolean
  alertsError: string | null
  refetchAlerts: () => void
  criticalCount: number
  warningCount: number

  // Metric Configs
  configs: MetricConfig[] | null
  configsLoading: boolean
  configsError: string | null
  refetchConfigs: () => void

  // Engine Status
  engineStatus: EngineStatus | null
  engineLoading: boolean
  engineError: string | null
  startEngine: (interval?: number) => Promise<void>
  stopEngine: () => Promise<void>
  refetchEngineStatus: () => void

  // Calculation
  calculating: boolean
  calculationError: string | null
  calculateForPoint: (pointId: string, metricTypes?: string[]) => Promise<CalculationResult[]>
  processAllPoints: () => Promise<{ processed: number; results: Record<string, CalculationResult[]> }>

  // Filters
  pointTypeFilter: PointType | null
  setPointTypeFilter: (type: PointType | null) => void
  statusFilter: 'active' | 'inactive' | null
  setStatusFilter: (status: 'active' | 'inactive' | null) => void
}

// =============================================================================
// Context Creation
// =============================================================================

const MetricsContext = createContext<MetricsContextValue | null>(null)

// =============================================================================
// Provider Component
// =============================================================================

interface MetricsProviderProps {
  children: ReactNode
}

export const MetricsProvider: React.FC<MetricsProviderProps> = ({ children }) => {
  // Filters
  const [pointTypeFilter, setPointTypeFilter] = useState<PointType | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | null>('active')

  // Selected point
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)

  // Fetch monitoring points
  const {
    data: points,
    loading: pointsLoading,
    error: pointsError,
    refetch: refetchPoints,
  } = useMonitoringPoints(pointTypeFilter || undefined, statusFilter || undefined)

  // Fetch selected point details
  const {
    data: selectedPoint,
    loading: selectedPointLoading,
    error: selectedPointError,
  } = useMonitoringPoint(selectedPointId)

  // Fetch alerts
  const {
    data: alerts,
    loading: alertsLoading,
    error: alertsError,
    refetch: refetchAlerts,
  } = useAlerts()

  // Fetch metric configs
  const {
    data: configs,
    loading: configsLoading,
    error: configsError,
    refetch: refetchConfigs,
  } = useMetricConfigs()

  // Engine status
  const {
    data: engineStatus,
    loading: engineLoading,
    error: engineError,
    refetch: refetchEngineStatus,
    startEngine,
    stopEngine,
  } = useEngineStatus()

  // Calculation actions
  const {
    calculating,
    error: calculationError,
    calculateForPoint,
    processAll: processAllPoints,
  } = useCalculateMetrics()

  // Select point callback
  const selectPoint = useCallback((pointId: string | null) => {
    setSelectedPointId(pointId)
  }, [])

  // Auto-select first point if none selected
  React.useEffect(() => {
    if (!selectedPointId && points && points.length > 0) {
      const firstPoint = points[0]
      if (firstPoint) {
        setSelectedPointId(firstPoint.point_id)
      }
    }
  }, [points, selectedPointId])

  // Calculate alert counts
  const criticalCount = alerts?.filter((a) => a.threshold_status === 'critical').length || 0
  const warningCount = alerts?.filter((a) => a.threshold_status === 'warning').length || 0

  // Context value
  const value: MetricsContextValue = {
    // Points
    points,
    pointsLoading,
    pointsError,
    refetchPoints,

    // Selected point
    selectedPointId,
    selectPoint,
    selectedPoint,
    selectedPointLoading,
    selectedPointError,

    // Alerts
    alerts,
    alertsLoading,
    alertsError,
    refetchAlerts,
    criticalCount,
    warningCount,

    // Configs
    configs,
    configsLoading,
    configsError,
    refetchConfigs,

    // Engine
    engineStatus,
    engineLoading,
    engineError,
    startEngine,
    stopEngine,
    refetchEngineStatus,

    // Calculation
    calculating,
    calculationError,
    calculateForPoint,
    processAllPoints,

    // Filters
    pointTypeFilter,
    setPointTypeFilter,
    statusFilter,
    setStatusFilter,
  }

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>
}

// =============================================================================
// Hook for consuming context
// =============================================================================

export function useMetrics(): MetricsContextValue {
  const context = useContext(MetricsContext)
  if (!context) {
    throw new Error('useMetrics must be used within a MetricsProvider')
  }
  return context
}

export default MetricsContext
