// 高级分析模块类型定义

/**
 * 异常数据
 */
export interface Anomaly {
  point_id: string;
  point_name?: string;
  date: string;
  settlement: number;
  anomaly_score: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  anomaly_type: 'spike' | 'acceleration' | 'fluctuation' | 'trend' | 'unknown';
}

/**
 * 异常检测结果
 */
export interface AnomalyDetectionResult {
  success: boolean;
  point_id: string;
  method: string;
  total_points: number;
  anomaly_count: number;
  anomaly_rate: number;
  anomalies: Anomaly[];
}

/**
 * 批量异常检测结果
 */
export interface BatchAnomalyResult {
  success: boolean;
  results: AnomalyDetectionResult[];
  summary: {
    total_points: number;
    total_anomalies: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
  };
}

/**
 * 处置建议
 */
export interface Recommendation {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: 'inspect' | 'monitor' | 'repair' | 'report';
  title: string;
  reason: string;
  related_anomalies: string[];
  estimated_time?: string;
  point_ids: string[];
}

/**
 * 预测结果
 */
export interface PredictionResult {
  success: boolean;
  point_id: string;
  selected_model: string;
  model_selection_info: {
    best_score: number;
    metric: string;
    data_characteristics: {
      data_size: number;
      trend_strength: number;
      volatility: number;
      seasonality_strength: number;
    };
  };
  forecast: {
    dates: string[];
    values: number[];
    lower_bound: number[];
    upper_bound: number[];
  };
}

/**
 * 空间关联结果
 */
export interface SpatialCorrelationResult {
  success: boolean;
  points: Array<{
    point_id: string;
    x_coord: number;
    y_coord: number;
  }>;
  adjacency_matrix: number[][];
  correlation_matrix: number[][];
  clusters: number[][];
  cluster_count: number;
}

/**
 * 施工事件影响分析结果
 */
export interface EventImpactResult {
  method: string;
  treatment_effect: number;
  treated_change: number;
  control_change: number;
  confidence_interval?: [number, number];
  interpretation: string;
  point_id: string;
  event_date: string;
}

/**
 * 异常统计
 */
export interface AnomalyStatistics {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  by_type: Record<string, number>;
  by_point: Record<string, number>;
}

/**
 * 筛选条件
 */
export interface AnomalyFilter {
  severity?: ('critical' | 'high' | 'medium' | 'low')[];
  anomaly_type?: string[];
  point_ids?: string[];
  date_range?: [string, string];
}

/**
 * 排序选项
 */
export type AnomalySortBy = 'date' | 'severity' | 'score' | 'point_id';
export type SortOrder = 'asc' | 'desc';
