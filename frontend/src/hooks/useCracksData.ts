import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type { CrackMonitoringPoint, CrackDataPoint, CrackStatsOverview } from '../types/api';

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

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
        const result = await apiGet<CrackStatsOverview>('/crack/stats_overview');
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
      const result = await apiGet<any>(`/crack/trend_data?point_id=${encodeURIComponent(pointId)}`);
      if (Array.isArray(result)) {
        setData(result as CrackDataPoint[]);
      } else if (result && Array.isArray(result.dates) && Array.isArray(result.series)) {
        const dates: string[] = result.dates as string[];
        const series: Array<{ name: string; data: Array<number | null> }> = result.series as any[];
        const target = series.find(s => s && s.name === pointId) || series.find(s => Array.isArray(s.data) && s.data.some(v => v != null));
        const values: number[] = Array.isArray(target?.data) ? (target!.data.map(v => (v == null ? null : Number(v))) as any) : [];
        const arr: CrackDataPoint[] = dates.map((d, i) => {
          const v = (values[i] == null || isNaN(Number(values[i]))) ? null : Number(values[i]);
          const prev = i > 0 ? Number(values[i - 1]) : null;
          const base = values.length > 0 ? Number(values[0]) : null;
          const daily = (v != null && prev != null) ? (v - prev) : null;
          const cum = (v != null && base != null) ? (v - base) : null;
          return {
            measurement_date: d,
            value: v ?? 0,
            daily_change: daily ?? 0,
            cumulative_change: cum ?? 0,
          };
        });
        setData(arr);
      } else {
        setData([]);
      }
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
        const results = await apiGet<any[]>('/crack/analysis_results');
        const values = (results || [])
          .map(r => toFiniteNumber(r?.avg_daily_rate ?? r?.average_change_rate))
          .filter((v): v is number => v != null);
        const min = Math.min(...values, 0);
        const max = Math.max(...values, 0);
        const binCount = 20;
        const bins: number[] = [];
        const counts: number[] = new Array(binCount).fill(0);
        const step = (max - min) / binCount || 1;
        for (let i = 0; i < binCount; i++) bins.push(min + i * step);
        values.forEach(v => {
          const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / step)));
          counts[idx] += 1;
        });
        setData({ bins, counts });
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
        const result = await apiGet<any[]>('/crack/analysis_results');
        const rows = (result || [])
          .map(r => {
            const point = r?.point_id != null ? String(r.point_id) : '';
            const slope = toFiniteNumber(r?.trend_slope ?? r?.slope ?? r?.avg_daily_rate ?? r?.average_change_rate);
            return { point, slope };
          })
          .filter(x => x.point && x.slope != null)
          .map(x => ({ point: x.point, slope: x.slope as number }));
        setData(rows);
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
        const result = await apiGet<any[]>('/crack/analysis_results');
        const agg: Record<string, { sum: number; count: number }> = {};
        (result || []).forEach(r => {
          const key = (r?.change_type || '未知') as string;
          const v = toFiniteNumber(r?.avg_daily_rate ?? r?.average_change_rate);
          if (v == null) return;
          if (!agg[key]) agg[key] = { sum: 0, count: 0 };
          agg[key].sum += v;
          agg[key].count += 1;
        });
        const items = Object.entries(agg).map(([type, { sum, count }]) => ({
          type,
          rate: count ? sum / count : 0,
        }));
        setData(items);
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
  data: { labels: string[]; matrix: number[][] } | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ labels: string[]; matrix: number[][] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<any[]>('/crack/analysis_results');
        const labels = ['平均值', '总变化', '日均速率'];
        const vectors = [
          (result || []).map(r => toFiniteNumber(r?.avg_value ?? r?.mean_value) ?? 0),
          (result || []).map(r => toFiniteNumber(r?.total_change) ?? 0),
          (result || []).map(r => toFiniteNumber(r?.avg_daily_rate ?? r?.average_change_rate) ?? 0),
        ];
        const corr = (a: number[], b: number[]) => {
          const n = a.length;
          const ma = a.reduce((s, v) => s + v, 0) / n;
          const mb = b.reduce((s, v) => s + v, 0) / n;
          let num = 0, da = 0, db = 0;
          for (let i = 0; i < n; i++) {
            const va = a[i] - ma;
            const vb = b[i] - mb;
            num += va * vb;
            da += va * va;
            db += vb * vb;
          }
          return (da && db) ? num / Math.sqrt(da * db) : 0;
        };
        const matrix: number[][] = [];
        for (let i = 0; i < vectors.length; i++) {
          const row: number[] = [];
          for (let j = 0; j < vectors.length; j++) {
            row.push(Number(corr(vectors[i], vectors[j]).toFixed(2)));
          }
          matrix.push(row);
        }
        setData({ labels, matrix });
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
