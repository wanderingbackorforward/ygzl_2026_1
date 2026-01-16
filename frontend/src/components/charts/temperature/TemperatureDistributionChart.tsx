import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useTemperatureSummary } from '../../../hooks/useTemperatureData';
import type { CardComponentProps } from '../../../types/layout';

export const TemperatureDistributionChart: React.FC<CardComponentProps> = () => {
  const { data, loading, error } = useTemperatureSummary();

  const option = useMemo((): EChartsOption => {
    if (!data) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    const seriesData = [
      { name: 'Avg', value: data.avg_temp },
      { name: 'Min', value: data.min_temp },
      { name: 'Max', value: data.max_temp },
    ];
    return {
      title: { text: 'Temperature Summary', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '55%'],
        label: { show: false },
        labelLine: { show: false },
        data: seriesData
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

export default TemperatureDistributionChart;
