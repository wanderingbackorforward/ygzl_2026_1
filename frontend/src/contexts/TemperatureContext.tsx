import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  useTemperatureSummary,
  useTemperatureSensors,
  useTemperatureDetail,
  useTemperatureTrends,
} from '../hooks/useTemperatureData';
import { apiGet } from '../lib/api';
import type { TemperatureSummary, TemperatureDataPoint, TemperatureAnalysisData } from '../types/api';

interface TemperatureContextValue {
  summary: TemperatureSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  refetchSummary: () => void;

  sensors: string[];
  sensorsLoading: boolean;
  problemSensorIds: string[];

  selectedSensorId: string | null;
  selectSensor: (sensorId: string | null) => void;

  analysisData: TemperatureAnalysisData | null;
  analysisLoading: boolean;
  analysisError: string | null;

  seriesData: TemperatureDataPoint[] | null;
  seriesLoading: boolean;
  seriesError: string | null;
  refetchSeries: () => void;

  rangeData: TemperatureDataPoint[] | null;
  rangeLoading: boolean;
  rangeError: string | null;

  trendStats: { labels: string[]; values: number[] } | null;
  trendLoading: boolean;
  trendError: string | null;
}

const TemperatureContext = createContext<TemperatureContextValue | null>(null);

interface TemperatureProviderProps {
  children: ReactNode;
}

export const TemperatureProvider: React.FC<TemperatureProviderProps> = ({ children }) => {
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useTemperatureSummary();

  const { sensors, problemSensorIds, loading: sensorsLoading } = useTemperatureSensors();

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useTemperatureDetail(selectedSensorId);

  const {
    data: trendStats,
    loading: trendLoading,
    error: trendError,
  } = useTemperatureTrends();

  const selectSensor = useCallback((sensorId: string | null) => {
    setSelectedSensorId(sensorId);
  }, []);
  React.useEffect(() => {
    if (!selectedSensorId) {
      const firstValid = sensors.find(id => id && id !== 'null' && id !== 'undefined') || null;
      if (firstValid) {
        // 优先选择有数据的传感器（参考 master 行为）
        const tryPick = async () => {
          try {
            const candidates = sensors.slice(0, 10).filter(Boolean);
            if (candidates.length === 0) {
              setSelectedSensorId(firstValid);
              return;
            }
            const q = encodeURIComponent(candidates.join(','));
            const multi = await apiGet<Record<string, unknown[]>>(`/temperature/data/multi?ids=${q}`);
            const usable = candidates.find(id => Array.isArray(multi?.[id]) && (multi?.[id] as unknown[]).length > 0) || firstValid;
            setSelectedSensorId(usable);
          } catch {
            setSelectedSensorId(firstValid);
          }
        };
        void tryPick();
      }
    } else if (sensors.length > 0 && !sensors.includes(selectedSensorId)) {
      // 当前选择不在列表中，回退到第一个有效
      const firstValid = sensors.find(id => id && id !== 'null' && id !== 'undefined') || null;
      if (firstValid) setSelectedSensorId(firstValid);
      else setSelectedSensorId(null);
    }
  }, [sensors, selectedSensorId]);

  const value: TemperatureContextValue = {
    summary,
    summaryLoading,
    summaryError,
    refetchSummary,
    sensors,
    sensorsLoading,
    problemSensorIds,
    selectedSensorId,
    selectSensor,
    analysisData: detailData?.analysisData ?? null,
    analysisLoading: detailLoading,
    analysisError: detailError,
    seriesData: detailData?.timeSeriesData ?? null,
    seriesLoading: detailLoading,
    seriesError: detailError,
    refetchSeries: refetchDetail,
    rangeData: detailData?.timeSeriesData ?? null,
    rangeLoading: detailLoading,
    rangeError: detailError,
    trendStats,
    trendLoading,
    trendError,
  };

  return (
    <TemperatureContext.Provider value={value}>
      {children}
    </TemperatureContext.Provider>
  );
};

export function useTemperature(): TemperatureContextValue {
  const context = useContext(TemperatureContext);
  if (!context) {
    throw new Error('useTemperature must be used within a TemperatureProvider');
  }
  return context;
}

export default TemperatureContext;
