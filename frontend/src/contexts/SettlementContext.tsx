import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useSettlementSummary, usePointData, useSettlementPoints } from '../hooks/useSettlementData';
import type { SummaryDataItem, PointDetailData } from '../types/api';

interface SettlementContextValue {
  // Summary data
  summaryData: SummaryDataItem[] | null;
  summaryLoading: boolean;
  summaryError: string | null;
  refetchSummary: () => void;

  // Points list
  points: string[];
  pointsLoading: boolean;

  // Selected point
  selectedPointId: string | null;
  selectPoint: (pointId: string | null) => void;

  // Point detail data
  pointData: PointDetailData | null;
  pointLoading: boolean;
  pointError: string | null;
}

const SettlementContext = createContext<SettlementContextValue | null>(null);

interface SettlementProviderProps {
  children: ReactNode;
}

export const SettlementProvider: React.FC<SettlementProviderProps> = ({ children }) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Fetch summary data
  const {
    data: summaryData,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useSettlementSummary();

  // Fetch points list
  const { points, loading: pointsLoading } = useSettlementPoints();

  // Fetch selected point data
  const {
    data: pointData,
    loading: pointLoading,
    error: pointError,
  } = usePointData(selectedPointId);

  const selectPoint = useCallback((pointId: string | null) => {
    setSelectedPointId(pointId);
  }, []);

  const value: SettlementContextValue = {
    summaryData,
    summaryLoading,
    summaryError,
    refetchSummary,
    points,
    pointsLoading,
    selectedPointId,
    selectPoint,
    pointData,
    pointLoading,
    pointError,
  };

  return (
    <SettlementContext.Provider value={value}>
      {children}
    </SettlementContext.Provider>
  );
};

export function useSettlement(): SettlementContextValue {
  const context = useContext(SettlementContext);
  if (!context) {
    throw new Error('useSettlement must be used within a SettlementProvider');
  }
  return context;
}

export default SettlementContext;
