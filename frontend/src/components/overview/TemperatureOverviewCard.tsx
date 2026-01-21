import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const TemperatureOverviewCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  const option = useMemo((): EChartsOption => {
    const minTemp = summary?.temperature?.min_temp ?? 0;
    const avgTemp = summary?.temperature?.avg_temp ?? 0;
    const maxTemp = summary?.temperature?.max_temp ?? 0;

    return {
      tooltip: { trigger: 'axis' },
      grid: { top: 30, right: 12, bottom: 20, left: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['最低', '平均', '最高'],
        axisLabel: { color: '#8ba0b6' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#8ba0b6', formatter: '{value}°' },
      },
      series: [
        {
          name: '温度(°C)',
          type: 'bar',
          data: [minTemp, avgTemp, maxTemp],
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              const colors = ['#52c41a', '#faad14', '#ff4d4f'];
              return colors[params.dataIndex];
            },
          },
        },
      ],
    };
  }, [summary]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div className="stats-panel">
        <div className="stat-item">
          <div className="stat-item__label">传感器</div>
          <div className="stat-item__value">{summary?.temperature?.total_sensors ?? 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__label">平均(°C)</div>
          <div className="stat-item__value">{summary?.temperature?.avg_temp ?? 0}</div>
        </div>
      </div>
      <div className="dashboard-card__chart" style={{ minHeight: 180 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
    </div>
  );
};

export default TemperatureOverviewCard;

