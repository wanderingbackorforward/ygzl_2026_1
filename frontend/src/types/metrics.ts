// -*- coding: utf-8 -*-
// Metrics Engine API Types
// Matches backend/modules/metrics_engine/ API responses

// =============================================================================
// Monitoring Points
// =============================================================================

export type PointType = 'settlement' | 'crack' | 'temperature' | 'vibration';
export type PointStatus = 'active' | 'inactive' | 'maintenance' | 'error';
export type ThresholdStatus = 'normal' | 'warning' | 'critical';

export interface ThresholdConfig {
  warning: number;
  critical: number;
  direction?: 'above' | 'below';
}

export interface MonitoringPoint {
  id: number;
  point_id: string;
  point_name: string;
  point_type: PointType;
  description?: string;
  location_x?: number;
  location_y?: number;
  location_z?: number;
  installation_date?: string;
  status: PointStatus;
  threshold_config: ThresholdConfig;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MonitoringPointWithMetrics extends MonitoringPoint {
  latest_metrics?: EngineeringMetric[];
  alert_status?: ThresholdStatus;
}

// =============================================================================
// Raw Data
// =============================================================================

export type QualityFlag = 'valid' | 'invalid' | 'suspect' | 'missing';

export interface RawDataPoint {
  id: number;
  point_id: string;
  measured_at: string;
  raw_value: number;
  unit?: string;
  quality_flag: QualityFlag;
  sensor_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RawDataStats {
  point_id: string;
  count: number;
  min_value: number;
  max_value: number;
  avg_value: number;
  first_measurement: string;
  last_measurement: string;
}

// =============================================================================
// Metric Configurations
// =============================================================================

export type CalculationMethod =
  | 'difference'
  | 'cumulative'
  | 'average'
  | 'regression'
  | 'rate'
  | 'custom';

export type UpdateFrequency = 'realtime' | 'hourly' | 'daily' | 'on_data';

export interface MetricConfig {
  id: number;
  metric_type: string;
  metric_name: string;
  metric_description?: string;
  calculation_method: CalculationMethod;
  formula?: string;
  unit: string;
  warning_threshold: number;
  critical_threshold: number;
  threshold_direction: 'above' | 'below';
  applicable_point_types: PointType[];
  time_window_hours?: number;
  min_data_points: number;
  update_frequency: UpdateFrequency;
  is_active: boolean;
  calculation_params: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Engineering Metrics
// =============================================================================

export interface EngineeringMetric {
  id: number;
  point_id: string;
  metric_type: string;
  computed_value: number;
  unit: string;
  threshold_status: ThresholdStatus;
  data_range_start: string;
  data_range_end: string;
  data_point_count: number;
  quality_score: number;
  calculation_params: Record<string, unknown>;
  baseline_value?: number;
  previous_value?: number;
  change_from_previous?: number;
  change_percentage?: number;
  computed_at: string;
  created_at: string;
}

export interface CalculationResult {
  point_id: string;
  metric_type: string;
  value: number;
  unit: string;
  threshold_status: ThresholdStatus;
  calculation_method: CalculationMethod;
  data_range_start: string;
  data_range_end: string;
  data_point_count: number;
  quality_score: number;
  error?: string;
}

// =============================================================================
// Alert Rules
// =============================================================================

export type ConditionType = 'threshold_exceeded' | 'rate_exceeded' | 'trend_detected';
export type ActionType = 'create_ticket' | 'send_notification' | 'both';

export interface AlertRule {
  id: number;
  rule_name: string;
  rule_description?: string;
  trigger_metric_type: string;
  trigger_point_types: PointType[];
  condition_type: ConditionType;
  condition_params: {
    comparison: 'greater_than' | 'less_than' | 'equals';
    threshold: number;
  };
  action_type: ActionType;
  ticket_type?: string;
  ticket_priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ticket_template: Record<string, unknown>;
  notification_recipients: string[];
  notification_template?: string;
  cooldown_minutes: number;
  is_active: boolean;
  trigger_count: number;
  last_triggered_at?: string;
  default_assignee_id?: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =============================================================================
// Metric Snapshots
// =============================================================================

export type SnapshotType = 'manual' | 'auto' | 'ticket' | 'alert';

export interface MetricSnapshot {
  id: number;
  snapshot_type: SnapshotType;
  snapshot_data: {
    points: MonitoringPoint[];
    metrics: EngineeringMetric[];
    configs: MetricConfig[];
  };
  point_ids?: string[];
  metric_types?: string[];
  ticket_id?: number;
  notes?: string;
  created_by?: number;
  created_at: string;
}

// =============================================================================
// Engine Status
// =============================================================================

export interface EngineStatus {
  background_processing: boolean;
  processing_interval: number;
  config_cache_size: number;
  config_cache_age?: number;
}

// =============================================================================
// Alert Summary
// =============================================================================

export interface AlertSummary {
  point_id: string;
  point_name: string;
  point_type: PointType;
  metric_type: string;
  metric_name: string;
  computed_value: number;
  unit: string;
  threshold_status: ThresholdStatus;
  warning_threshold: number;
  critical_threshold: number;
  computed_at: string;
}

// =============================================================================
// API Response Wrappers
// =============================================================================

export interface MetricsApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
}

export interface MetricsListResponse<T> {
  success: boolean;
  data: T[];
  count: number;
  error?: string;
}

// Dashboard display types
export interface MetricCardData {
  pointId: string;
  pointName: string;
  pointType: PointType;
  metrics: {
    type: string;
    name: string;
    value: number;
    unit: string;
    status: ThresholdStatus;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
  }[];
  lastUpdated: string;
}

export interface AlertCardData {
  id: number;
  pointId: string;
  pointName: string;
  metricType: string;
  metricName: string;
  value: number;
  unit: string;
  status: ThresholdStatus;
  threshold: number;
  timestamp: string;
}
