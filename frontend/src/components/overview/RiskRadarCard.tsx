import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const RiskRadarCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  const option = useMemo((): EChartsOption => {
    const settlementScore = Math.max(0, 100 - (summary?.settlement?.alert_count ?? 0) * 10);
    const crackScore = Math.max(0, 100 - (summary?.cracks?.expanding_count ?? 0) * 15);
    const tempScore = 80;
    const vibrationScore = summary?.vibration?.total_datasets ? 70 : 50;

    return {
      radar: {
        indicator: [
          { name: '沉降', max: 100 },
          { name: '裂缝', max: 100 },
          { name: '温度', max: 100 },
          { name: '振动', max: 100 },
        ],
        center: ['50%', '52%'],
        radius: '65%',
        axisName: { color: '#00e5ff' },
        splitArea: { areaStyle: { color: ['rgba(0,229,255,0.08)', 'rgba(0,0,0,0)'] } },
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.25)' } },
        splitLine: { lineStyle: { color: 'rgba(0,229,255,0.25)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [settlementScore, crackScore, tempScore, vibrationScore],
              name: '各项指标健康度',
              areaStyle: { color: 'rgba(0, 229, 255, 0.35)' },
              itemStyle: { color: '#00e5ff' },
            },
          ],
        },
      ],
    };
  }, [summary]);

  if (error) return <div className="dashboard-card__error">{error}</div>;
  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default RiskRadarCard;

