import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';
import { NEON_COLORS } from '../charts/cyberpunkTheme';

export const SettlementOverviewCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();
  const trendDist = summary?.settlement?.trend_distribution ?? {};

  const option = useMemo((): EChartsOption => {
    const labels = Object.keys(trendDist);
    const values = Object.values(trendDist) as number[];
    const safeLabels = labels.length ? labels : ['上升', '下降', '稳定'];
    const safeValues = values.length ? values : [0, 0, 0];

    return {
      tooltip: { trigger: 'axis' },
      grid: { top: 30, right: 12, bottom: 20, left: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: safeLabels,
        axisLabel: { color: '#8ba0b6' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#8ba0b6' },
      },
      series: [
        {
          name: '监测点数',
          type: 'bar',
          data: safeValues,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: NEON_COLORS.primary },
              { offset: 1, color: NEON_COLORS.secondary },
            ]),
          },
        },
      ],
    };
  }, [trendDist]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div className="stats-panel">
        <div className="stat-item">
          <div className="stat-item__label">监测点</div>
          <div className="stat-item__value">{summary?.settlement?.total_points ?? 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__label">预警</div>
          <div className="stat-item__value stat-item__value--warning">{summary?.settlement?.alert_count ?? 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__label">最大值(mm)</div>
          <div className="stat-item__value stat-item__value--warning">{summary?.settlement?.max_value ?? 0}</div>
        </div>
      </div>
      <div className="dashboard-card__chart" style={{ minHeight: 180 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
    </div>
  );
};

export default SettlementOverviewCard;

