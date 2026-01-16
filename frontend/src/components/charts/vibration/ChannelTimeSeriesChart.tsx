import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useVibration } from '../../../contexts/VibrationContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const ChannelTimeSeriesChart: React.FC<CardComponentProps> = () => {
  const { selectedDatasetId, selectedChannelId, timeSeries, timeSeriesLoading, timeSeriesError } = useVibration();
  const option = useMemo((): EChartsOption => {
    if (!timeSeries || !timeSeries.values || timeSeries.values.length === 0) {
      return { title: { text: selectedChannelId ? `${selectedChannelId} - Time Series` : 'Select a channel', subtext: 'No data available', left: 'center', top: 'center', textStyle: { color: '#888', fontSize: 14 } } };
    }
    const x = Array.from({ length: timeSeries.values.length }, (_, i) => i);
    return {
      title: { text: `${selectedDatasetId || ''} - ${selectedChannelId || ''} Time Series`, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: '8%', right: '8%', bottom: '18%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: x, boundaryGap: false, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', name: timeSeries.unit || '', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      series: [{ name: 'Amplitude', type: 'line', data: timeSeries.values, smooth: true, symbol: 'circle', symbolSize: 2, lineStyle: { width: 1.5 }, itemStyle: { color: NEON_COLORS.primary } }],
      animationDuration: 400
    };
  }, [selectedDatasetId, selectedChannelId, timeSeries]);
  if (timeSeriesError) return <div className="dashboard-card__error">{timeSeriesError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={timeSeriesLoading} /></div>;
};

export default ChannelTimeSeriesChart;
