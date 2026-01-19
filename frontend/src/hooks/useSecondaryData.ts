/**
 * 二级数据分析 Hook
 * 提供获取异常、建议等二级分析数据的能力
 * 支持浏览器缓存 (localStorage)
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type {
  AnalysisResult,
  AnomalyItem,
  Recommendation,
  AnalysisStats,
  DataType,
  SeverityLevel,
} from '../types/analysis-v2';

// 缓存配置
const CACHE_PREFIX = 'analysis_v2_';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟缓存过期

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// 缓存工具函数
function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();

    // 检查是否过期
    if (now - entry.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function saveToCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // 忽略存储失败（如配额超限）
  }
}

function clearCache(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem(CACHE_PREFIX + key);
    } else {
      // 清除所有分析缓存
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    // 忽略
  }
}

// 通用 Hook 返回类型
interface UseAnalysisResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => void;
  clearCache: () => void;
}

/**
 * 获取沉降二级分析数据（带缓存）
 */
export function useSettlementAnalysisV2(): UseAnalysisResult<AnalysisResult> {
  const cacheKey = 'settlement';
  const [data, setData] = useState<AnalysisResult | null>(() => getFromCache<AnalysisResult>(cacheKey));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // 如果不强制刷新，先检查缓存
    if (!forceRefresh) {
      const cached = getFromCache<AnalysisResult>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<AnalysisResult>('/analysis/v2/settlement');
      setData(result);
      saveToCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 如果没有缓存数据，则获取
    if (!data) {
      fetchData();
    }
  }, [data, fetchData]);

  const handleClearCache = useCallback(() => {
    clearCache(cacheKey);
    setData(null);
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    clearCache: handleClearCache,
  };
}

/**
 * 获取沉降异常列表
 */
export function useSettlementAnomalies(options?: {
  severity?: SeverityLevel;
  limit?: number;
}): UseAnalysisResult<AnomalyItem[]> {
  const cacheKey = `settlement_anomalies_${options?.severity || 'all'}_${options?.limit || 'all'}`;
  const [data, setData] = useState<AnomalyItem[] | null>(() => getFromCache<AnomalyItem[]>(cacheKey));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getFromCache<AnomalyItem[]>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options?.severity) params.append('severity', options.severity);
      if (options?.limit) params.append('limit', String(options.limit));

      const queryString = params.toString();
      const url = `/analysis/v2/settlement/anomalies${queryString ? `?${queryString}` : ''}`;

      const result = await apiGet<{ count: number; anomalies: AnomalyItem[] }>(url);
      setData(result.anomalies);
      saveToCache(cacheKey, result.anomalies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, options?.severity, options?.limit]);

  useEffect(() => {
    if (!data) {
      fetchData();
    }
  }, [data, fetchData]);

  const handleClearCache = useCallback(() => {
    clearCache(cacheKey);
    setData(null);
  }, [cacheKey]);

  return { data, loading, error, refetch: fetchData, clearCache: handleClearCache };
}

/**
 * 获取沉降处置建议
 */
export function useSettlementRecommendations(): UseAnalysisResult<Recommendation[]> {
  const cacheKey = 'settlement_recommendations';
  const [data, setData] = useState<Recommendation[] | null>(() => getFromCache<Recommendation[]>(cacheKey));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getFromCache<Recommendation[]>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{ count: number; recommendations: Recommendation[] }>(
        '/analysis/v2/settlement/recommendations'
      );
      setData(result.recommendations);
      saveToCache(cacheKey, result.recommendations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!data) {
      fetchData();
    }
  }, [data, fetchData]);

  const handleClearCache = useCallback(() => {
    clearCache(cacheKey);
    setData(null);
  }, []);

  return { data, loading, error, refetch: fetchData, clearCache: handleClearCache };
}

/**
 * 通用二级分析数据 Hook（支持多种数据类型，带缓存）
 */
export function useSecondaryAnalysis(dataType: DataType): UseAnalysisResult<AnalysisResult> {
  const cacheKey = dataType;
  const [data, setData] = useState<AnalysisResult | null>(() => getFromCache<AnalysisResult>(cacheKey));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getFromCache<AnalysisResult>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<AnalysisResult>(`/analysis/v2/${dataType}`);
      setData(result);
      saveToCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load ${dataType} analysis`);
    } finally {
      setLoading(false);
    }
  }, [dataType, cacheKey]);

  useEffect(() => {
    if (!data) {
      fetchData();
    }
  }, [data, fetchData]);

  const handleClearCache = useCallback(() => {
    clearCache(cacheKey);
    setData(null);
  }, [cacheKey]);

  return { data, loading, error, refetch: fetchData, clearCache: handleClearCache };
}

/**
 * 计算异常统计
 */
export function useAnomalyStats(anomalies: AnomalyItem[] | null): AnalysisStats | null {
  if (!anomalies) return null;

  const stats: AnalysisStats = {
    total_points: 0,
    analyzed_points: 0,
    anomaly_count: anomalies.length,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    normal_count: 0,
  };

  const pointSet = new Set<string>();

  anomalies.forEach((a) => {
    pointSet.add(a.point_id);
    switch (a.severity) {
      case 'critical':
        stats.critical_count++;
        break;
      case 'high':
        stats.high_count++;
        break;
      case 'medium':
        stats.medium_count++;
        break;
      case 'low':
        stats.low_count++;
        break;
    }
  });

  stats.analyzed_points = pointSet.size;

  return stats;
}

/**
 * 清除所有分析缓存
 */
export function clearAllAnalysisCache(): void {
  clearCache();
}
