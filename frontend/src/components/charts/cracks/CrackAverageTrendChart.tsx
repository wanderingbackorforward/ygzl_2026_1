import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const CrackAverageTrendChart: React.FC<CardComponentProps> = () => {
  const { selectedPointId, trendData, trendLoading } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!trendData || trendData.length === 0) {
      return { title: { text: selectedPointId ? `${selectedPointId} - Trend` : 'Select a point', subtext: 'No data available', left: 'center', top: 'center', textStyle: { color: '#888', fontSize: 14 } } };
    }
    const dates = trendData.map(d => d.measurement_date);
    const values = trendData.map(d => d.value);
    const daily = trendData.map(d => d.daily_change);
    return {
      title: { text: `${selectedPointId} - Average Trend`, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      legend: { data: ['Value', 'Daily Change'], bottom: 5, textStyle: { fontSize: 10 }, itemWidth: 15, itemHeight: 10 },
      grid: { left: '8%', right: '8%', bottom: '18%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: [{ type: 'value', name: 'mm', axisLabel: { fontSize: 10 } }, { type: 'value', name: 'mm/day', axisLabel: { fontSize: 10 } }],
      series: [
        { name: 'Value', type: 'line', data: values, smooth: true, itemStyle: { color: NEON_COLORS.primary }, areaStyle: { color: 'rgba(0, 229, 255, 0.15)' } },
        { name: 'Daily Change', type: 'bar', yAxisIndex: 1, data: daily, itemStyle: { color: NEON_COLORS.orange } }
      ],
      animationDuration: 800
    };
  }, [selectedPointId, trendData]);
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={trendLoading} /></div>;
};

export default CrackAverageTrendChart;
