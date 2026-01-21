import React, { createContext, useContext, type ReactNode } from 'react';
import { useOverviewData, type OverviewSummary } from '../hooks/useOverviewData';

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

