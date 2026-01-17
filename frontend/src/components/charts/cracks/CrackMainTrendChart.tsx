import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const CrackMainTrendChart: React.FC<CardComponentProps> = () => {
  const { selectedPointId, trendData, trendLoading } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!trendData || trendData.length === 0) {
      return { title: { text: selectedPointId ? `${selectedPointId} - Trend` : 'Select a point', subtext: 'No data available', left: 'center', top: 'center', textStyle: { color: '#888', fontSize: 14 } } };
    }
    const dates = trendData.map(d => d.measurement_date);
    const values = trendData.map(d => d.value);
    return {
      title: { text: `${selectedPointId} - Trend Analysis`, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: '8%', right: '8%', bottom: '18%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', name: 'mm', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      series: [{ name: 'Value', type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2 }, itemStyle: { color: NEON_COLORS.primary } }],
      animationDuration: 800
    };
  }, [selectedPointId, trendData]);
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={trendLoading} /></div>;
};

export default CrackMainTrendChart;
