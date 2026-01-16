import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import type { VibrationChannel, VibrationData, VibrationMetrics } from '../types/api';

export function useVibrationDatasets(): { datasets: string[]; loading: boolean } {
  const [datasets, setDatasets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<{ id?: string; dataset_id?: string }[]>('/vibration/datasets');
        setDatasets(result.map(r => r.id || r.dataset_id || '').filter(Boolean));
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
        const dataset = await apiGet<{ channels?: { channel_id: string; sampling_rate?: number }[] }>(`/vibration/dataset/${datasetId}`);
        const chans = (dataset.channels || []).map(c => ({
          channel_id: c.channel_id,
          name: c.channel_id,
          unit: c.sampling_rate ? `${c.sampling_rate} Hz` : ''
        }));
        setChannels(chans);
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
      const result = await apiGet<{ timeData?: { time: number[]; amplitude: number[]; sampling_rate: number } }>(`/vibration/data/${datasetId}/${channelId}`);
      const td = result.timeData;
      setData(td ? { timestamps: td.time, values: td.amplitude, sample_rate: td.sampling_rate, unit: '' } : null);
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
        const result = await apiGet<{ freqData?: { frequency: number[]; amplitude: number[] } }>(`/vibration/data/${datasetId}/${channelId}`);
        const fd = result.freqData;
        setData(fd ? { freq: fd.frequency, amp: fd.amplitude } : { freq: [], amp: [] });
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
        const result = await apiGet<{ stats?: { mean_value?: number; standard_deviation?: number; peak_value?: number; root_mean_square?: number; center_frequency?: number } }>(`/vibration/dataset/${datasetId}`);
        const s = result.stats || {};
        setData({
          mean: s.mean_value ?? 0,
          std: s.standard_deviation ?? 0,
          peak: s.peak_value ?? 0,
          rms: s.root_mean_square ?? 0,
          center_freq: s.center_frequency ?? 0,
          crest_factor: 0,
          impulse_factor: 0
        });
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
        if (!datasetId) {
          setData(null);
          setLoading(false);
          return;
        }
        const result = await apiGet<{ channels?: { features?: Record<string, number> }[] }>(`/vibration/dataset/${datasetId}`);
        const features = (result.channels?.[0]?.features) || {};
        const keys = ['wave_form_factor', 'peak_factor', 'pulse_factor', 'clearance_factor'];
        const items = keys.map(k => ({ name: k, value: Number(features[k] ?? 0) }));
        setData(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load factors');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [datasetId]);
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
        if (!datasetId) {
          setData(null);
          setLoading(false);
          return;
        }
        const result = await apiGet<{ stats?: { mean_value?: number; standard_deviation?: number; peak_value?: number; root_mean_square?: number; center_frequency?: number } }>(`/vibration/dataset/${datasetId}`);
        const s = result.stats || {};
        const radar = [
          { indicator: '均值', value: Number(s.mean_value ?? 0) },
          { indicator: '标准差', value: Number(s.standard_deviation ?? 0) },
          { indicator: '峰值', value: Number(s.peak_value ?? 0) },
          { indicator: '均方根', value: Number(s.root_mean_square ?? 0) },
          { indicator: '中心频率', value: Number(s.center_frequency ?? 0) },
        ];
        setData(radar);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load radar');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [datasetId]);
  return { data, loading, error };
}
