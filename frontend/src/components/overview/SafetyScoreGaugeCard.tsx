import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const SafetyScoreGaugeCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();
  const safetyScore = summary?.safety_score ?? 0;

  const option = useMemo((): EChartsOption => {
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          splitNumber: 5,
          center: ['50%', '70%'],
          radius: '100%',
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [0.6, '#ff4d4f'],
                [0.8, '#faad14'],
                [1, '#00e5ff'],
              ],
            },
          },
          pointer: { length: '50%', width: 4, itemStyle: { color: 'auto' } },
          axisTick: { show: false },
          splitLine: { length: 12, lineStyle: { color: 'auto', width: 2 } },
          axisLabel: { color: '#8ba0b6', fontSize: 10, distance: -40 },
          title: { offsetCenter: [0, '-20%'], fontSize: 18, color: '#fff' },
          detail: {
            fontSize: 36,
            offsetCenter: [0, '0%'],
            valueAnimation: true,
            formatter: '{value}',
            color: '#fff',
            fontFamily: 'Impact',
          },
          data: [{ value: safetyScore, name: '安全评分' }],
        },
      ],
    };
  }, [safetyScore]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default SafetyScoreGaugeCard;

