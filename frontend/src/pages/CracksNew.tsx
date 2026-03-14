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
// Phase 2: Hero Display
import { MasterCautionBar } from '../components/charts/cracks/MasterCautionBar';
import { VitalSignsStrip } from '../components/charts/cracks/VitalSignsStrip';
import { CrackSpatialMap } from '../components/charts/cracks/CrackSpatialMap';
// Phase 3: Main Charts
import { CrackGradeCards } from '../components/charts/cracks/CrackGradeCards';
import { CrackConfidenceBandChart } from '../components/charts/cracks/CrackConfidenceBandChart';
import { CrackPriorityList } from '../components/charts/cracks/CrackPriorityList';
// Phase 4: Diagnostics Drawer
import { CrackDiagnosticsDrawer } from '../components/charts/cracks/CrackDiagnosticsDrawer';
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
  // Phase 3: New intelligence cards (top priority)
  { id: 'crack-spatial-map', title: '空间分布热力图', icon: 'fas fa-map-marked-alt', component: CrackSpatialMap, defaultLayout: { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 } },
  { id: 'crack-priority-list', title: '优先级排序', icon: 'fas fa-list-ol', component: CrackPriorityList, defaultLayout: { x: 6, y: 0, w: 6, h: 5, minW: 4, minH: 4 } },
  { id: 'crack-grade-cards', title: 'GB 50292 等级分布', icon: 'fas fa-th-large', component: CrackGradeCards, defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-confidence-band', title: '置信带趋势', icon: 'fas fa-chart-area', component: CrackConfidenceBandChart, defaultLayout: { x: 4, y: 5, w: 8, h: 4, minW: 4, minH: 3 } },

  // V1 cards (lower priority, can be hidden or moved)
  { id: 'crack-point-selector', title: '监测点选择', icon: 'fas fa-map-marker-alt', component: PointSelectorCard, defaultLayout: { x: 0, y: 9, w: 6, h: 2, minW: 3, minH: 2 } },
  { id: 'crack-main-trend', title: '主趋势', icon: 'fas fa-chart-line', component: CrackMainTrendChart, defaultLayout: { x: 0, y: 11, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'crack-average-trend', title: '平均趋势', icon: 'fas fa-chart-line', component: CrackAverageTrendChart, defaultLayout: { x: 6, y: 9, w: 3, h: 4, minW: 3, minH: 3 } },
  { id: 'crack-overview', title: '状态概览', icon: 'fas fa-chart-pie', component: CrackOverviewPieChart, defaultLayout: { x: 9, y: 9, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-daily', title: '日变化直方图', icon: 'fas fa-chart-bar', component: CrackDailyHistogramChart, defaultLayout: { x: 9, y: 12, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-slope', title: '斜率趋势', icon: 'fas fa-wave-square', component: CrackSlopeChart, defaultLayout: { x: 6, y: 13, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-rate', title: '平均变化速率', icon: 'fas fa-tachometer-alt', component: CrackRateChart, defaultLayout: { x: 0, y: 15, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-correlation', title: '相关性热力图', icon: 'fas fa-th', component: CrackCorrelationHeatmap, defaultLayout: { x: 3, y: 15, w: 3, h: 3, minW: 3, minH: 3 } },
  { id: 'crack-table', title: '数据表格', icon: 'fas fa-table', component: CrackDataTableCard, defaultLayout: { x: 6, y: 16, w: 6, h: 4, minW: 6, minH: 3 } },
];

const CracksDashboard: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDiagPoint, setSelectedDiagPoint] = useState<string | null>(null);
  const { selectedPointId } = useCracks();

  const handleCardFullscreen = useCallback((cardId: string) => setFullscreenCard(cardId), []);
  const handleCloseFullscreen = useCallback(() => setFullscreenCard(null), []);

  const handleOpenDiagnostics = useCallback((pointId: string) => {
    setSelectedDiagPoint(pointId);
    setDrawerOpen(true);
  }, []);

  const handleCloseDiagnostics = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;
    const card = CRACKS_CARDS.find(c => c.id === fullscreenCard);
    if (!card) return null;
    const CardComponent = card.component;
    return <CardComponent cardId={`${fullscreenCard}-fullscreen`} {...card.props} />;
  }, [fullscreenCard]);

  const fullscreenTitle = useMemo(() => CRACKS_CARDS.find(c => c.id === fullscreenCard)?.title || '', [fullscreenCard]);

  return (
    <div className="cracks-page flex flex-col h-full">
      {/* Layer 0: Master Caution (fixed top) */}
      <MasterCautionBar />

      {/* Layer 1: Vital Signs Strip (fixed, never scrolls) */}
      <VitalSignsStrip />

      {/* Layer 3-4: Main content (scrollable) */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <DashboardGrid pageId="cracks" cards={CRACKS_CARDS} onCardFullscreen={handleCardFullscreen} />
      </div>

      {/* Fullscreen Modal */}
      <FullscreenModal isOpen={!!fullscreenCard} onClose={handleCloseFullscreen} title={fullscreenTitle}>
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>{fullscreenContent}</div>
      </FullscreenModal>

      {/* Layer 5: Diagnostics Drawer */}
      <CrackDiagnosticsDrawer
        isOpen={drawerOpen}
        pointId={selectedDiagPoint || selectedPointId}
        onClose={handleCloseDiagnostics}
      />

      <style>{`
        .cracks-page {
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
        }
        @media (max-width: 768px) {
          .cracks-page {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default function CracksNew() {
  return (
    <LayoutProvider>
      <CracksProvider>
        <CracksDashboard />
      </CracksProvider>
    </LayoutProvider>
  );
}
