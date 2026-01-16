import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const CrackSlopeChart: React.FC<CardComponentProps> = () => {
  const { slopeData, slopeLoading, slopeError } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!slopeData || slopeData.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    const sorted = [...slopeData].sort((a, b) => b.slope - a.slope);
    return {
      title: { text: 'Slope Trend', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      grid: { left: '10%', right: '4%', bottom: '12%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: sorted.map(s => s.point), axisLabel: { rotate: 45, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{
        type: 'bar',
        data: sorted.map(s => ({ value: s.slope, itemStyle: { color: s.slope >= 0 ? NEON_COLORS.purple : NEON_COLORS.warning } })),
        barWidth: '60%',
        showBackground: true,
        backgroundStyle: { color: 'rgba(0, 229, 255, 0.05)' }
      }],
      animationDuration: 800
    };
  }, [slopeData]);
  if (slopeError) return <div className="dashboard-card__error">{slopeError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={slopeLoading} /></div>;
};

export default CrackSlopeChart;
