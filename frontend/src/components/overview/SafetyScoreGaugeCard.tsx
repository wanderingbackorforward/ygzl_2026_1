import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const SafetyScoreGaugeCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();
  const safetyScore = summary?.safety_score ?? 0;

  const grade = useMemo(() => {
    if (safetyScore >= 90) return { text: '优秀', color: '#22c55e' };
    if (safetyScore >= 80) return { text: '良好', color: '#00e5ff' };
    if (safetyScore >= 60) return { text: '一般', color: '#eab308' };
    if (safetyScore >= 40) return { text: '较差', color: '#f97316' };
    return { text: '危险', color: '#ef4444' };
  }, [safetyScore]);

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
          center: ['50%', '68%'],
          radius: '100%',
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [0.4, '#ef4444'],
                [0.6, '#f97316'],
                [0.8, '#eab308'],
                [1, '#22c55e'],
              ],
            },
          },
          pointer: { length: '50%', width: 4, itemStyle: { color: 'auto' } },
          axisTick: { show: false },
          splitLine: { length: 12, lineStyle: { color: 'auto', width: 2 } },
          axisLabel: { color: '#fff', fontSize: 10, distance: -40 },
          title: { show: false },
          detail: {
            fontSize: 32,
            offsetCenter: [0, '-5%'],
            valueAnimation: true,
            formatter: '{value}',
            color: '#fff',
            fontWeight: 700,
          },
          data: [{ value: safetyScore }],
        },
      ],
    };
  }, [safetyScore]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
      <div style={{ textAlign: 'center', padding: '0 8px 8px', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: grade.color }}>{grade.text}</div>
        <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 2 }}>
          综合沉降、裂缝、温度、振动数据计算
        </div>
      </div>
    </div>
  );
};

export default SafetyScoreGaugeCard;

