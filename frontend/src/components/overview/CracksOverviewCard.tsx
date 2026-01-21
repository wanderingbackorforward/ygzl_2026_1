import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const CracksOverviewCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  const option = useMemo((): EChartsOption => {
    const expanding = summary?.cracks?.expanding_count ?? 0;
    const shrinking = summary?.cracks?.shrinking_count ?? 0;
    const stable = summary?.cracks?.stable_count ?? 0;

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { top: 0, left: 'center' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '60%'],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 600 } },
          labelLine: { show: false },
          data: [
            { value: stable, name: '稳定', itemStyle: { color: '#52c41a' } },
            { value: expanding, name: '扩展', itemStyle: { color: '#ff4d4f' } },
            { value: shrinking, name: '收缩', itemStyle: { color: '#00e5ff' } },
          ],
        },
      ],
    };
  }, [summary]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div className="stats-panel">
        <div className="stat-item">
          <div className="stat-item__label">监测点</div>
          <div className="stat-item__value">{summary?.cracks?.total_points ?? 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__label">扩展</div>
          <div className="stat-item__value stat-item__value--warning">{summary?.cracks?.expanding_count ?? 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__label">稳定</div>
          <div className="stat-item__value stat-item__value--success">{summary?.cracks?.stable_count ?? 0}</div>
        </div>
      </div>
      <div className="dashboard-card__chart" style={{ minHeight: 180 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
    </div>
  );
};

export default CracksOverviewCard;

