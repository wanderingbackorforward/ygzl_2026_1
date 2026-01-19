import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type { TemperatureSummary, TemperatureDataPoint, TemperatureDetailData } from '../types/api';

export function useTemperatureSummary(): {
  data: TemperatureSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<TemperatureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<any>('/temperature/summary');
      if (Array.isArray(result)) {
        const total = result.length;
        const temps = result.map((r: any) => ({
          avg: Number(r.avg_temp ?? r.avg_temperature ?? 0),
          min: Number(r.min_temp ?? r.min_temperature ?? 0),
          max: Number(r.max_temp ?? r.max_temperature ?? 0),
          date: r.measurement_date ?? r.date ?? null
        }));
        const avg_temp = temps.reduce((s, t) => s + t.avg, 0) / (total || 1);
        const min_temp = Math.min(...temps.map(t => t.min));
        const max_temp = Math.max(...temps.map(t => t.max));
        const date_range = {
          start: (result[0]?.measurement_date ?? result[0]?.date ?? '') || '',
          end: (result[result.length - 1]?.measurement_date ?? result[result.length - 1]?.date ?? '') || ''
        };
        setData({ total_sensors: total, avg_temp, min_temp, max_temp, date_range });
      } else {
        setData(result as TemperatureSummary);
      }
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

export function useTemperatureSensors(): { sensors: string[]; loading: boolean } {
  const [sensors, setSensors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const summaryResult = await apiGet<any>('/temperature/summary');
        if (Array.isArray(summaryResult)) {
          const cleaned = Array.from(
            new Set(
              summaryResult
                .map((row: any) => row?.sensor_id ?? row?.SID ?? row?.point_id ?? '')
                .map((id: any) => (id != null ? String(id) : ''))
                .filter((id: string) => id && id !== 'null' && id !== 'undefined')
            )
          );
          setSensors(cleaned);
          return;
        }

        const pointsResult = await apiGet<{ sensor_id?: string; point_id?: string; SID?: string }[]>('/temperature/points');
        const cleaned = Array.from(
          new Set(
            (pointsResult || [])
              .map(s => {
                const id = s.sensor_id ?? s.point_id ?? s.SID ?? '';
                return id != null ? String(id) : '';
              })
              .filter(id => id && id !== 'null' && id !== 'undefined')
          )
        );
        setSensors(cleaned);
      } catch (e) {
        setSensors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSensors();
  }, []);

  return { sensors, loading };
}

export function useTemperatureDetail(sensorId: string | null): {
  data: TemperatureDetailData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<TemperatureDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sensorId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<any>(`/temperature/data/${sensorId}`);
      const timeSeriesData = Array.isArray(result?.timeSeriesData) ? (result.timeSeriesData as TemperatureDataPoint[]) : [];
      const analysisData = result && typeof result === 'object' && result.analysisData && typeof result.analysisData === 'object'
        ? result.analysisData
        : {};
      setData({ timeSeriesData, analysisData });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load detail');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sensorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useTemperatureSeries(sensorId: string | null): {
  data: TemperatureDataPoint[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<TemperatureDataPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sensorId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<any>(`/temperature/data/${sensorId}`);
      let arr: TemperatureDataPoint[] = [];
      if (Array.isArray(result)) {
        arr = result as TemperatureDataPoint[];
      } else if (result && Array.isArray(result.timeSeriesData)) {
        arr = result.timeSeriesData as TemperatureDataPoint[];
      } else {
        arr = [];
      }
      setData(arr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load series');
    } finally {
      setLoading(false);
    }
  }, [sensorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useTemperatureRange(sensorId: string | null): {
  data: TemperatureDataPoint[] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<TemperatureDataPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!sensorId) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await apiGet<any>(`/temperature/data/${sensorId}`);
        let arr: TemperatureDataPoint[] = [];
        if (Array.isArray(result)) {
          arr = result as TemperatureDataPoint[];
        } else if (result && Array.isArray(result.timeSeriesData)) {
          arr = result.timeSeriesData as TemperatureDataPoint[];
        } else {
          arr = [];
        }
        setData(arr);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load range');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sensorId]);

  return { data, loading, error };
}

export function useTemperatureTrends(): {
  data: { labels: string[]; values: number[] } | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ labels: string[]; values: number[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ label?: string; value?: number; trend_type?: string; count?: number }[]>('/temperature/trends');
        const labels = result.map(r => (r.label ?? r.trend_type ?? '未知'));
        const values = result.map(r => Number(r.value ?? r.count ?? 0));
        setData({ labels, values });
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
