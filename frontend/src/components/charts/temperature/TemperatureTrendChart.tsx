import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useTemperatureTrends } from '../../../hooks/useTemperatureData';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

export const TemperatureTrendChart: React.FC<CardComponentProps> = () => {
  const { data, loading, error } = useTemperatureTrends();

  const option = useMemo((): EChartsOption => {
    if (!data || data.values.length === 0) {
      return { title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    return {
      title: { text: '温度趋势分布', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      grid: { left: '10%', right: '4%', bottom: '12%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: 45, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{
        type: 'bar',
        data: data.values.map(v => ({ value: v, itemStyle: { color: NEON_COLORS.primary } })),
        barWidth: '60%',
        showBackground: true,
        backgroundStyle: { color: 'rgba(0, 229, 255, 0.05)' }
      }],
      animationDuration: 800
    };
  }, [data]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default TemperatureTrendChart;
