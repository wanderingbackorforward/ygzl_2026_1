import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const CrackRateChart: React.FC<CardComponentProps> = () => {
  const { rateData, rateLoading, rateError } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!rateData || rateData.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    return {
      title: { text: 'Average Change Rate', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      grid: { left: '10%', right: '4%', bottom: '12%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: rateData.map(r => r.type), axisLabel: { rotate: 0, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{
        type: 'bar',
        data: rateData.map(r => ({ value: r.rate, itemStyle: { color: NEON_COLORS.secondary } })),
        barWidth: '50%',
        showBackground: true,
        backgroundStyle: { color: 'rgba(0, 229, 255, 0.05)' }
      }],
      animationDuration: 800
    };
  }, [rateData]);
  if (rateError) return <div className="dashboard-card__error">{rateError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={rateLoading} /></div>;
};

export default CrackRateChart;
