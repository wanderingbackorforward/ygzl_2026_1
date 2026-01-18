// -*- coding: utf-8 -*-
// Metrics Dashboard Page
// Engineering metrics monitoring dashboard with alerts and configurations

import React, { useState, useCallback } from 'react'
import { LayoutProvider } from '../contexts/LayoutContext'
import { MetricsProvider, useMetrics } from '../contexts/MetricsContext'
import { DashboardGrid } from '../components/layout/DashboardGrid'
import { FullscreenModal } from '../components/layout/FullscreenModal'
import type { CardConfig, CardComponentProps } from '../types/layout'
import type { ThresholdStatus, PointType } from '../types/metrics'

import '../styles/variables.css'
import '../styles/cards.css'
import '../styles/grid.css'

// =============================================================================
// Status Badge Component
// =============================================================================

const StatusBadge: React.FC<{ status: ThresholdStatus }> = ({ status }) => {
  const colors: Record<ThresholdStatus, string> = {
    normal: '#00e5ff',
    warning: '#ffab00',
    critical: '#ff3e5f',
  }
  const labels: Record<ThresholdStatus, string> = {
    normal: '[正常]',
    warning: '[警告]',
    critical: '[严重]',
  }
  return (
    <span
      style={{
        color: colors[status],
        fontWeight: 'bold',
        fontSize: '0.85rem',
        textShadow: `0 0 8px ${colors[status]}`,
      }}
    >
      {labels[status]}
    </span>
  )
}

// =============================================================================
// Engine Status Card Component
// =============================================================================

const EngineStatusCard: React.FC<CardComponentProps> = () => {
  const {
    engineStatus,
    engineLoading,
    engineError,
    startEngine,
    stopEngine,
  } = useMetrics()

  const handleToggle = async () => {
    try {
      if (engineStatus?.background_processing) {
        await stopEngine()
      } else {
        await startEngine(60)
      }
    } catch (e) {
      console.error('Engine toggle error:', e)
    }
  }

  if (engineLoading) {
    return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>加载中...</div>
  }

  if (engineError) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#ff3e5f', marginBottom: '0.5rem' }}>连接错误</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          请确保后端服务已启动
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      {engineStatus && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
              后台处理:
            </span>
            <span
              style={{
                color: engineStatus.background_processing ? '#00e5ff' : '#888',
                fontWeight: 'bold',
              }}
            >
              {engineStatus.background_processing ? '[运行中]' : '[已停止]'}
            </span>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
              处理间隔:
            </span>
            <span style={{ color: 'var(--text-primary)' }}>
              {engineStatus.processing_interval}秒
            </span>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
              配置缓存:
            </span>
            <span style={{ color: 'var(--text-primary)' }}>
              {engineStatus.config_cache_size} 项
            </span>
          </div>
          <button
            onClick={handleToggle}
            style={{
              background: engineStatus.background_processing
                ? 'rgba(255, 62, 95, 0.2)'
                : 'rgba(0, 229, 255, 0.2)',
              border: `1px solid ${engineStatus.background_processing ? '#ff3e5f' : '#00e5ff'}`,
              color: engineStatus.background_processing ? '#ff3e5f' : '#00e5ff',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              borderRadius: '4px',
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 'bold',
              width: '100%',
            }}
          >
            {engineStatus.background_processing ? '[停止引擎]' : '[启动引擎]'}
          </button>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Alerts Summary Card Component
// =============================================================================

const AlertsSummaryCard: React.FC<CardComponentProps> = () => {
  const { alerts, alertsLoading, alertsError, criticalCount, warningCount, selectPoint } =
    useMetrics()

  if (alertsLoading) {
    return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>加载中...</div>
  }

  if (alertsError) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#ff3e5f', marginBottom: '0.5rem' }}>连接错误</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          请确保后端服务已启动
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'rgba(255, 62, 95, 0.1)',
            border: '1px solid #ff3e5f',
            borderRadius: '4px',
            padding: '0.75rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff3e5f' }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>严重告警</div>
        </div>
        <div
          style={{
            flex: 1,
            background: 'rgba(255, 171, 0, 0.1)',
            border: '1px solid #ffab00',
            borderRadius: '4px',
            padding: '0.75rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffab00' }}>
            {warningCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>警告</div>
        </div>
      </div>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {alerts && alerts.length > 0 ? (
          alerts.slice(0, 5).map((alert, idx) => (
            <div
              key={idx}
              onClick={() => selectPoint(alert.point_id)}
              style={{
                padding: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{alert.point_name}</span>
                <StatusBadge status={alert.threshold_status} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {alert.metric_name}: {alert.computed_value.toFixed(2)} {alert.unit}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
            暂无活跃告警
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Points Overview Card Component
// =============================================================================

const PointsOverviewCard: React.FC<CardComponentProps> = () => {
  const {
    points,
    pointsLoading,
    pointsError,
    selectedPointId,
    selectPoint,
    pointTypeFilter,
    setPointTypeFilter,
  } = useMetrics()

  const pointTypes: (PointType | null)[] = [null, 'settlement', 'crack', 'temperature', 'vibration']
  const typeLabels: Record<string, string> = {
    '': '全部',
    settlement: '沉降',
    crack: '裂缝',
    temperature: '温度',
    vibration: '振动',
  }

  if (pointsLoading) {
    return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>加载中...</div>
  }

  if (pointsError) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#ff3e5f', marginBottom: '0.5rem' }}>连接错误</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          请确保后端服务已启动
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {pointTypes.map((type) => (
          <button
            key={type || 'all'}
            onClick={() => setPointTypeFilter(type)}
            style={{
              background:
                pointTypeFilter === type ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${pointTypeFilter === type ? '#00e5ff' : 'rgba(255,255,255,0.2)'}`,
              color: pointTypeFilter === type ? '#00e5ff' : 'var(--text-secondary)',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontFamily: 'Rajdhani, sans-serif',
            }}
          >
            {typeLabels[type || '']}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
        {points && points.length > 0 ? (
          points.map((point) => (
            <div
              key={point.point_id}
              onClick={() => selectPoint(point.point_id)}
              style={{
                padding: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                background:
                  selectedPointId === point.point_id ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                borderLeft:
                  selectedPointId === point.point_id
                    ? '3px solid #00e5ff'
                    : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {point.point_name}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{typeLabels[point.point_type] || point.point_type}</span>
                <span style={{ color: point.status === 'active' ? '#00e5ff' : '#888' }}>
                  [{point.status === 'active' ? '启用' : '停用'}]
                </span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
            暂无监测点
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Selected Point Details Card Component
// =============================================================================

const PointDetailsCard: React.FC<CardComponentProps> = () => {
  const { selectedPoint, selectedPointLoading, selectedPointError } = useMetrics()

  const typeLabels: Record<string, string> = {
    settlement: '沉降',
    crack: '裂缝',
    temperature: '温度',
    vibration: '振动',
  }

  if (selectedPointLoading) {
    return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>加载中...</div>
  }

  if (selectedPointError) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#ff3e5f', marginBottom: '0.5rem' }}>加载失败</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {selectedPointError}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      {selectedPoint ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: '#00e5ff',
                marginBottom: '0.5rem',
              }}
            >
              {selectedPoint.point_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ID: {selectedPoint.point_id}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>类型: </span>
              <span style={{ color: 'var(--text-primary)' }}>
                {typeLabels[selectedPoint.point_type] || selectedPoint.point_type}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>状态: </span>
              <span style={{ color: selectedPoint.status === 'active' ? '#00e5ff' : '#888' }}>
                [{selectedPoint.status === 'active' ? '启用' : '停用'}]
              </span>
            </div>
            {selectedPoint.description && (
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>描述: </span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedPoint.description}</span>
              </div>
            )}
            {selectedPoint.threshold_config && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  阈值配置:
                </div>
                <div style={{ paddingLeft: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#ffab00' }}>警告: </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {selectedPoint.threshold_config.warning}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#ff3e5f' }}>严重: </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {selectedPoint.threshold_config.critical}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {selectedPoint.latest_metrics && selectedPoint.latest_metrics.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: '0.5rem',
                }}
              >
                最新指标:
              </div>
              {selectedPoint.latest_metrics.map((metric, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.25rem 0',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    {metric.metric_type}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>
                      {metric.computed_value.toFixed(2)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {' '}
                      {metric.unit}
                    </span>
                    <div>
                      <StatusBadge status={metric.threshold_status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          请选择一个监测点查看详情
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Metric Configs Card Component
// =============================================================================

const MetricConfigsCard: React.FC<CardComponentProps> = () => {
  const { configs, configsLoading, configsError } = useMetrics()

  const methodLabels: Record<string, string> = {
    difference: '差值计算',
    cumulative: '累计计算',
    average: '平均值',
    regression: '回归分析',
    rate: '变化率',
  }

  if (configsLoading) {
    return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>加载中...</div>
  }

  if (configsError) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#ff3e5f', marginBottom: '0.5rem' }}>连接错误</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          请确保后端服务已启动
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
      {configs && configs.length > 0 ? (
        configs.map((config) => (
          <div
            key={config.metric_type}
            style={{
              padding: '0.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {config.metric_name}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.25rem',
              }}
            >
              <span>方法: {methodLabels[config.calculation_method] || config.calculation_method}</span>
              <span>单位: {config.unit}</span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                display: 'flex',
                gap: '1rem',
                marginTop: '0.25rem',
              }}
            >
              <span style={{ color: '#ffab00' }}>警告: {config.warning_threshold}</span>
              <span style={{ color: '#ff3e5f' }}>严重: {config.critical_threshold}</span>
            </div>
          </div>
        ))
      ) : (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          暂无指标配置
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Process All Button Card Component
// =============================================================================

const ProcessAllCard: React.FC<CardComponentProps> = () => {
  const { calculating, calculationError, processAllPoints, refetchAlerts } = useMetrics()
  const [lastResult, setLastResult] = useState<{ processed: number } | null>(null)

  const handleProcessAll = async () => {
    try {
      const result = await processAllPoints()
      setLastResult({ processed: result.processed })
      refetchAlerts()
    } catch {
      // Error is handled by the hook
    }
  }

  if (calculationError) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#ff3e5f', marginBottom: '0.5rem' }}>处理失败</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {calculationError}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <button
        onClick={handleProcessAll}
        disabled={calculating}
        style={{
          background: 'rgba(0, 229, 255, 0.2)',
          border: '1px solid #00e5ff',
          color: '#00e5ff',
          padding: '0.75rem 1.5rem',
          cursor: calculating ? 'wait' : 'pointer',
          borderRadius: '4px',
          fontFamily: 'Rajdhani, sans-serif',
          fontWeight: 'bold',
          fontSize: '1rem',
          opacity: calculating ? 0.6 : 1,
        }}
      >
        {calculating ? '[处理中...]' : '[批量处理所有点位]'}
      </button>
      {lastResult && (
        <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          上次处理: 已处理 {lastResult.processed} 个点位
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Dashboard Configuration
// =============================================================================

const METRICS_CARDS: CardConfig[] = [
  {
    id: 'engine-status',
    title: '引擎状态',
    icon: 'fas fa-cogs',
    component: EngineStatusCard,
    defaultLayout: { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
  },
  {
    id: 'alerts-summary',
    title: '告警汇总',
    icon: 'fas fa-exclamation-triangle',
    component: AlertsSummaryCard,
    defaultLayout: { x: 3, y: 0, w: 4, h: 3, minW: 3, minH: 3 },
  },
  {
    id: 'process-all',
    title: '批量处理',
    icon: 'fas fa-play-circle',
    component: ProcessAllCard,
    defaultLayout: { x: 7, y: 0, w: 5, h: 3, minW: 3, minH: 2 },
  },
  {
    id: 'points-overview',
    title: '监测点列表',
    icon: 'fas fa-map-marker-alt',
    component: PointsOverviewCard,
    defaultLayout: { x: 0, y: 3, w: 4, h: 5, minW: 3, minH: 4 },
  },
  {
    id: 'point-details',
    title: '点位详情',
    icon: 'fas fa-info-circle',
    component: PointDetailsCard,
    defaultLayout: { x: 4, y: 3, w: 4, h: 5, minW: 3, minH: 4 },
  },
  {
    id: 'metric-configs',
    title: '指标配置',
    icon: 'fas fa-sliders-h',
    component: MetricConfigsCard,
    defaultLayout: { x: 8, y: 3, w: 4, h: 5, minW: 3, minH: 4 },
  },
]

// =============================================================================
// Main Dashboard Component
// =============================================================================

const MetricsDashboardContent: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null)

  const handleCardFullscreen = useCallback((cardId: string) => {
    setFullscreenCard(cardId)
  }, [])

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenCard(null)
  }, [])

  const fullscreenConfig = fullscreenCard
    ? METRICS_CARDS.find((c) => c.id === fullscreenCard)
    : null

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          <i className="fas fa-chart-line" style={{ marginRight: '0.5rem' }} />
          指标计算引擎仪表板
        </h1>
      </div>
      <DashboardGrid
        pageId="metrics-dashboard"
        cards={METRICS_CARDS}
        onCardFullscreen={handleCardFullscreen}
      />
      {fullscreenConfig && (
        <FullscreenModal
          isOpen={true}
          onClose={handleCloseFullscreen}
          title={fullscreenConfig.title}
        >
          <fullscreenConfig.component cardId={fullscreenConfig.id} />
        </FullscreenModal>
      )}
    </div>
  )
}

// =============================================================================
// Exported Page Component
// =============================================================================

const MetricsDashboard: React.FC = () => {
  return (
    <LayoutProvider>
      <MetricsProvider>
        <MetricsDashboardContent />
      </MetricsProvider>
    </LayoutProvider>
  )
}

export default MetricsDashboard
