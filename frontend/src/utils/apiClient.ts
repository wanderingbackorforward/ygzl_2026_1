// API 客户端 - 支持按接口独立降级到 Mock 数据
import { API_BASE } from '../lib/api';
import {
  generateMockAnomalies,
  generateMockRecommendations,
  generateMockPrediction,
  generateMockModelComparison,
  generateMockSpatialCorrelation,
  generateMockCausalAnalysis,
  generateMockInformerPrediction,
  generateMockSTGCNPrediction,
  generateMockCausalDiscover,
  generateMockKGStats,
  generateMockKGNeighbors,
  generateMockKGRiskPoints,
  generateMockKGQA,
  generateMockMultiFactorCorrelation,
} from './mockData';

// 记录哪些接口不可用（按路径），不再是全局开关
const failedEndpoints = new Set<string>();

// 兼容旧接口：检测是否有任何接口降级
export function isMockMode(): boolean {
  return failedEndpoints.size > 0;
}

// 兼容旧接口
export function setMockMode(enabled: boolean) {
  if (!enabled) {
    failedEndpoints.clear();
  }
}

/**
 * 增强的 fetch 函数 - 按接口独立降级
 * 单个接口失败只影响该接口，不影响其他接口
 * 降级时只记录简短日志，不打印完整 Error 堆栈以减少控制台噪音
 */
async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  mockGenerator?: () => T
): Promise<T> {
  // 提取短路径用于日志（去掉 API_BASE 前缀）
  const shortPath = url.replace(API_BASE, '');

  // 已知不可用的接口直接走 mock，不再重复请求
  if (failedEndpoints.has(shortPath) && mockGenerator) {
    return mockGenerator();
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (mockGenerator) {
        failedEndpoints.add(shortPath);
        // 首次降级时只打一行简短日志，不带 Error 对象
        console.log(`[ML Mock] ${shortPath} -> ${response.status}, using mock data`);
        return mockGenerator();
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 如果之前失败过但现在恢复了，移除标记
    failedEndpoints.delete(shortPath);
    return await response.json();
  } catch (error) {
    if (mockGenerator) {
      failedEndpoints.add(shortPath);
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[ML Mock] ${shortPath} -> ${msg}, using mock data`);
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
    `${API_BASE}/ml/compare-models/${pointId}`,
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

/**
 * Informer 长序列预测
 */
export async function fetchInformerPrediction(
  pointId: string,
  steps: number = 30,
  seqLen: number = 96
) {
  return fetchWithFallback(
    `${API_BASE}/ml/predict/informer/${pointId}?steps=${steps}&seq_len=${seqLen}`,
    undefined,
    () => generateMockInformerPrediction(pointId, steps, seqLen)
  );
}

/**
 * STGCN 多点联合预测
 */
export async function fetchSTGCNPrediction(steps: number = 30) {
  return fetchWithFallback(
    `${API_BASE}/ml/predict/stgcn?steps=${steps}`,
    undefined,
    () => generateMockSTGCNPrediction(steps)
  );
}

/**
 * 因果发现 (Granger)
 */
export async function fetchCausalDiscover(
  pointIds: string[],
  maxLag: number = 5,
  method: string = 'granger'
) {
  return fetchWithFallback(
    `${API_BASE}/ml/causal/discover`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point_ids: pointIds, max_lag: maxLag, method }),
    },
    () => generateMockCausalDiscover(pointIds, maxLag)
  );
}

/**
 * 知识图谱统计
 */
export async function fetchKGStats() {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/stats`,
    undefined,
    () => generateMockKGStats()
  );
}

/**
 * 知识图谱邻居查询
 */
export async function fetchKGNeighbors(pointId: string) {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/query/neighbors/${pointId}`,
    undefined,
    () => generateMockKGNeighbors(pointId)
  );
}

/**
 * 知识图谱高风险点
 */
export async function fetchKGRiskPoints(minSeverity: string = 'high') {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/query/risk-points?min_severity=${minSeverity}`,
    undefined,
    () => generateMockKGRiskPoints(minSeverity)
  );
}

/**
 * 知识图谱问答 (KGQA)
 */
export async function fetchKGQA(question: string) {
  return fetchWithFallback(
    `${API_BASE}/ml/kgqa/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    },
    () => generateMockKGQA(question)
  );
}

/**
 * 知识图谱文献列表
 */
export async function fetchKGDocuments(limit = 50, offset = 0) {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/documents?limit=${limit}&offset=${offset}`,
    undefined,
    () => ({ success: true, documents: [], total: 0 })
  );
}

/**
 * 添加文献到知识图谱
 */
export async function addKGDocument(title: string, content: string, sourceType = 'text', sourceUrl = '') {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/documents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, source_type: sourceType, source_url: sourceUrl }),
    },
    () => ({ success: false, message: 'API unavailable' })
  );
}

/**
 * 删除知识图谱文献
 */
export async function deleteKGDocument(docId: string) {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/documents/${docId}`,
    { method: 'DELETE' },
    () => ({ success: false, message: 'API unavailable' })
  );
}

/**
 * 重新处理文献（提取实体和关系）
 */
export async function processKGDocument(docId: string) {
  return fetchWithFallback(
    `${API_BASE}/ml/kg/documents/${docId}/process`,
    { method: 'POST' },
    () => ({ success: false, message: 'API unavailable' })
  );
}

/**
 * 多因素关联分析（温度-沉降-裂缝）
 */
export async function fetchMultiFactorCorrelation() {
  return fetchWithFallback(
    `${API_BASE}/ml/correlation/multi-factor`,
    undefined,
    () => generateMockMultiFactorCorrelation()
  );
}
