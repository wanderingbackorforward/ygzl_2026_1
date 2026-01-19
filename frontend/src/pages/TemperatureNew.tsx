import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { TemperatureProvider, useTemperature } from '../contexts/TemperatureContext';
import { useLayout } from '../contexts/LayoutContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { FullscreenModal } from '../components/layout/FullscreenModal';
import { TemperatureTrendChart } from '../components/charts/temperature/TemperatureTrendChart';
import { TemperatureDistributionChart } from '../components/charts/temperature/TemperatureDistributionChart';
import { TemperatureSeriesChart } from '../components/charts/temperature/TemperatureSeriesChart';
import { TemperatureRangeChart } from '../components/charts/temperature/TemperatureRangeChart';
import { PointSelector } from '../components/shared/PointSelector';
import { SensorDetails } from '../components/shared/SensorDetails';
import { TemperatureSecondaryDataTab } from '../components/analysis-v2';
import { API_BASE } from '../lib/api';
import type { CardConfig } from '../types/layout';
import type { AnomalyItem } from '../types/analysis-v2';
import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

const SensorSelectorCard: React.FC = () => {
  const { sensors, sensorsLoading, selectedSensorId, selectSensor } = useTemperature();
  return (
    <PointSelector
      cardId="sensor-selector"
      points={sensors}
      selectedPoint={selectedSensorId}
      onSelectPoint={(id) => selectSensor(id)}
      loading={sensorsLoading}
    />
  );
};

const SensorDetailsCard: React.FC = () => {
  const { selectedSensorId, analysisData, analysisLoading } = useTemperature();
  return <SensorDetails cardId="sensor-details" sensorId={selectedSensorId} analysis={analysisData} loading={analysisLoading} />;
};

const TemperatureSeriesChartCard: React.FC = () => {
  const { selectedSensorId, seriesData, seriesLoading } = useTemperature();
  return <TemperatureSeriesChart cardId="temperature-series" sensorId={selectedSensorId} data={seriesData || null} loading={seriesLoading} />;
};

const TemperatureRangeChartCard: React.FC = () => {
  const { selectedSensorId, rangeData, rangeLoading } = useTemperature();
  return <TemperatureRangeChart cardId="temperature-range" sensorId={selectedSensorId} data={rangeData || null} loading={rangeLoading} />;
};

const TemperatureSecondaryAnalysisCard: React.FC = () => {
  const { selectSensor } = useTemperature();
  const [creating, setCreating] = useState(false);

  const handleCreateTicket = useCallback(async (anomaly: AnomalyItem) => {
    if (creating) return;

    const confirmCreate = window.confirm(
      `确认为以下异常创建工单?\n\n传感器: ${anomaly.point_id}\n异常: ${anomaly.title}\n严重程度: ${anomaly.severity}`
    );

    if (!confirmCreate) return;

    const sendEmail = window.confirm('创建工单同时发送邮件通知？\n确定=发送邮件；取消=不发邮件但仍创建工单');

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/analysis/v2/temperature/create-ticket`, {
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
        alert(`工单创建成功!\n\n工单号: ${result.data?.ticket_number || 'N/A'}\n传感器: ${anomaly.point_id}`);
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
    <TemperatureSecondaryDataTab
      onSelectPoint={selectSensor}
      onCreateTicket={handleCreateTicket}
    />
  );
};

const TEMPERATURE_CARDS: CardConfig[] = [
  {
    id: 'secondary-analysis',
    title: '二级分析',
    icon: 'fas fa-microscope',
    component: TemperatureSecondaryAnalysisCard,
    defaultLayout: { x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
    defaultLayouts: {
      md: { x: 0, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
    },
  },
  {
    id: 'sensor-selector',
    title: '传感器选择',
    icon: 'fas fa-thermometer-half',
    component: SensorSelectorCard,
    defaultLayout: { x: 0, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
    defaultLayouts: {
      md: { x: 0, y: 6, w: 3, h: 4, minW: 3, minH: 3 },
    },
  },
  {
    id: 'sensor-details',
    title: '传感器详情',
    icon: 'fas fa-info-circle',
    component: SensorDetailsCard,
    defaultLayout: { x: 4, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
    defaultLayouts: {
      md: { x: 3, y: 6, w: 3, h: 4, minW: 3, minH: 3 },
    },
  },
  {
    id: 'temperature-series',
    title: '温度时间序列',
    icon: 'fas fa-chart-line',
    component: TemperatureSeriesChartCard,
    defaultLayout: { x: 8, y: 6, w: 4, h: 4, minW: 4, minH: 3 },
    defaultLayouts: {
      md: { x: 6, y: 6, w: 4, h: 4, minW: 4, minH: 3 },
    },
  },
  {
    id: 'temperature-trend',
    title: '温度趋势分布',
    icon: 'fas fa-chart-bar',
    component: TemperatureTrendChart,
    defaultLayout: { x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    defaultLayouts: {
      md: { x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    },
  },
  {
    id: 'temperature-distribution',
    title: '温度汇总',
    icon: 'fas fa-chart-pie',
    component: TemperatureDistributionChart,
    defaultLayout: { x: 4, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    defaultLayouts: {
      md: { x: 4, y: 10, w: 3, h: 4, minW: 3, minH: 3 },
    },
  },
  {
    id: 'temperature-range',
    title: '日温差',
    icon: 'fas fa-temperature-high',
    component: TemperatureRangeChartCard,
    defaultLayout: { x: 8, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    defaultLayouts: {
      md: { x: 7, y: 10, w: 3, h: 4, minW: 3, minH: 3 },
    },
  },
];

const TemperatureDashboard: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const { resetLayout } = useLayout();

  useEffect(() => {
    const key = 'layoutVersion:temperature';
    const current = '2';
    const prev = localStorage.getItem(key);
    if (prev !== current) {
      resetLayout('temperature');
      localStorage.setItem(key, current);
    }
  }, [resetLayout]);

  const handleCardFullscreen = useCallback((cardId: string) => {
    setFullscreenCard(cardId);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenCard(null);
  }, []);

  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;
    const card = TEMPERATURE_CARDS.find(c => c.id === fullscreenCard);
    if (!card) return null;
    const CardComponent = card.component;
    return <CardComponent cardId={`${fullscreenCard}-fullscreen`} {...card.props} />;
  }, [fullscreenCard]);

  const fullscreenTitle = useMemo(() => {
    const card = TEMPERATURE_CARDS.find(c => c.id === fullscreenCard);
    return card?.title || '';
  }, [fullscreenCard]);

  return (
    <div className="temperature-page">
      <DashboardGrid pageId="temperature" cards={TEMPERATURE_CARDS} onCardFullscreen={handleCardFullscreen} />
      <FullscreenModal isOpen={!!fullscreenCard} onClose={handleCloseFullscreen} title={fullscreenTitle}>
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>{fullscreenContent}</div>
      </FullscreenModal>
      <style>{`
        .temperature-page {
          height: 100%;
          padding: 16px;
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
          overflow: auto;
        }
        @media (max-width: 768px) {
          .temperature-page {
            height: 100%;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default function TemperatureNew() {
  return (
    <LayoutProvider>
      <TemperatureProvider>
        <TemperatureDashboard />
      </TemperatureProvider>
    </LayoutProvider>
  );
}
