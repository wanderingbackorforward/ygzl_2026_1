import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type {
  SummaryDataItem,
  PointDetailData,
  TrendStats,
  PointPredictionData,
  PredictionSummaryItem,
  RiskAlertsResponse
} from '../types/api';

export interface UseSettlementSummaryResult {
  data: SummaryDataItem[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSettlementSummary(): UseSettlementSummaryResult {
  const [data, setData] = useState<SummaryDataItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<SummaryDataItem[]>('/summary');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export interface UsePointDataResult {
  data: PointDetailData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePointData(pointId: string | null): UsePointDataResult {
  const [data, setData] = useState<PointDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<PointDetailData>(`/point/${pointId}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load point data');
    } finally {
      setLoading(false);
    }
  }, [pointId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export interface UseTrendStatsResult {
  data: TrendStats | null;
  loading: boolean;
  error: string | null;
}

export function useTrendStats(): UseTrendStatsResult {
  const [data, setData] = useState<TrendStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<TrendStats>('/trends');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load trends');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

export function useSettlementPoints(): { points: string[]; loading: boolean } {
  const [points, setPoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const result = await apiGet<{ point_id: string }[]>('/points');
        setPoints(result.map(p => p.point_id));
      } catch (e) {
        console.error('Failed to load points:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, []);

  return { points, loading };
}

// Prediction Hooks
export interface UsePointPredictionResult {
  data: PointPredictionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePointPrediction(pointId: string | null, days = 30): UsePointPredictionResult {
  const [data, setData] = useState<PointPredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!pointId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<PointPredictionData>(`/prediction/${pointId}?days=${days}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prediction data');
    } finally {
      setLoading(false);
    }
  }, [pointId, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export interface UsePredictionSummaryResult {
  data: PredictionSummaryItem[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePredictionSummary(): UsePredictionSummaryResult {
  const [data, setData] = useState<PredictionSummaryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<PredictionSummaryItem[]>('/predictions/summary');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prediction summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export interface UseRiskAlertsResult {
  data: RiskAlertsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRiskAlerts(): UseRiskAlertsResult {
  const [data, setData] = useState<RiskAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<RiskAlertsResponse>('/risk/alerts');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load risk alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
