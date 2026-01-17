import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useVibration } from '../../../contexts/VibrationContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const FrequencyMetricsChart: React.FC<CardComponentProps> = () => {
  const { metrics, metricsLoading, metricsError } = useVibration();
  const option = useMemo((): EChartsOption => {
    if (!metrics) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    const names = ['mean', 'std', 'peak', 'rms', 'center_freq', 'crest_factor', 'impulse_factor'];
    const values = [
      metrics.mean,
      metrics.std,
      metrics.peak,
      metrics.rms,
      metrics.center_freq,
      metrics.crest_factor,
      metrics.impulse_factor,
    ];
    return {
      title: { text: 'Frequency Metrics', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      grid: { left: '10%', right: '4%', bottom: '12%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { rotate: 0, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: values, itemStyle: { color: NEON_COLORS.primary } }],
      animationDuration: 600
    };
  }, [metrics]);
  if (metricsError) return <div className="dashboard-card__error">{metricsError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={metricsLoading} /></div>;
};

export default FrequencyMetricsChart;
