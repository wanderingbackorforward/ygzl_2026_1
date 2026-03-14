import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../charts/EChartsWrapper';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const TemperatureOverviewCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  const temp = summary?.temperature;
  const minT = temp?.min_temp ?? 0;
  const avgT = temp?.avg_temp ?? 0;
  const maxT = temp?.max_temp ?? 0;
  const dist = temp?.trend_distribution ?? {};
  const hasDist = Object.keys(dist).length > 0;

  const option = useMemo((): EChartsOption => {
    if (hasDist) {
      const nameMap: Record<string, string> = {
        rising: '升温', falling: '降温', stable: '稳定',
      };
      const colorMap: Record<string, string> = {
        rising: '#ef4444', falling: '#3b82f6', stable: '#22c55e',
      };
      const data = Object.entries(dist).map(([k, v]) => ({
        name: nameMap[k] || k,
        value: v as number,
        itemStyle: { color: colorMap[k] || '#00e5ff' },
      }));
      return {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { color: '#fff', fontSize: 12 } },
        series: [{
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '42%'],
          label: { show: false },
          data,
        }],
      };
    }
    return {
      tooltip: { trigger: 'axis' },
      grid: { top: 20, right: 12, bottom: 20, left: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['最低', '平均', '最高'],
        axisLabel: { color: '#fff' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#fff', formatter: '{value}' },
      },
      series: [{
        type: 'bar',
        data: [
          { value: minT, itemStyle: { color: '#3b82f6' } },
          { value: avgT, itemStyle: { color: '#eab308' } },
          { value: maxT, itemStyle: { color: '#ef4444' } },
        ],
      }],
    };
  }, [hasDist, dist, minT, avgT, maxT]);

  if (error) return <div className="dashboard-card__error">{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 4, padding: '6px 10px', flexShrink: 0,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>传感器</div>
          <div style={{ color: '#00e5ff', fontSize: 18, fontWeight: 700 }}>{temp?.total_sensors ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>最低</div>
          <div style={{ color: '#3b82f6', fontSize: 18, fontWeight: 700 }}>{minT.toFixed(1)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>均温</div>
          <div style={{ color: '#eab308', fontSize: 18, fontWeight: 700 }}>{avgT.toFixed(1)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 12 }}>最高</div>
          <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 700 }}>{maxT.toFixed(1)}</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChartsWrapper option={option} loading={loading} />
      </div>
    </div>
  );
};

export default TemperatureOverviewCard;

