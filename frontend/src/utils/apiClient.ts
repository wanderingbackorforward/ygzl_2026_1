// API 客户端 - 支持自动降级到 Mock 数据
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
    '/api/ml/anomalies/batch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point_ids: pointIds }),
    },
    () => ({
      success: true,
      anomalies: generateMockAnomalies(pointIds),
    })
  );
}

/**
 * 获取处置建议
 */
export async function fetchRecommendations(pointIds: string[]) {
  return fetchWithFallback(
    '/api/analysis/v2/settlement/recommendations',
    undefined,
    () => {
      const anomalies = generateMockAnomalies(pointIds);
      return {
        success: true,
        recommendations: generateMockRecommendations(anomalies),
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
    `/api/ml/auto-predict/${pointId}?forecast_days=${forecastDays}`,
    undefined,
    () => generateMockPrediction(pointId, forecastDays)
  );
}

/**
 * 模型对比
 */
export async function fetchModelComparison(pointId: string) {
  return fetchWithFallback(
    `/api/ml/model-comparison/${pointId}`,
    undefined,
    () => generateMockModelComparison(pointId)
  );
}

/**
 * 空间关联分析
 */
export async function fetchSpatialCorrelation(distanceThreshold: number = 50) {
  return fetchWithFallback(
    `/api/ml/spatial/correlation?distance_threshold=${distanceThreshold}`,
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
    '/api/ml/causal/event-impact',
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
