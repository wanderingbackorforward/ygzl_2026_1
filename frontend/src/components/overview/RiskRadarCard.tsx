import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

function calcTempScore(avgTemp: number | undefined): number {
  if (avgTemp == null) return 50;
  const ideal = 20;
  const maxDev = 25;
  const dev = Math.abs(avgTemp - ideal);
  return Math.max(0, Math.min(100, Math.round(100 - (dev / maxDev) * 100)));
}

function calcVibrationScore(status: string | undefined): number {
  if (!status) return 50;
  return status === 'normal' ? 90 : 30;
}

export const RiskRadarCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  const scores = useMemo(() => {
    const settlement = Math.max(0, Math.min(100, 100 - (summary?.settlement?.alert_count ?? 0) * 10));
    const crack = Math.max(0, Math.min(100, 100 - (summary?.cracks?.expanding_count ?? 0) * 15));
    const temp = calcTempScore(summary?.temperature?.avg_temp);
    const vibration = calcVibrationScore(summary?.vibration?.status);
    return { settlement, crack, temp, vibration };
  }, [summary]);

  const option = useMemo((): EChartsOption => {
    return {
      radar: {
        indicator: [
          { name: '沉降', max: 100 },
          { name: '裂缝', max: 100 },
          { name: '温度', max: 100 },
          { name: '振动', max: 100 },
        ],
        center: ['50%', '48%'],
        radius: '55%',
        axisName: { color: '#00e5ff', fontSize: 13 },
        splitArea: { areaStyle: { color: ['rgba(0,229,255,0.08)', 'rgba(0,0,0,0)'] } },
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.25)' } },
        splitLine: { lineStyle: { color: 'rgba(0,229,255,0.25)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [scores.settlement, scores.crack, scores.temp, scores.vibration],
              name: '各项指标健康度',
              areaStyle: { color: 'rgba(0, 229, 255, 0.35)' },
              itemStyle: { color: '#00e5ff' },
            },
          ],
        },
      ],
    };
  }, [scores]);

  if (error) return <div className="dashboard-card__error">{error}</div>;

  const scoreColor = (v: number) =>
    v >= 80 ? '#22c55e' : v >= 60 ? '#eab308' : v >= 40 ? '#f97316' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px',
        padding: '4px 12px 8px', fontSize: 13,
      }}>
        <div style={{ color: '#fff' }}>
          <span style={{ color: scoreColor(scores.settlement), fontWeight: 700 }}>{scores.settlement}</span>
          {' '}沉降 <span style={{ color: '#94a3b8', fontSize: 11 }}>({summary?.settlement?.alert_count ?? 0}预警)</span>
        </div>
        <div style={{ color: '#fff' }}>
          <span style={{ color: scoreColor(scores.crack), fontWeight: 700 }}>{scores.crack}</span>
          {' '}裂缝 <span style={{ color: '#94a3b8', fontSize: 11 }}>({summary?.cracks?.expanding_count ?? 0}扩展)</span>
        </div>
        <div style={{ color: '#fff' }}>
          <span style={{ color: scoreColor(scores.temp), fontWeight: 700 }}>{scores.temp}</span>
          {' '}温度 <span style={{ color: '#94a3b8', fontSize: 11 }}>({summary?.temperature?.avg_temp?.toFixed(1) ?? '-'}°C)</span>
        </div>
        <div style={{ color: '#fff' }}>
          <span style={{ color: scoreColor(scores.vibration), fontWeight: 700 }}>{scores.vibration}</span>
          {' '}振动 <span style={{ color: '#94a3b8', fontSize: 11 }}>({summary?.vibration?.status === 'normal' ? '正常' : '异常'})</span>
        </div>
      </div>
    </div>
  );
};

export default RiskRadarCard;

