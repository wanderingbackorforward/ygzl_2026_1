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
  historical?: Array<{ date: string; value: number }>;
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

/**
 * SHAP 特征重要性
 */
export interface SHAPFeature {
  feature: string;
  importance: number;
  rank: number;
}

export interface SHAPSummary {
  feature: string;
  mean_shap: number;
  mean_abs_shap: number;
  std_shap: number;
  min_shap: number;
  max_shap: number;
  median_shap: number;
}

export interface SHAPResult {
  success: boolean;
  point_id: string;
  feature_importance: SHAPFeature[];
  summary: SHAPSummary[];
}

/**
 * 因果发现结果 (Granger)
 */
export interface CausalRelation {
  cause: string;
  effect: string;
  p_value: number;
  f_statistic: number;
  optimal_lag: number;
  significant: boolean;
}

export interface CausalDiscoverResult {
  success: boolean;
  method: string;
  max_lag: number;
  relations: CausalRelation[];
  summary: {
    total_tested: number;
    significant_count: number;
  };
}

/**
 * 知识图谱统计
 */
export interface KGStats {
  success: boolean;
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
  edge_types: Record<string, number>;
}

/**
 * 知识图谱邻居查询结果
 */
export interface KGNode {
  id: string;
  label: string;
  type: string;
  color: string;
  size: number;
  x: number;
  y: number;
  severity?: string;
  attrs?: Record<string, any>;
}

export interface KGEdge {
  source: string;
  target: string;
  type: string;
  color: string;
  label: string;
  attrs?: Record<string, any>;
}

export interface KGNeighborsResult {
  success: boolean;
  center: string;
  nodes: KGNode[];
  edges: KGEdge[];
}

/**
 * 知识图谱风险点
 */
export interface KGRiskPoint {
  point_id: string;
  severity: string;
  anomaly_count: number;
  latest_anomaly_date: string;
  description: string;
}

export interface KGRiskPointsResult {
  success: boolean;
  risk_points: KGRiskPoint[];
  total: number;
}

/**
 * 知识图谱问答
 */
export interface KGQAResult {
  success: boolean;
  question: string;
  answer: string;
  sources?: string[];
  confidence?: number;
}
