import React, { useState, useCallback, useMemo } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { CracksProvider, useCracks } from '../contexts/CracksContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { FullscreenModal } from '../components/layout/FullscreenModal';
import { PointSelector } from '../components/shared/PointSelector';
import { CrackOverviewPieChart } from '../components/charts/cracks/CrackOverviewPieChart';
import { CrackDailyHistogramChart } from '../components/charts/cracks/CrackDailyHistogramChart';
import { CrackAverageTrendChart } from '../components/charts/cracks/CrackAverageTrendChart';
import { CrackMainTrendChart } from '../components/charts/cracks/CrackMainTrendChart';
import { CrackSlopeChart } from '../components/charts/cracks/CrackSlopeChart';
import { CrackRateChart } from '../components/charts/cracks/CrackRateChart';
import { CrackCorrelationHeatmap } from '../components/charts/cracks/CrackCorrelationHeatmap';
import { CrackDataTableCard } from '../components/shared/CrackDataTableCard';
import type { CardConfig } from '../types/layout';
import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

const PointSelectorCard: React.FC = () => {
  const { points, pointsLoading, selectedPointId, selectPoint } = useCracks();
  return (
    <PointSelector
      cardId="crack-point-selector"
      points={points}
      selectedPoint={selectedPointId}
      onSelectPoint={(id) => selectPoint(id)}
      loading={pointsLoading}
    />
  );
};

const CRACKS_CARDS: CardConfig[] = [
  { id: 'crack-average-trend', title: '平均趋势', icon: 'fas fa-chart-line', component: CrackAverageTrendChart, defaultLayout: { x: 0, y: 0, w: 3, h: 4, minW: 3, minH: 3 } },
  { id: 'crack-overview', title: '状态概览', icon: 'fas fa-chart-pie', component: CrackOverviewPieChart, defaultLayout: { x: 0, y: 4, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-daily', title: '日变化直方图', icon: 'fas fa-chart-bar', component: CrackDailyHistogramChart, defaultLayout: { x: 0, y: 7, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-point-selector', title: '监测点选择', icon: 'fas fa-map-marker-alt', component: PointSelectorCard, defaultLayout: { x: 3, y: 0, w: 6, h: 2, minW: 3, minH: 2 } },
  { id: 'crack-main-trend', title: '主趋势', icon: 'fas fa-chart-line', component: CrackMainTrendChart, defaultLayout: { x: 3, y: 2, w: 6, h: 5, minW: 4, minH: 3 } },
  { id: 'crack-table', title: '数据表格', icon: 'fas fa-table', component: CrackDataTableCard, defaultLayout: { x: 3, y: 7, w: 6, h: 4, minW: 6, minH: 3 } },
  { id: 'crack-slope', title: '斜率趋势', icon: 'fas fa-wave-square', component: CrackSlopeChart, defaultLayout: { x: 9, y: 0, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-rate', title: '平均变化速率', icon: 'fas fa-tachometer-alt', component: CrackRateChart, defaultLayout: { x: 9, y: 3, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-correlation', title: '相关性热力图', icon: 'fas fa-th', component: CrackCorrelationHeatmap, defaultLayout: { x: 9, y: 6, w: 3, h: 5, minW: 3, minH: 3 } },
];

const CracksDashboard: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const handleCardFullscreen = useCallback((cardId: string) => setFullscreenCard(cardId), []);
  const handleCloseFullscreen = useCallback(() => setFullscreenCard(null), []);
  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;
    switch (fullscreenCard) {
      case 'crack-overview': return <CrackOverviewPieChart cardId="crack-overview-fullscreen" />;
      case 'crack-daily': return <CrackDailyHistogramChart cardId="crack-daily-fullscreen" />;
      case 'crack-average-trend': return <CrackAverageTrendChart cardId="crack-average-trend-fullscreen" />;
      case 'crack-main-trend': return <CrackMainTrendChart cardId="crack-main-trend-fullscreen" />;
      case 'crack-slope': return <CrackSlopeChart cardId="crack-slope-fullscreen" />;
      case 'crack-rate': return <CrackRateChart cardId="crack-rate-fullscreen" />;
      case 'crack-correlation': return <CrackCorrelationHeatmap cardId="crack-correlation-fullscreen" />;
      case 'crack-table': return <CrackDataTableCard cardId="crack-table-fullscreen" />;
      default: return null;
    }
  }, [fullscreenCard]);
  const fullscreenTitle = useMemo(() => CRACKS_CARDS.find(c => c.id === fullscreenCard)?.title || '', [fullscreenCard]);
  return (
    <div className="cracks-page">
      <DashboardGrid pageId="cracks" cards={CRACKS_CARDS} onCardFullscreen={handleCardFullscreen} />
      <FullscreenModal isOpen={!!fullscreenCard} onClose={handleCloseFullscreen} title={fullscreenTitle}>
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>{fullscreenContent}</div>
      </FullscreenModal>
      <style>{`
        .cracks-page {
          height: calc(100vh - 64px);
          padding: 16px;
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
          overflow: auto;
        }
        @media (max-width: 768px) {
          .cracks-page {
            height: auto;
            min-height: calc(100vh - 64px);
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default function Cracks() {
  return (
    <LayoutProvider>
      <CracksProvider>
        <CracksDashboard />
      </CracksProvider>
    </LayoutProvider>
  );
}
