import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const VibrationOverviewCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  const isNormal = summary?.vibration?.status === 'normal';
  const datasets = summary?.vibration?.total_datasets ?? 0;

  const option = useMemo((): EChartsOption => {
    const color = isNormal ? '#22c55e' : '#ef4444';
    const value = isNormal ? 90 : 30;
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 220,
          endAngle: -40,
          radius: '90%',
          center: ['50%', '55%'],
          min: 0,
          max: 100,
          pointer: { show: false },
          progress: {
            show: true,
            width: 14,
            roundCap: true,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: { width: 14, color: [[1, 'rgba(255,255,255,0.08)']] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            offsetCenter: [0, '10%'],
            fontSize: 22,
            fontWeight: 700,
            color,
            formatter: isNormal ? '正常' : '异常',
          },
          title: {
            offsetCenter: [0, '45%'],
            fontSize: 13,
            color: '#fff',
          },
          data: [{ value, name: `${datasets} 个数据集` }],
        },
      ],
    };
  }, [isNormal, datasets]);

  if (error) return <div className="dashboard-card__error">{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
    </div>
  );
};

export default VibrationOverviewCard;

