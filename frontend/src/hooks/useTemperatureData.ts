import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type { TemperatureSummary, TemperatureDataPoint } from '../types/api';

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
      const result = await apiGet<TemperatureSummary>('/temperature/summary');
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

export function useTemperatureSensors(): { sensors: string[]; loading: boolean } {
  const [sensors, setSensors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const result = await apiGet<{ sensor_id: string }[]>('/temperature/stats');
        setSensors(result.map(s => s.sensor_id));
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
      const result = await apiGet<TemperatureDataPoint[]>(`/temperature/data/${sensorId}`);
      setData(result);
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
        const result = await apiGet<TemperatureDataPoint[]>(`/temperature/data/${sensorId}`);
        setData(result);
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
        const result = await apiGet<{ label: string; value: number }[]>('/temperature/trends');
        const labels = result.map(r => r.label);
        const values = result.map(r => r.value);
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
