import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const CrackDailyHistogramChart: React.FC<CardComponentProps> = () => {
  const { dailyHistogram, dailyHistogramLoading, dailyHistogramError } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!dailyHistogram || dailyHistogram.counts.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    return {
      title: { text: 'Daily Change Histogram', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '10%', right: '5%', bottom: '16%', top: '16%', containLabel: true },
      xAxis: { type: 'category', data: dailyHistogram.bins.map(b => b.toFixed(2)), axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: dailyHistogram.counts, itemStyle: { color: NEON_COLORS.secondary } }],
      animationDuration: 800
    };
  }, [dailyHistogram]);
  if (dailyHistogramError) return <div className="dashboard-card__error">{dailyHistogramError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={dailyHistogramLoading} /></div>;
};

export default CrackDailyHistogramChart;
