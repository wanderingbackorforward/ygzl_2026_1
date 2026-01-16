import React, { useState, useCallback, useMemo } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { SettlementProvider, useSettlement } from '../contexts/SettlementContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { FullscreenModal } from '../components/layout/FullscreenModal';
import { TrendChart } from '../components/charts/TrendChart';
import { DistributionChart } from '../components/charts/DistributionChart';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { RateChart } from '../components/charts/RateChart';
import { PointSelector } from '../components/shared/PointSelector';
import { PointDetails } from '../components/shared/PointDetails';
import type { CardConfig } from '../types/layout';

import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

// Wrapper components that use context
const PointSelectorCard: React.FC = () => {
  const { points, pointsLoading, selectedPointId, selectPoint } = useSettlement();
  return (
    <PointSelector
      cardId="point-selector"
      points={points}
      selectedPoint={selectedPointId}
      onSelectPoint={selectPoint}
      loading={pointsLoading}
    />
  );
};

const PointDetailsCard: React.FC = () => {
  const { selectedPointId, pointData, pointLoading } = useSettlement();
  return (
    <PointDetails
      cardId="point-details"
      pointId={selectedPointId}
      data={pointData?.analysisData || null}
      loading={pointLoading}
    />
  );
};

const TimeSeriesChartCard: React.FC = () => {
  const { selectedPointId, pointData, pointLoading } = useSettlement();
  return (
    <TimeSeriesChart
      cardId="time-series"
      pointId={selectedPointId}
      data={pointData?.timeSeriesData || null}
      loading={pointLoading}
    />
  );
};

const RateChartCard: React.FC = () => {
  const { selectedPointId, pointData, pointLoading } = useSettlement();
  return (
    <RateChart
      cardId="rate-chart"
      pointId={selectedPointId}
      data={pointData?.timeSeriesData || null}
      loading={pointLoading}
    />
  );
};

// Card configurations
const SETTLEMENT_CARDS: CardConfig[] = [
  {
    id: 'trend-chart',
    title: '趋势分析',
    icon: 'fas fa-chart-bar',
    component: TrendChart,
    defaultLayout: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'distribution',
    title: '趋势类型分布',
    icon: 'fas fa-chart-pie',
    component: DistributionChart,
    defaultLayout: { x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'point-selector',
    title: '监测点选择',
    icon: 'fas fa-map-marker-alt',
    component: PointSelectorCard,
    defaultLayout: { x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 }
  },
  {
    id: 'point-details',
    title: '监测点详情',
    icon: 'fas fa-info-circle',
    component: PointDetailsCard,
    defaultLayout: { x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 }
  },
  {
    id: 'time-series',
    title: '时间序列',
    icon: 'fas fa-chart-line',
    component: TimeSeriesChartCard,
    defaultLayout: { x: 6, y: 3, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'rate-chart',
    title: '沉降速率',
    icon: 'fas fa-tachometer-alt',
    component: RateChartCard,
    defaultLayout: { x: 0, y: 8, w: 12, h: 4, minW: 6, minH: 3 }
  },
];

// Inner component that uses the context
const SettlementDashboard: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const { selectedPointId, pointData, pointLoading } = useSettlement();

  const handleCardFullscreen = useCallback((cardId: string) => {
    setFullscreenCard(cardId);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenCard(null);
  }, []);

  // Get fullscreen content
  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;

    switch (fullscreenCard) {
      case 'trend-chart':
        return <TrendChart cardId="trend-chart-fullscreen" />;
      case 'distribution':
        return <DistributionChart cardId="distribution-fullscreen" />;
      case 'time-series':
        return (
          <TimeSeriesChart
            cardId="time-series-fullscreen"
            pointId={selectedPointId}
            data={pointData?.timeSeriesData || null}
            loading={pointLoading}
          />
        );
      case 'rate-chart':
        return (
          <RateChart
            cardId="rate-chart-fullscreen"
            pointId={selectedPointId}
            data={pointData?.timeSeriesData || null}
            loading={pointLoading}
          />
        );
      default:
        return null;
    }
  }, [fullscreenCard, selectedPointId, pointData, pointLoading]);

  const fullscreenTitle = useMemo(() => {
    const card = SETTLEMENT_CARDS.find(c => c.id === fullscreenCard);
    return card?.title || '';
  }, [fullscreenCard]);

  return (
    <div className="settlement-page">
      <DashboardGrid
        pageId="settlement"
        cards={SETTLEMENT_CARDS}
        onCardFullscreen={handleCardFullscreen}
      />

      <FullscreenModal
        isOpen={!!fullscreenCard}
        onClose={handleCloseFullscreen}
        title={fullscreenTitle}
      >
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>
          {fullscreenContent}
        </div>
      </FullscreenModal>

      <style>{`
        .settlement-page {
          height: calc(100vh - 64px);
          padding: 16px;
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
          overflow: auto;
        }
      `}</style>
    </div>
  );
};

// Main component with providers
export default function Settlement() {
  return (
    <LayoutProvider>
      <SettlementProvider>
        <SettlementDashboard />
      </SettlementProvider>
    </LayoutProvider>
  );
}
