import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useVibration } from '../../../contexts/VibrationContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const WaveformCrestFactorChart: React.FC<CardComponentProps> = () => {
  const { factors, factorsLoading, factorsError } = useVibration();
  const option = useMemo((): EChartsOption => {
    if (!factors || factors.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    return {
      title: { text: 'Waveform / Crest Factor', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      grid: { left: '10%', right: '4%', bottom: '12%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: factors.map(f => f.name), axisLabel: { rotate: 0, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: factors.map(f => f.value), itemStyle: { color: NEON_COLORS.orange } }],
      animationDuration: 600
    };
  }, [factors]);
  if (factorsError) return <div className="dashboard-card__error">{factorsError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={factorsLoading} /></div>;
};

export default WaveformCrestFactorChart;
