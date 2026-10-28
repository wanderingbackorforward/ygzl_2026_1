// ML API 封装（仅保留前端实际调用的接口）
import { apiPost } from './api';

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
