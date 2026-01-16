import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  useTemperatureSummary,
  useTemperatureSensors,
  useTemperatureSeries,
  useTemperatureRange,
  useTemperatureTrends,
} from '../hooks/useTemperatureData';
import type { TemperatureSummary, TemperatureDataPoint } from '../types/api';

interface TemperatureContextValue {
  summary: TemperatureSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  refetchSummary: () => void;

  sensors: string[];
  sensorsLoading: boolean;

  selectedSensorId: string | null;
  selectSensor: (sensorId: string | null) => void;

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

  const { sensors, loading: sensorsLoading } = useTemperatureSensors();

  const {
    data: seriesData,
    loading: seriesLoading,
    error: seriesError,
    refetch: refetchSeries,
  } = useTemperatureSeries(selectedSensorId);

  const {
    data: rangeData,
    loading: rangeLoading,
    error: rangeError,
  } = useTemperatureRange(selectedSensorId);

  const {
    data: trendStats,
    loading: trendLoading,
    error: trendError,
  } = useTemperatureTrends();

  const selectSensor = useCallback((sensorId: string | null) => {
    setSelectedSensorId(sensorId);
  }, []);

  const value: TemperatureContextValue = {
    summary,
    summaryLoading,
    summaryError,
    refetchSummary,
    sensors,
    sensorsLoading,
    selectedSensorId,
    selectSensor,
    seriesData,
    seriesLoading,
    seriesError,
    refetchSeries,
    rangeData,
    rangeLoading,
    rangeError,
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
