import React, { useState, useCallback, useMemo } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { SettlementProvider, useSettlement } from '../contexts/SettlementContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { FullscreenModal } from '../components/layout/FullscreenModal';
import { TrendChart } from '../components/charts/TrendChart';
import { DistributionChart } from '../components/charts/DistributionChart';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { RateChart } from '../components/charts/RateChart';
import { TrendPredictionChart } from '../components/charts/TrendPredictionChart';
import { PointSelector } from '../components/shared/PointSelector';
import { PointDetails } from '../components/shared/PointDetails';
import { RiskAlertCard } from '../components/shared/RiskAlertCard';
import { SecondaryDataTab } from '../components/analysis-v2';
import { API_BASE } from '../lib/api';
import type { CardConfig } from '../types/layout';
import type { AnomalyItem } from '../types/analysis-v2';

import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

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

const TrendPredictionChartCard: React.FC = () => {
  const { selectedPointId } = useSettlement();
  return <TrendPredictionChart cardId="trend-prediction" pointId={selectedPointId} />;
};

const RiskAlertCardWrapper: React.FC = () => {
  const { selectPoint } = useSettlement();
  return <RiskAlertCard cardId="risk-alerts" onSelectPoint={selectPoint} />;
};

const SecondaryAnalysisCard: React.FC = () => {
  const { selectPoint } = useSettlement();
  const [creating, setCreating] = useState(false);

  const handleCreateTicket = useCallback(async (anomaly: AnomalyItem) => {
    if (creating) return;

    const confirmCreate = window.confirm(
      `确认为以下异常创建工单?\n\n监测点: ${anomaly.point_id}\n异常: ${anomaly.title}\n严重程度: ${anomaly.severity}`
    );

    if (!confirmCreate) return;

    const sendEmail = window.confirm('创建工单同时发送邮件通知？\n确定=发送邮件；取消=不发邮件但仍创建工单');

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/analysis/v2/settlement/create-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomaly_id: anomaly.id,
          point_id: anomaly.point_id,
          title: anomaly.title,
          description: anomaly.description,
          severity: anomaly.severity,
          anomaly_type: anomaly.anomaly_type,
          current_value: anomaly.current_value,
          threshold: anomaly.threshold,
          send_email: sendEmail,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`工单创建成功!\n\n工单号: ${result.data?.ticket_number || 'N/A'}\n监测点: ${anomaly.point_id}`);
      } else {
        alert(`工单创建失败: ${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Create ticket error:', error);
      alert(`工单创建失败: ${error instanceof Error ? error.message : '网络错误'}`);
    } finally {
      setCreating(false);
    }
  }, [creating]);

  return (
    <SecondaryDataTab
      onSelectPoint={selectPoint}
      onCreateTicket={handleCreateTicket}
    />
  );
};

const SETTLEMENT_CARDS: CardConfig[] = [
  { id: 'secondary-analysis', title: '二级分析', icon: 'fas fa-microscope', component: SecondaryAnalysisCard, defaultLayout: { x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 } },
  { id: 'point-selector', title: '监测点选择', icon: 'fas fa-map-marker-alt', component: PointSelectorCard, defaultLayout: { x: 0, y: 6, w: 12, h: 2, minW: 6, minH: 2 } },
  { id: 'trend-chart', title: '趋势分析', icon: 'fas fa-chart-bar', component: TrendChart, defaultLayout: { x: 0, y: 8, w: 7, h: 4, minW: 4, minH: 3 } },
  { id: 'point-details', title: '监测点详情', icon: 'fas fa-info-circle', component: PointDetailsCard, defaultLayout: { x: 7, y: 8, w: 5, h: 2, minW: 3, minH: 2 } },
  { id: 'risk-alerts', title: '风险预警', icon: 'fas fa-exclamation-triangle', component: RiskAlertCardWrapper, defaultLayout: { x: 7, y: 10, w: 5, h: 2, minW: 3, minH: 2 } },
  { id: 'trend-prediction', title: '趋势预测', icon: 'fas fa-crystal-ball', component: TrendPredictionChartCard, defaultLayout: { x: 0, y: 12, w: 12, h: 5, minW: 6, minH: 4 } },
  { id: 'distribution', title: '趋势类型分布', icon: 'fas fa-chart-pie', component: DistributionChart, defaultLayout: { x: 0, y: 17, w: 6, h: 5, minW: 4, minH: 3 } },
  { id: 'time-series', title: '时间序列', icon: 'fas fa-chart-line', component: TimeSeriesChartCard, defaultLayout: { x: 6, y: 17, w: 6, h: 5, minW: 4, minH: 3 } },
  { id: 'rate-chart', title: '沉降速率', icon: 'fas fa-tachometer-alt', component: RateChartCard, defaultLayout: { x: 0, y: 22, w: 12, h: 4, minW: 6, minH: 3 } },
];

const SettlementDashboard: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);

  const handleCardFullscreen = useCallback((cardId: string) => {
    setFullscreenCard(cardId);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenCard(null);
  }, []);

  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;
    const card = SETTLEMENT_CARDS.find(c => c.id === fullscreenCard);
    if (!card) return null;
    const CardComponent = card.component;
    return <CardComponent cardId={`${fullscreenCard}-fullscreen`} {...card.props} />;
  }, [fullscreenCard]);

  const fullscreenTitle = useMemo(() => {
    const card = SETTLEMENT_CARDS.find(c => c.id === fullscreenCard);
    return card?.title || '';
  }, [fullscreenCard]);

  return (
    <div className="settlement-page">
      <DashboardGrid pageId="settlement-v2" cards={SETTLEMENT_CARDS} onCardFullscreen={handleCardFullscreen} />

      <FullscreenModal isOpen={!!fullscreenCard} onClose={handleCloseFullscreen} title={fullscreenTitle}>
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>{fullscreenContent}</div>
      </FullscreenModal>

      <style>{`
        .settlement-page {
          height: 100%;
          padding: 16px;
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
          overflow: auto;
        }
        @media (max-width: 768px) {
          .settlement-page {
            height: 100%;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default function SettlementNew() {
  return (
    <LayoutProvider>
      <SettlementProvider>
        <SettlementDashboard />
      </SettlementProvider>
    </LayoutProvider>
  );
}
