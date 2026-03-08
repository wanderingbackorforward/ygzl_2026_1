import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  useVibrationDatasets,
  useVibrationChannels,
  useVibrationTimeSeries,
  useVibrationSpectrum,
  useVibrationMetrics,
  useVibrationFactors,
  useVibrationRadar,
} from '../hooks/useVibrationData';
import { cachePageData } from '../hooks/usePageContext';
import type { VibrationChannel, VibrationData, VibrationMetrics } from '../types/api';

interface VibrationContextValue {
  datasets: string[];
  datasetsLoading: boolean;

  selectedDatasetId: string | null;
  selectDataset: (datasetId: string | null) => void;

  channels: VibrationChannel[];
  channelsLoading: boolean;

  selectedChannelId: string | null;
  selectChannel: (channelId: string | null) => void;

  timeSeries: VibrationData | null;
  timeSeriesLoading: boolean;
  timeSeriesError: string | null;
  refetchTimeSeries: () => void;

  spectrum: { freq: number[]; amp: number[] } | null;
  spectrumLoading: boolean;
  spectrumError: string | null;

  metrics: VibrationMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;

  factors: { name: string; value: number }[] | null;
  factorsLoading: boolean;
  factorsError: string | null;

  radar: { indicator: string; value: number }[] | null;
  radarLoading: boolean;
  radarError: string | null;
}

const VibrationContext = createContext<VibrationContextValue | null>(null);

interface VibrationProviderProps {
  children: ReactNode;
}

export const VibrationProvider: React.FC<VibrationProviderProps> = ({ children }) => {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const { datasets, loading: datasetsLoading } = useVibrationDatasets();
  const { channels, loading: channelsLoading } = useVibrationChannels(selectedDatasetId);
  const { data: timeSeries, loading: timeSeriesLoading, error: timeSeriesError, refetch: refetchTimeSeries } = useVibrationTimeSeries(selectedDatasetId, selectedChannelId);
  const { data: spectrum, loading: spectrumLoading, error: spectrumError } = useVibrationSpectrum(selectedDatasetId, selectedChannelId);
  const { data: metrics, loading: metricsLoading, error: metricsError } = useVibrationMetrics(selectedDatasetId, selectedChannelId);
  const { data: factors, loading: factorsLoading, error: factorsError } = useVibrationFactors(selectedDatasetId);
  const { data: radar, loading: radarLoading, error: radarError } = useVibrationRadar(selectedDatasetId);

  const selectDataset = useCallback((datasetId: string | null) => {
    setSelectedDatasetId(datasetId);
    setSelectedChannelId(null);
  }, []);
  const selectChannel = useCallback((channelId: string | null) => {
    setSelectedChannelId(channelId);
  }, []);
  React.useEffect(() => {
    if (!selectedDatasetId && datasets && datasets.length > 0) {
      setSelectedDatasetId(datasets[0]);
    }
  }, [datasets, selectedDatasetId]);
  React.useEffect(() => {
    if (selectedDatasetId && !selectedChannelId && channels && channels.length > 0) {
      setSelectedChannelId(channels[0].channel_id);
    }
  }, [selectedDatasetId, channels, selectedChannelId]);

  const value: VibrationContextValue = {
    datasets,
    datasetsLoading,
    selectedDatasetId,
    selectDataset,
    channels,
    channelsLoading,
    selectedChannelId,
    selectChannel,
    timeSeries,
    timeSeriesLoading,
    timeSeriesError,
    refetchTimeSeries,
    spectrum,
    spectrumLoading,
    spectrumError,
    metrics,
    metricsLoading,
    metricsError,
    factors,
    factorsLoading,
    factorsError,
    radar,
    radarLoading,
    radarError,
  };

  // 缓存页面数据供悬浮助手使用
  useEffect(() => {
    if (datasets.length > 0 && channels.length > 0 && metrics) {
      const dataSnapshot = {
        summary: {
          totalDatasets: datasets.length,
          totalChannels: channels.length,
          rmsValue: metrics.rms,
          peakValue: metrics.peak,
          kurtosis: metrics.kurtosis,
        },
        statistics: {
          totalCount: channels.length,
          anomalyCount: 0, // 振动数据没有明确的异常标记
          normalCount: channels.length,
        },
        selectedItems: selectedChannelId ? [selectedChannelId] : [],
      };

      cachePageData('vibration', dataSnapshot);
    }
  }, [datasets, channels, metrics, selectedChannelId]);

  return (
    <VibrationContext.Provider value={value}>
      {children}
    </VibrationContext.Provider>
  );
};

export function useVibration(): VibrationContextValue {
  const context = useContext(VibrationContext);
  if (!context) {
    throw new Error('useVibration must be used within a VibrationProvider');
  }
  return context;
}

export default VibrationContext;
