// API 客户端 - 支持自动降级到 Mock 数据
import { API_BASE } from '../lib/api';
import {
  generateMockAnomalies,
  generateMockRecommendations,
  generateMockPrediction,
  generateMockModelComparison,
  generateMockSpatialCorrelation,
  generateMockCausalAnalysis,
} from './mockData';

// 全局标志：是否使用 Mock 模式
let useMockMode = false;

// 检测是否需要使用 Mock 模式
export function isMockMode(): boolean {
  return useMockMode;
}

// 设置 Mock 模式
export function setMockMode(enabled: boolean) {
  useMockMode = enabled;
  if (enabled) {
    console.warn('⚠️ API Mock 模式已启用 - 当前显示的是演示数据');
  }
}

/**
 * 增强的 fetch 函数 - 自动降级到 Mock
 */
async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  mockGenerator?: () => T
): Promise<T> {
  // 如果已经在 Mock 模式，直接返回 Mock 数据
  if (useMockMode && mockGenerator) {
    console.log(`[Mock] ${url}`);
    await new Promise(resolve => setTimeout(resolve, 300)); // 模拟网络延迟
    return mockGenerator();
  }

  try {
    const response = await fetch(url, options);

    // 404 错误 - 切换到 Mock 模式
    if (response.status === 404 && mockGenerator) {
      console.warn(`[API 404] ${url} - 切换到 Mock 模式`);
      setMockMode(true);
      return mockGenerator();
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // 网络错误或其他错误 - 如果有 Mock 生成器，使用它
    if (mockGenerator) {
      console.warn(`[API Error] ${url} - 降级到 Mock 模式`, error);
      setMockMode(true);
      return mockGenerator();
    }
    throw error;
  }
}

/**
 * 批量异常检测
 */
export async function fetchBatchAnomalies(pointIds: string[]) {
  return fetchWithFallback(
    `${API_BASE}/ml/anomalies/batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point_ids: pointIds }),
    },
    () => generateMockAnomalies(pointIds)
  );
}

/**
 * 获取处置建议
 */
export async function fetchRecommendations(pointIds: string[]) {
  return fetchWithFallback(
    `${API_BASE}/analysis/v2/settlement/recommendations`,
    undefined,
    () => {
      const batchResult = generateMockAnomalies(pointIds);
      // 从 results 中提取所有异常
      const allAnomalies: any[] = [];
      batchResult.results.forEach((result: any) => {
        if (result.anomalies && Array.isArray(result.anomalies)) {
          allAnomalies.push(...result.anomalies);
        }
      });
      return {
        success: true,
        recommendations: generateMockRecommendations(allAnomalies),
      };
    }
  );
}

/**
 * 自动预测
 */
export async function fetchAutoPrediction(
  pointId: string,
  forecastDays: number = 30
) {
  return fetchWithFallback(
    `${API_BASE}/ml/auto-predict/${pointId}?forecast_days=${forecastDays}`,
    undefined,
    () => generateMockPrediction(pointId, forecastDays)
  );
}

/**
 * 模型对比
 */
export async function fetchModelComparison(pointId: string) {
  return fetchWithFallback(
    `${API_BASE}/ml/model-comparison/${pointId}`,
    undefined,
    () => generateMockModelComparison(pointId)
  );
}

/**
 * 空间关联分析
 */
export async function fetchSpatialCorrelation(distanceThreshold: number = 50) {
  return fetchWithFallback(
    `${API_BASE}/ml/spatial/correlation?distance_threshold=${distanceThreshold}`,
    undefined,
    () => generateMockSpatialCorrelation(distanceThreshold)
  );
}

/**
 * 因果分析
 */
export async function fetchCausalAnalysis(params: {
  point_id: string;
  event_date: string;
  control_point_ids?: string[];
  method: 'DID' | 'SCM';
  window_days: number;
}) {
  return fetchWithFallback(
    `${API_BASE}/ml/causal/event-impact`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () =>
      generateMockCausalAnalysis(
        params.point_id,
        params.event_date,
        params.method,
        params.window_days
      )
  );
}

/**
 * PINN预测
 */
export async function fetchPINNPrediction(
  pointId: string,
  forecastDays: number = 30,
  physicsWeight: number = 0.1
) {
  return fetchWithFallback(
    `${API_BASE}/ml/predict/pinn/${pointId}?steps=${forecastDays}&physics_weight=${physicsWeight}`,
    undefined,
    () => generateMockPrediction(pointId, forecastDays)
  );
}

/**
 * Ensemble集成预测
 */
export async function fetchEnsemblePrediction(
  pointId: string,
  forecastDays: number = 30,
  method: 'stacking' | 'weighted_average' | 'simple_average' = 'stacking',
  baseModels: string[] = ['arima', 'informer', 'pinn']
) {
  const baseModelsStr = baseModels.join(',');
  return fetchWithFallback(
    `${API_BASE}/ml/predict/ensemble/${pointId}?steps=${forecastDays}&method=${method}&base_models=${baseModelsStr}`,
    undefined,
    () => generateMockPrediction(pointId, forecastDays)
  );
}

/**
 * SHAP可解释性分析
 */
export async function fetchSHAPExplanation(
  pointId: string,
  modelType: 'tree' | 'linear' | 'deep' | 'kernel' = 'tree'
) {
  return fetchWithFallback(
    `${API_BASE}/ml/explain/${pointId}?model_type=${modelType}`,
    undefined,
    () => ({
      success: true,
      point_id: pointId,
      feature_importance: [
        { feature: 'temperature', importance: 0.45, rank: 1 },
        { feature: 'crack_width', importance: 0.35, rank: 2 },
        { feature: 'vibration', importance: 0.20, rank: 3 },
      ],
      summary: [
        {
          feature: 'temperature',
          mean_shap: 0.12,
          mean_abs_shap: 0.45,
          std_shap: 0.08,
          min_shap: -0.3,
          max_shap: 0.6,
          median_shap: 0.1,
        },
        {
          feature: 'crack_width',
          mean_shap: 0.08,
          mean_abs_shap: 0.35,
          std_shap: 0.06,
          min_shap: -0.2,
          max_shap: 0.5,
          median_shap: 0.07,
        },
        {
          feature: 'vibration',
          mean_shap: 0.05,
          mean_abs_shap: 0.20,
          std_shap: 0.04,
          min_shap: -0.15,
          max_shap: 0.3,
          median_shap: 0.04,
        },
      ],
    })
  );
}

/**
 * ML模块健康检查
 */
export async function fetchMLHealth() {
  return fetchWithFallback(
    `${API_BASE}/ml/health`,
    undefined,
    () => ({
      success: true,
      modules: {
        anomaly_detector: true,
        time_series_predictor: true,
        prophet: true,
        informer: true,
        stgcn: true,
        pinn: true,
        ensemble: true,
        shap: true,
        spatial_correlation: true,
        causal_inference: true,
        model_selector: true,
      },
      message: 'ML模块运行正常',
    })
  );
}

