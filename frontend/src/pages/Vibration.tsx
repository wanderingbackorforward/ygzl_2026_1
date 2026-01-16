import React, { useState, useCallback, useMemo } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { VibrationProvider, useVibration } from '../contexts/VibrationContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { FullscreenModal } from '../components/layout/FullscreenModal';
import { PointSelector } from '../components/shared/PointSelector';
import { ChannelDetails } from '../components/shared/ChannelDetails';
import { ChannelTimeSeriesChart } from '../components/charts/vibration/ChannelTimeSeriesChart';
import { FrequencySpectrumChart } from '../components/charts/vibration/FrequencySpectrumChart';
import { FrequencyMetricsChart } from '../components/charts/vibration/FrequencyMetricsChart';
import { WaveformCrestFactorChart } from '../components/charts/vibration/WaveformCrestFactorChart';
import { PulseGapFactorChart } from '../components/charts/vibration/PulseGapFactorChart';
import { FeatureRadarChart } from '../components/charts/vibration/FeatureRadarChart';
import type { CardConfig } from '../types/layout';
import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

const DatasetSelectorCard: React.FC = () => {
  const { datasets, datasetsLoading, selectedDatasetId, selectDataset } = useVibration();
  return (
    <PointSelector
      cardId="dataset-selector"
      points={datasets}
      selectedPoint={selectedDatasetId}
      onSelectPoint={(id) => selectDataset(id)}
      loading={datasetsLoading}
    />
  );
};

const ChannelSelectorCard: React.FC = () => {
  const { channels, channelsLoading, selectedChannelId, selectChannel } = useVibration();
  return (
    <PointSelector
      cardId="channel-selector"
      points={channels.map(c => c.channel_id)}
      selectedPoint={selectedChannelId}
      onSelectPoint={(id) => selectChannel(id)}
      loading={channelsLoading}
    />
  );
};

const VIBRATION_CARDS: CardConfig[] = [
  { id: 'dataset-selector', title: '数据集选择', icon: 'fas fa-database', component: DatasetSelectorCard, defaultLayout: { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 } },
  { id: 'channel-selector', title: '通道选择', icon: 'fas fa-wave-square', component: ChannelSelectorCard, defaultLayout: { x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 } },
  { id: 'channel-details', title: '通道详情', icon: 'fas fa-info-circle', component: ChannelDetails, defaultLayout: { x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 } },
  { id: 'channel-time-series', title: '时间序列', icon: 'fas fa-chart-line', component: ChannelTimeSeriesChart, defaultLayout: { x: 9, y: 0, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'frequency-spectrum', title: '频谱', icon: 'fas fa-chart-bar', component: FrequencySpectrumChart, defaultLayout: { x: 0, y: 3, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'frequency-metrics', title: '频率指标', icon: 'fas fa-sliders-h', component: FrequencyMetricsChart, defaultLayout: { x: 6, y: 3, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'waveform-crest', title: '波形/峰值因子', icon: 'fas fa-chart-bar', component: WaveformCrestFactorChart, defaultLayout: { x: 0, y: 7, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'pulse-gap', title: '脉冲/间隙因子', icon: 'fas fa-chart-bar', component: PulseGapFactorChart, defaultLayout: { x: 6, y: 7, w: 6, h: 4, minW: 4, minH: 3 } },
  { id: 'feature-radar', title: '特征雷达图', icon: 'fas fa-bullseye', component: FeatureRadarChart, defaultLayout: { x: 0, y: 11, w: 12, h: 4, minW: 6, minH: 3 } },
];

const VibrationDashboard: React.FC = () => {
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const handleCardFullscreen = useCallback((cardId: string) => setFullscreenCard(cardId), []);
  const handleCloseFullscreen = useCallback(() => setFullscreenCard(null), []);
  const fullscreenContent = useMemo(() => {
    if (!fullscreenCard) return null;
    switch (fullscreenCard) {
      case 'dataset-selector': return <DatasetSelectorCard />;
      case 'channel-selector': return <ChannelSelectorCard />;
      case 'channel-details': return <ChannelDetails cardId="channel-details-fullscreen" />;
      case 'channel-time-series': return <ChannelTimeSeriesChart cardId="channel-time-series-fullscreen" />;
      case 'frequency-spectrum': return <FrequencySpectrumChart cardId="frequency-spectrum-fullscreen" />;
      case 'frequency-metrics': return <FrequencyMetricsChart cardId="frequency-metrics-fullscreen" />;
      case 'waveform-crest': return <WaveformCrestFactorChart cardId="waveform-crest-fullscreen" />;
      case 'pulse-gap': return <PulseGapFactorChart cardId="pulse-gap-fullscreen" />;
      case 'feature-radar': return <FeatureRadarChart cardId="feature-radar-fullscreen" />;
      default: return null;
    }
  }, [fullscreenCard]);
  const fullscreenTitle = useMemo(() => VIBRATION_CARDS.find(c => c.id === fullscreenCard)?.title || '', [fullscreenCard]);
  return (
    <div className="vibration-page">
      <DashboardGrid pageId="vibration" cards={VIBRATION_CARDS} onCardFullscreen={handleCardFullscreen} />
      <FullscreenModal isOpen={!!fullscreenCard} onClose={handleCloseFullscreen} title={fullscreenTitle}>
        <div style={{ width: '100%', height: '100%', minHeight: 400 }}>{fullscreenContent}</div>
      </FullscreenModal>
      <style>{`
        .vibration-page {
          height: calc(100vh - 64px);
          padding: 16px;
          background: radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%);
          overflow: auto;
        }
        @media (max-width: 768px) {
          .vibration-page {
            height: auto;
            min-height: calc(100vh - 64px);
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default function Vibration() {
  return (
    <LayoutProvider>
      <VibrationProvider>
        <VibrationDashboard />
      </VibrationProvider>
    </LayoutProvider>
  );
}
