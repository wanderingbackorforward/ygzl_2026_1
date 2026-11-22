// API 客户端：接口失败就如实报错，不再返回模拟数据
import { API_BASE } from '../lib/api';

// 记录最近失败过的接口，供页面提示"部分数据暂不可用"
const failedEndpoints = new Set<string>();

export function getFailedEndpointCount(): number {
  return failedEndpoints.size;
}

const REQUEST_TIMEOUT_MS = 20000;

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const shortPath = url.replace(API_BASE, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      failedEndpoints.add(shortPath);
      let detail = '';
      try {
        const body = await response.json();
        if (body && typeof body.message === 'string') detail = `：${body.message}`;
      } catch {
        // 响应不是 JSON 时忽略
      }
      throw new Error(`接口暂不可用（HTTP ${response.status}）${detail}`);
    }
    failedEndpoints.delete(shortPath);
    return await response.json();
  } catch (err) {
    failedEndpoints.add(shortPath);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 批量异常检测
 */
export async function fetchBatchAnomalies(pointIds: string[]) {
  return fetchJson(
    `${API_BASE}/ml/anomalies/batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point_ids: pointIds }),
    }
  );
}

/**
 * 获取处置建议
 */
export async function fetchRecommendations(pointIds: string[]) {
  const query = pointIds.length ? `?point_ids=${pointIds.join(',')}` : '';
  return fetchJson(`${API_BASE}/analysis/v2/settlement/recommendations${query}`);
}

/**
 * 自动预测
 */
export async function fetchAutoPrediction(
  pointId: string,
  forecastDays: number = 30
) {
  return fetchJson(
    `${API_BASE}/ml/auto-predict/${pointId}?forecast_days=${forecastDays}`
  );
}

/**
 * 模型对比
 */
export async function fetchModelComparison(pointId: string) {
  return fetchJson(`${API_BASE}/ml/compare-models/${pointId}`);
}

/**
 * 空间关联分析
 */
export async function fetchSpatialCorrelation(distanceThreshold: number = 50) {
  return fetchJson(
    `${API_BASE}/ml/spatial/correlation?distance_threshold=${distanceThreshold}`
  );
}

/**
 * 因果分析（施工影响）
 */
export async function fetchCausalAnalysis(params: {
  point_id: string;
  event_date: string;
  control_point_ids?: string[];
  method: 'DID' | 'SCM';
  window_days: number;
}) {
  return fetchJson(`${API_BASE}/ml/causal/event-impact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

/**
 * PINN预测
 */
export async function fetchPINNPrediction(
  pointId: string,
  forecastDays: number = 30,
  physicsWeight: number = 0.1
) {
  return fetchJson(
    `${API_BASE}/ml/predict/pinn/${pointId}?steps=${forecastDays}&physics_weight=${physicsWeight}`
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
  return fetchJson(
    `${API_BASE}/ml/predict/ensemble/${pointId}?steps=${forecastDays}&method=${method}&base_models=${baseModelsStr}`
  );
}

/**
 * SHAP可解释性分析
 */
export async function fetchSHAPExplanation(
  pointId: string,
  modelType: 'tree' | 'linear' | 'deep' | 'kernel' = 'tree'
) {
  return fetchJson(
    `${API_BASE}/ml/explain/${pointId}?model_type=${modelType}`
  );
}

/**
 * ML模块健康检查
 */
export async function fetchMLHealth() {
  return fetchJson(`${API_BASE}/ml/health`);
}

/**
 * Informer 长序列预测
 */
export async function fetchInformerPrediction(
  pointId: string,
  steps: number = 30,
  seqLen: number = 96
) {
  return fetchJson(
    `${API_BASE}/ml/predict/informer/${pointId}?steps=${steps}&seq_len=${seqLen}`
  );
}

/**
 * STGCN 多点联合预测
 */
export async function fetchSTGCNPrediction(steps: number = 30) {
  return fetchJson(`${API_BASE}/ml/predict/stgcn?steps=${steps}`);
}

/**
 * 因果发现 (Granger)
 */
export async function fetchCausalDiscover(
  pointIds: string[],
  maxLag: number = 5,
  method: string = 'granger'
) {
  return fetchJson(`${API_BASE}/ml/causal/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ point_ids: pointIds, max_lag: maxLag, method }),
  });
}

/**
 * 知识图谱统计
 */
export async function fetchKGStats() {
  return fetchJson(`${API_BASE}/ml/kg/stats`);
}

/**
 * 知识图谱邻居查询
 */
export async function fetchKGNeighbors(pointId: string) {
  return fetchJson(`${API_BASE}/ml/kg/query/neighbors/${pointId}`);
}

/**
 * 知识图谱高风险点
 */
export async function fetchKGRiskPoints(minSeverity: string = 'high') {
  return fetchJson(
    `${API_BASE}/ml/kg/query/risk-points?min_severity=${minSeverity}`
  );
}

/**
 * 知识图谱问答 (KGQA)
 */
export async function fetchKGQA(question: string) {
  return fetchJson(`${API_BASE}/ml/kgqa/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

/**
 * 知识图谱文献列表
 */
export async function fetchKGDocuments(limit = 50, offset = 0) {
  return fetchJson(
    `${API_BASE}/ml/kg/documents?limit=${limit}&offset=${offset}`
  );
}

/**
 * 添加文献到知识图谱
 */
export async function addKGDocument(title: string, content: string, sourceType = 'text', sourceUrl = '') {
  return fetchJson(`${API_BASE}/ml/kg/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, source_type: sourceType, source_url: sourceUrl }),
  });
}

/**
 * 删除知识图谱文献
 */
export async function deleteKGDocument(docId: string) {
  return fetchJson(`${API_BASE}/ml/kg/documents/${docId}`, { method: 'DELETE' });
}

/**
 * 重新处理文献（提取实体和关系）
 */
export async function processKGDocument(docId: string) {
  return fetchJson(`${API_BASE}/ml/kg/documents/${docId}/process`, { method: 'POST' });
}

/**
 * 多因素关联分析（温度-沉降-裂缝）
 */
export async function fetchMultiFactorCorrelation() {
  return fetchJson(`${API_BASE}/ml/correlation/multi-factor`);
}
