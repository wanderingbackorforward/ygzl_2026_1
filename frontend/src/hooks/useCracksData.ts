import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type { CrackMonitoringPoint, CrackDataPoint, CrackStatsOverview } from '../types/api';

export function useCrackPoints(): { points: string[]; loading: boolean } {
  const [points, setPoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const result = await apiGet<CrackMonitoringPoint[]>('/crack/monitoring_points');
        setPoints(result.map(p => p.point_id));
      } catch {
        setPoints([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPoints();
  }, []);
  return { points, loading };
}

export function useCrackOverview(): {
  data: CrackStatsOverview | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<CrackStatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<CrackStatsOverview>('/crack/overview');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}

export function useCrackTrend(pointId: string | null): {
  data: CrackDataPoint[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<CrackDataPoint[] | null>(null);
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
      const result = await apiGet<CrackDataPoint[]>(`/crack/trend_data?point_id=${encodeURIComponent(pointId)}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trend');
    } finally {
      setLoading(false);
    }
  }, [pointId]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export function useCrackDailyHistogram(): {
  data: { bins: number[]; counts: number[] } | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ bins: number[]; counts: number[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ bin: number; count: number }[]>('/crack/daily_histogram');
        setData({ bins: result.map(r => r.bin), counts: result.map(r => r.count) });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load histogram');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}

export function useCrackSlope(): {
  data: { point: string; slope: number }[] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ point: string; slope: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ point_id: string; slope: number }[]>('/crack/slope');
        setData(result.map(r => ({ point: r.point_id, slope: r.slope })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load slope');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}

export function useCrackRate(): {
  data: { type: string; rate: number }[] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ type: string; rate: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ type: string; rate: number }[]>('/crack/rate');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load rate');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}

export function useCrackCorrelation(): {
  data: number[][] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<number[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<number[][]>('/crack/correlation');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load correlation');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}
