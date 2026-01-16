import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';

export const CrackCorrelationHeatmap: React.FC<CardComponentProps> = () => {
  const { correlation, correlationLoading, correlationError } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!correlation || correlation.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    const size = correlation.length;
    const data = [];
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        data.push([i, j, Number(correlation[i][j].toFixed(2))]);
      }
    }
    return {
      title: { text: 'Correlation Heatmap', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { position: 'top' },
      grid: { left: '10%', right: '5%', bottom: '12%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: Array.from({ length: size }, (_, i) => `P${i + 1}`), axisLabel: { fontSize: 10 } },
      yAxis: { type: 'category', data: Array.from({ length: size }, (_, i) => `P${i + 1}`), axisLabel: { fontSize: 10 } },
      visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
      series: [{ name: 'corr', type: 'heatmap', data, emphasis: { itemStyle: { shadowBlur: 10 } } }],
      animationDuration: 800
    };
  }, [correlation]);
  if (correlationError) return <div className="dashboard-card__error">{correlationError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={correlationLoading} /></div>;
};

export default CrackCorrelationHeatmap;
