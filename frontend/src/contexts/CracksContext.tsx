import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  useCrackPoints,
  useCrackTrend,
  useCrackOverview,
  useCrackDailyHistogram,
  useCrackSlope,
  useCrackRate,
  useCrackCorrelation,
} from '../hooks/useCracksData';
import { cachePageData } from '../hooks/usePageContext';
import type { CrackDataPoint, CrackStatsOverview } from '../types/api';

interface CracksContextValue {
  points: string[];
  pointsLoading: boolean;

  selectedPointId: string | null;
  selectPoint: (pointId: string | null) => void;

  trendData: CrackDataPoint[] | null;
  trendLoading: boolean;
  trendError: string | null;
  refetchTrend: () => void;

  overview: CrackStatsOverview | null;
  overviewLoading: boolean;
  overviewError: string | null;

  dailyHistogram: { bins: number[]; counts: number[] } | null;
  dailyHistogramLoading: boolean;
  dailyHistogramError: string | null;

  slopeData: { point: string; slope: number }[] | null;
  slopeLoading: boolean;
  slopeError: string | null;

  rateData: { type: string; rate: number }[] | null;
  rateLoading: boolean;
  rateError: string | null;

  correlation: { labels: string[]; matrix: number[][] } | null;
  correlationLoading: boolean;
  correlationError: string | null;
}

const CracksContext = createContext<CracksContextValue | null>(null);

interface CracksProviderProps {
  children: ReactNode;
}

export const CracksProvider: React.FC<CracksProviderProps> = ({ children }) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const { points, loading: pointsLoading } = useCrackPoints();
  const { data: trendData, loading: trendLoading, error: trendError, refetch: refetchTrend } = useCrackTrend(selectedPointId);
  const { data: overview, loading: overviewLoading, error: overviewError } = useCrackOverview();
  const { data: dailyHistogram, loading: dailyHistogramLoading, error: dailyHistogramError } = useCrackDailyHistogram();
  const { data: slopeData, loading: slopeLoading, error: slopeError } = useCrackSlope();
  const { data: rateData, loading: rateLoading, error: rateError } = useCrackRate();
  const { data: correlation, loading: correlationLoading, error: correlationError } = useCrackCorrelation();

  const selectPoint = useCallback((pointId: string | null) => {
    setSelectedPointId(pointId);
  }, []);
  React.useEffect(() => {
    if (!selectedPointId && points && points.length > 0) {
      setSelectedPointId(points[0]);
    }
  }, [points, selectedPointId]);

  const value: CracksContextValue = {
    points,
    pointsLoading,
    selectedPointId,
    selectPoint,
    trendData,
    trendLoading,
    trendError,
    refetchTrend,
    overview,
    overviewLoading,
    overviewError,
    dailyHistogram,
    dailyHistogramLoading,
    dailyHistogramError,
    slopeData,
    slopeLoading,
    slopeError,
    rateData,
    rateLoading,
    rateError,
    correlation,
    correlationLoading,
    correlationError,
  };

  // 缓存页面数据供悬浮助手使用
  useEffect(() => {
    if (overview && points.length > 0) {
      const dataSnapshot = {
        summary: {
          totalPoints: points.length,
          normalCount: overview.normal || 0,
          warningCount: overview.warning || 0,
          dangerCount: overview.danger || 0,
          avgCrackWidth: overview.avg_width,
          maxCrackWidth: overview.max_width,
        },
        statistics: {
          totalCount: points.length,
          anomalyCount: (overview.warning || 0) + (overview.danger || 0),
          normalCount: overview.normal || 0,
        },
        selectedItems: selectedPointId ? [selectedPointId] : [],
      };

      cachePageData('cracks', dataSnapshot);
    }
  }, [overview, points, selectedPointId]);

  return (
    <CracksContext.Provider value={value}>
      {children}
    </CracksContext.Provider>
  );
};

export function useCracks(): CracksContextValue {
  const context = useContext(CracksContext);
  if (!context) {
    throw new Error('useCracks must be used within a CracksProvider');
  }
  return context;
}

export default CracksContext;
