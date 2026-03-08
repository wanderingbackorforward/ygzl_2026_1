import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useOverviewData, type OverviewSummary } from '../hooks/useOverviewData';
import { cachePageData } from '../hooks/usePageContext';

interface OverviewContextValue {
  summary: OverviewSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const OverviewContext = createContext<OverviewContextValue | null>(null);

export const OverviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data, loading, error, refetch } = useOverviewData();

  const value: OverviewContextValue = {
    summary: data,
    loading,
    error,
    refetch,
  };

  // 缓存页面数据供悬浮助手使用
  useEffect(() => {
    if (data) {
      const dataSnapshot = {
        summary: {
          totalSettlementPoints: data.settlement.total_points,
          settlementAlertCount: data.settlement.alert_count,
          maxSettlement: data.settlement.max_value,
          totalCrackPoints: data.cracks.total_points,
          criticalCracks: data.cracks.critical_count,
          expandingCracks: data.cracks.expanding_count,
          totalTemperatureSensors: data.temperature.total_sensors,
          avgTemperature: data.temperature.avg_temp,
          minTemperature: data.temperature.min_temp,
          maxTemperature: data.temperature.max_temp,
          totalVibrationDatasets: data.vibration.total_datasets,
          safetyScore: data.safety_score,
        },
        statistics: {
          totalCount: data.settlement.total_points + data.cracks.total_points + data.temperature.total_sensors,
          anomalyCount: data.settlement.alert_count + data.cracks.critical_count,
          normalCount: (data.settlement.total_points - data.settlement.alert_count) + (data.cracks.total_points - data.cracks.critical_count),
        },
        selectedItems: [],
      };

      cachePageData('overview', dataSnapshot);
    }
  }, [data]);

  return (
    <OverviewContext.Provider value={value}>
      {children}
    </OverviewContext.Provider>
  );
};

export function useOverview(): OverviewContextValue {
  const context = useContext(OverviewContext);
  if (!context) {
    throw new Error('useOverview must be used within an OverviewProvider');
  }
  return context;
}

export default OverviewContext;

