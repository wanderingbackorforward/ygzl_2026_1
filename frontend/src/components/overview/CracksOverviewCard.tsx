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

  const critical = summary?.cracks?.critical_count ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 4, padding: '6px 10px', flexShrink: 0,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>监测点</div>
          <div style={{ color: '#00e5ff', fontSize: 18, fontWeight: 700 }}>{summary?.cracks?.total_points ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>严重</div>
          <div style={{ color: critical > 0 ? '#ef4444' : '#22c55e', fontSize: 18, fontWeight: 700 }}>{critical}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>扩展</div>
          <div style={{ color: '#f97316', fontSize: 18, fontWeight: 700 }}>{summary?.cracks?.expanding_count ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>稳定</div>
          <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 700 }}>{summary?.cracks?.stable_count ?? 0}</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
    </div>
  );
};

export default CracksOverviewCard;

