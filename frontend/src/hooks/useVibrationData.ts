import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type { VibrationChannel, VibrationData, VibrationMetrics } from '../types/api';

export function useVibrationDatasets(): { datasets: string[]; loading: boolean } {
  const [datasets, setDatasets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ dataset_id: string }[]>('/vibration/datasets');
        setDatasets(result.map(r => r.dataset_id));
      } catch {
        setDatasets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { datasets, loading };
}

export function useVibrationChannels(datasetId: string | null): { channels: VibrationChannel[]; loading: boolean } {
  const [channels, setChannels] = useState<VibrationChannel[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchData = async () => {
      if (!datasetId) {
        setChannels([]);
        return;
      }
      setLoading(true);
      try {
        const result = await apiGet<VibrationChannel[]>(`/vibration/dataset/${datasetId}`);
        setChannels(result);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [datasetId]);
  return { channels, loading };
}

export function useVibrationTimeSeries(datasetId: string | null, channelId: string | null): {
  data: VibrationData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<VibrationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchData = useCallback(async () => {
    if (!datasetId || !channelId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<VibrationData>(`/vibration/data/${datasetId}/${channelId}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load series');
    } finally {
      setLoading(false);
    }
  }, [datasetId, channelId]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export function useVibrationSpectrum(datasetId: string | null, channelId: string | null): {
  data: { freq: number[]; amp: number[] } | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ freq: number[]; amp: number[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      if (!datasetId || !channelId) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await apiGet<{ freq: number[]; amp: number[] }>(`/vibration/spectrum/${datasetId}/${channelId}`);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load spectrum');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [datasetId, channelId]);
  return { data, loading, error };
}

export function useVibrationMetrics(datasetId: string | null, channelId: string | null): {
  data: VibrationMetrics | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<VibrationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      if (!datasetId || !channelId) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await apiGet<VibrationMetrics>(`/vibration/metrics/${datasetId}/${channelId}`);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [datasetId, channelId]);
  return { data, loading, error };
}

export function useVibrationFactors(datasetId: string | null): {
  data: { name: string; value: number }[] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ name: string; value: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ name: string; value: number }[]>('/vibration/factors');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load factors');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}

export function useVibrationRadar(datasetId: string | null): {
  data: { indicator: string; value: number }[] | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<{ indicator: string; value: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ indicator: string; value: number }[]>('/vibration/radar');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load radar');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return { data, loading, error };
}
