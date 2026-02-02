// ML API 封装
import { apiGet, apiPost } from './api';

// ============ 类型定义 ============

export interface MLPredictionResult {
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
    all_results: Record<string, {
      mae: number;
      rmse: number;
      mape?: number;
      status: string;
    }>;
  };
  forecast: {
    dates: string[];
    values: number[];
    lower_bound: number[];
    upper_bound: number[];
  };
}

export interface MLAnomalyResult {
  success: boolean;
  point_id: string;
  method: string;
  total_points: number;
  anomaly_count: number;
  anomaly_rate: number;
  anomalies: Array<{
    date: string;
    settlement: number;
    anomaly_score: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    anomaly_type: string;
  }>;
}

export interface MLSpatialResult {
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

export interface MLModelComparisonResult {
  success: boolean;
  point_id: string;
  data_characteristics: {
    data_size: number;
    trend_strength: number;
    volatility: number;
    seasonality_strength: number;
    stationarity: number;
    outlier_ratio: number;
  };
  model_evaluation: Record<string, {
    mae: number;
    rmse: number;
    mape?: number;
    status: string;
    error?: string;
  }>;
}

// ============ API 函数 ============

/**
 * 自动选择最优模型并预测
 */
export async function mlAutoPredict(
  pointId: string,
  steps: number = 30,
  metric: 'mae' | 'rmse' | 'mape' = 'mae'
): Promise<MLPredictionResult> {
  return apiGet<MLPredictionResult>(
    `/ml/auto-predict/${pointId}?steps=${steps}&metric=${metric}`
  );
}

/**
 * 使用指定模型预测
 */
export async function mlPredict(
  pointId: string,
  model: 'arima' | 'sarima' | 'prophet' = 'arima',
  steps: number = 30
): Promise<MLPredictionResult> {
  return apiGet<MLPredictionResult>(
    `/ml/predict/${pointId}?model=${model}&steps=${steps}`
  );
}

/**
 * 检测单个监测点的异常
 */
export async function mlDetectAnomalies(
  pointId: string,
  method: 'isolation_forest' | 'lof' = 'isolation_forest',
  contamination: number = 0.05
): Promise<MLAnomalyResult> {
  return apiGet<MLAnomalyResult>(
    `/ml/anomalies/${pointId}?method=${method}&contamination=${contamination}`
  );
}

/**
 * 批量检测多个监测点的异常
 */
export async function mlBatchDetectAnomalies(
  pointIds: string[],
  method: 'isolation_forest' | 'lof' = 'isolation_forest',
  contamination: number = 0.05
): Promise<{
  success: boolean;
  results: MLAnomalyResult[];
  summary: {
    total_points: number;
    total_anomalies: number;
  };
}> {
  return apiPost('/ml/anomalies/batch', {
    point_ids: pointIds,
    method,
    contamination
  });
}

/**
 * 空间关联分析
 */
export async function mlSpatialCorrelation(
  distanceThreshold: number = 50
): Promise<MLSpatialResult> {
  return apiGet<MLSpatialResult>(
    `/ml/spatial/correlation?distance_threshold=${distanceThreshold}`
  );
}

/**
 * 影响传播路径分析
 */
export async function mlInfluencePropagation(
  sourcePointIdx: number,
  distanceThreshold: number = 50
): Promise<{
  success: boolean;
  source_point_idx: number;
  propagation_path: Array<{
    point_index: number;
    influence_score: number;
    correlation: number;
    distance: number;
  }>;
}> {
  return apiGet(
    `/ml/spatial/influence/${sourcePointIdx}?distance_threshold=${distanceThreshold}`
  );
}

/**
 * 施工事件影响分析（因果推断）
 */
export async function mlEventImpact(params: {
  point_id: string;
  event_date: string;
  control_point_ids?: string[];
  method?: 'DID' | 'SCM';
  window_days?: number;
}): Promise<{
  method: string;
  treatment_effect: number;
  treated_change: number;
  control_change: number;
  confidence_interval?: [number, number];
  interpretation: string;
  point_id: string;
  event_date: string;
}> {
  return apiPost('/ml/causal/event-impact', params);
}

/**
 * 对比所有模型性能
 */
export async function mlCompareModels(
  pointId: string
): Promise<MLModelComparisonResult> {
  return apiGet<MLModelComparisonResult>(`/ml/compare-models/${pointId}`);
}

/**
 * ML模块健康检查
 */
export async function mlHealthCheck(): Promise<{
  success: boolean;
  modules: Record<string, boolean>;
  message: string;
}> {
  return apiGet('/ml/health');
}
