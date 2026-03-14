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

// 记录哪些接口连续失败次数（按路径），达到阈值才降级
const failureCount = new Map<string, number>();
// 降级后的冷却时间戳
const cooldownUntil = new Map<string, number>();

// 连续失败几次才降级到 mock（容忍冷启动）
const FALLBACK_THRESHOLD = 2;
// 降级后冷却时间（毫秒）：30秒后自动重试真实 API
const COOLDOWN_MS = 30 * 1000;
// 重试间隔（毫秒）：首次失败后等1.5秒重试，给冷启动时间
const RETRY_DELAY_MS = 1500;

// 兼容旧接口：检测是否有任何接口降级
export function isMockMode(): boolean {
  return cooldownUntil.size > 0;
}

// 退出演示模式：清除所有失败标记，下次请求会重试真实 API
export function setMockMode(enabled: boolean) {
  if (!enabled) {
    failureCount.clear();
    cooldownUntil.clear();
  }
}

// 获取失败端点数量（供 UI 显示）
export function getFailedEndpointCount(): number {
  return cooldownUntil.size;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * 增强的 fetch 函数 - 按接口独立降级
 * 单个 500 不会立即降级（可能是冷启动），会自动重试一次
 * 连续失败 FALLBACK_THRESHOLD 次才降级到 mock
 * 降级后 COOLDOWN_MS 后自动重试真实 API
 */
async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  mockGenerator?: () => T
): Promise<T> {
  const shortPath = url.replace(API_BASE, '');

  // 在冷却期内直接走 mock
  const cd = cooldownUntil.get(shortPath);
  if (cd && mockGenerator) {
    if (Date.now() < cd) {
      return mockGenerator();
    }
    // 冷却结束，清除标记重试
    cooldownUntil.delete(shortPath);
    failureCount.delete(shortPath);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const count = (failureCount.get(shortPath) || 0) + 1;
      failureCount.set(shortPath, count);

      // 未达阈值：等一下重试（给冷启动时间）
      if (count < FALLBACK_THRESHOLD && mockGenerator) {
        console.log(`[ML] ${shortPath} -> ${response.status}, retrying in ${RETRY_DELAY_MS}ms (${count}/${FALLBACK_THRESHOLD})`);
        await delay(RETRY_DELAY_MS);
        // 递归重试，不带 await 以复用同一逻辑
        return fetchWithFallback(url, options, mockGenerator);
      }

      // 达到阈值：降级到 mock，启动冷却
      if (mockGenerator) {
        cooldownUntil.set(shortPath, Date.now() + COOLDOWN_MS);
        console.log(`[ML Mock] ${shortPath} -> ${response.status}, using mock data (${COOLDOWN_MS / 1000}s cooldown)`);
        return mockGenerator();
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 成功：清除失败计数
    failureCount.delete(shortPath);
    cooldownUntil.delete(shortPath);
    return await response.json();
  } catch (error) {
    const count = (failureCount.get(shortPath) || 0) + 1;
    failureCount.set(shortPath, count);

    if (count < FALLBACK_THRESHOLD && mockGenerator) {
      console.log(`[ML] ${shortPath} -> network error, retrying (${count}/${FALLBACK_THRESHOLD})`);
      await delay(RETRY_DELAY_MS);
      return fetchWithFallback(url, options, mockGenerator);
    }

    if (mockGenerator) {
      cooldownUntil.set(shortPath, Date.now() + COOLDOWN_MS);
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[ML Mock] ${shortPath} -> ${msg}, using mock data (${COOLDOWN_MS / 1000}s cooldown)`);
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
