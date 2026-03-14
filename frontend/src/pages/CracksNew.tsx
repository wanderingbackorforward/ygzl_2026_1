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
// V2 Hero Display — rendered OUTSIDE DashboardGrid
import { MasterCautionBar } from '../components/charts/cracks/MasterCautionBar';
import { VitalSignsStrip } from '../components/charts/cracks/VitalSignsStrip';
import { CrackSpatialMap } from '../components/charts/cracks/CrackSpatialMap';
// V2 Main Charts — rendered OUTSIDE DashboardGrid
import { CrackGradeCards } from '../components/charts/cracks/CrackGradeCards';
import { CrackConfidenceBandChart } from '../components/charts/cracks/CrackConfidenceBandChart';
import { CrackPriorityList } from '../components/charts/cracks/CrackPriorityList';
// V2 Diagnostics Drawer
import { CrackDiagnosticsDrawer } from '../components/charts/cracks/CrackDiagnosticsDrawer';
import type { CardConfig } from '../types/layout';
import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

/* ── V1 legacy cards — only these go into DashboardGrid ── */
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

const V1_LEGACY_CARDS: CardConfig[] = [
  { id: 'crack-point-selector', title: '监测点选择', icon: 'fas fa-map-marker-alt', component: PointSelectorCard, defaultLayout: { x: 0, y: 0, w: 6, h: 2, minW: 3, minH: 2 } },
  { id: 'crack-main-trend', title: '主趋势', icon: 'fas fa-chart-line', component: CrackMainTrendChart, defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'crack-average-trend', title: '平均趋势', icon: 'fas fa-chart-line', component: CrackAverageTrendChart, defaultLayout: { x: 6, y: 0, w: 3, h: 4, minW: 3, minH: 3 } },
  { id: 'crack-overview', title: '状态概览', icon: 'fas fa-chart-pie', component: CrackOverviewPieChart, defaultLayout: { x: 9, y: 0, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-daily', title: '日变化直方图', icon: 'fas fa-chart-bar', component: CrackDailyHistogramChart, defaultLayout: { x: 9, y: 3, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-slope', title: '斜率趋势', icon: 'fas fa-wave-square', component: CrackSlopeChart, defaultLayout: { x: 6, y: 4, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-rate', title: '平均变化速率', icon: 'fas fa-tachometer-alt', component: CrackRateChart, defaultLayout: { x: 0, y: 6, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'crack-correlation', title: '相关性热力图', icon: 'fas fa-th', component: CrackCorrelationHeatmap, defaultLayout: { x: 3, y: 6, w: 3, h: 3, minW: 3, minH: 3 } },
  { id: 'crack-table', title: '数据表格', icon: 'fas fa-table', component: CrackDataTableCard, defaultLayout: { x: 6, y: 7, w: 6, h: 4, minW: 6, minH: 3 } },
];

/* ── V2 Section Card wrapper ── */
const SectionCard: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, children, className = '' }) => (
  <div className={`rounded-xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-sm overflow-hidden ${className}`}>
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/60">
      <i className={`fas ${icon} text-cyan-400 text-sm`} />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
    <div className="relative" style={{ minHeight: 200 }}>{children}</div>
  </div>
);

/* ── Main Dashboard ── */
const CracksDashboard: React.FC = () => {
  const [showV1, setShowV1] = useState(false);
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { selectedPointId } = useCracks();

  const handleCardFullscreen = useCallback((cardId: string) => setFullscreenCard(cardId), []);
  const handleCloseFullscreen = useCallback(() => setFullscreenCard(null), []);
  const handleOpenDiagnostics = useCallback(() => setDrawerOpen(true), []);
  const handleCloseDiagnostics = useCallback(() => setDrawerOpen(false), []);

  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;
    const card = V1_LEGACY_CARDS.find(c => c.id === fullscreenCard);
    if (!card) return null;
    const CardComponent = card.component;
    return <CardComponent cardId={`${fullscreenCard}-fullscreen`} {...card.props} />;
  }, [fullscreenCard]);

  const fullscreenTitle = useMemo(
    () => V1_LEGACY_CARDS.find(c => c.id === fullscreenCard)?.title || '',
    [fullscreenCard]
  );

  return (
    <div className="cracks-page flex flex-col h-full">
      {/* ════════ Layer 0: Master Caution — 0.5s decision ════════ */}
      <MasterCautionBar />

      {/* ════════ Layer 1: Vital Signs — 2s scan ════════ */}
      <VitalSignsStrip />

      {/* ════════ Scrollable content starts here ════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ════════ Layer 3: Hero — Spatial + Priority ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 pb-0">
          <SectionCard title="空间分布热力图" icon="fa-map-marked-alt">
            <div style={{ height: 360 }}>
              <CrackSpatialMap cardId="v2-spatial" />
            </div>
          </SectionCard>

          <SectionCard title="优先级排序" icon="fa-list-ol">
            <div style={{ height: 360 }} className="overflow-y-auto">
              <CrackPriorityList cardId="v2-priority" />
            </div>
          </SectionCard>
        </div>

        {/* ════════ Layer 4: GB Standards + Confidence Band ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 pb-0">
          <SectionCard title="GB 50292 等级分布" icon="fa-th-large">
            <CrackGradeCards cardId="v2-grades" />
          </SectionCard>

          <SectionCard title="置信带趋势" icon="fa-chart-area" className="lg:col-span-2">
            <div style={{ height: 320 }}>
              <CrackConfidenceBandChart cardId="v2-confidence" />
            </div>
          </SectionCard>
        </div>

        {/* ════════ Diagnostics button ════════ */}
        {selectedPointId && (
          <div className="px-4 pt-4">
            <button
              onClick={handleOpenDiagnostics}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-microscope" />
              Open Deep Diagnostics: {selectedPointId}
              <span className="text-xs opacity-70">(Wavelet / Hurst / CUSUM / Entropy / Creep / Thermal / Settlement)</span>
            </button>
          </div>
        )}

        {/* ════════ V1 Legacy Cards — collapsible ════════ */}
        <div className="px-4 pt-6 pb-4">
          <button
            onClick={() => setShowV1(!showV1)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-3"
          >
            <i className={`fas fa-chevron-${showV1 ? 'down' : 'right'} text-xs`} />
            <span>{showV1 ? '收起' : '展开'} V1 详细图表 ({V1_LEGACY_CARDS.length} 个)</span>
          </button>

          {showV1 && (
            <DashboardGrid
              pageId="cracks-v1"
              cards={V1_LEGACY_CARDS}
              onCardFullscreen={handleCardFullscreen}
            />
          )}
        </div>
      </div>

      {/* ════════ Fullscreen Modal (for V1 cards) ════════ */}
      <FullscreenModal isOpen={!!fullscreenCard} onClose={handleCloseFullscreen} title={fullscreenTitle}>
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>{fullscreenContent}</div>
      </FullscreenModal>

      {/* ════════ Layer 5: Diagnostics Drawer ════════ */}
      <CrackDiagnosticsDrawer
        isOpen={drawerOpen}
        pointId={selectedPointId}
        onClose={handleCloseDiagnostics}
      />

      <style>{`
        .cracks-page {
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
        }
        @media (max-width: 768px) {
          .cracks-page { padding: 0; }
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
