import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useVibration } from '../../../contexts/VibrationContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const FrequencySpectrumChart: React.FC<CardComponentProps> = () => {
  const { spectrum, spectrumLoading, spectrumError } = useVibration();
  const option = useMemo((): EChartsOption => {
    if (!spectrum || spectrum.freq.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    return {
      title: { text: 'Frequency Spectrum', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: '8%', right: '8%', bottom: '16%', top: '16%', containLabel: true },
      xAxis: { type: 'category', data: spectrum.freq.map(f => f.toFixed(2)), axisLabel: { fontSize: 10, rotate: 0 }, name: 'Hz' },
      yAxis: { type: 'value', name: 'Amp', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: spectrum.amp, itemStyle: { color: NEON_COLORS.secondary } }],
      animationDuration: 600
    };
  }, [spectrum]);
  if (spectrumError) return <div className="dashboard-card__error">{spectrumError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={spectrumLoading} /></div>;
};

export default FrequencySpectrumChart;
