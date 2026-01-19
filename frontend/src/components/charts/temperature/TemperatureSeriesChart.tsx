import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import type { TemperatureDataPoint } from '../../../types/api';
import type { CardComponentProps } from '../../../types/layout';
import { NEON_COLORS } from '../../charts/cyberpunkTheme';

interface Props extends CardComponentProps {
  sensorId?: string | null;
  data?: TemperatureDataPoint[] | null;
  loading?: boolean;
}

export const TemperatureSeriesChart: React.FC<Props> = ({ sensorId, data, loading = false }) => {
  const option = useMemo((): EChartsOption => {
    const arr = Array.isArray(data) ? data : [];
    const validData = arr.filter(d =>
      d &&
      Boolean(d.measurement_date) &&
      (d.avg_temperature as any) != null &&
      (d.min_temperature as any) != null &&
      (d.max_temperature as any) != null
    );
    if (validData.length === 0) {
      return {
        title: { text: sensorId ? `${sensorId} - 温度时间序列` : '请选择传感器', subtext: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#888', fontSize: 14 } }
      };
    }
    const dates = validData.map(d => d.measurement_date);
    const avg = validData.map(d => d.avg_temperature as any);
    const min = validData.map(d => d.min_temperature as any);
    const max = validData.map(d => d.max_temperature as any);

    const allValues = [...avg, ...min, ...max].filter(v => typeof v === 'number' && Number.isFinite(v)) as number[];
    const minVal = allValues.length ? Math.min(...allValues) : 0;
    const maxVal = allValues.length ? Math.max(...allValues) : 0;
    const span = Math.max(0, maxVal - minVal);
    const pad = span > 0 ? span * 0.12 : 0.5;

    return {
      title: { text: sensorId ? `${sensorId} - 温度时间序列` : '温度时间序列', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['平均温度', '最低温度', '最高温度'],
        top: 'bottom',
        type: 'scroll',
        textStyle: { fontSize: 10 },
      },
      grid: { left: '8%', right: '8%', bottom: '25%', top: '18%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: { fontSize: 10, rotate: 45, hideOverlap: true },
        splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value',
        name: '温度 (°C)',
        scale: true,
        min: Number.isFinite(minVal - pad) ? minVal - pad : undefined,
        max: Number.isFinite(maxVal + pad) ? maxVal + pad : undefined,
        axisLabel: { fontSize: 10, formatter: (v: any) => `${v}°C` },
        splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100, filterMode: 'filter' },
        { type: 'slider', bottom: 18, height: 16, start: 0, end: 100, filterMode: 'filter' },
      ],
      series: [
        { name: '平均温度', type: 'line', data: avg, smooth: true, connectNulls: false, lineStyle: { width: 3, color: NEON_COLORS.primary }, itemStyle: { color: NEON_COLORS.primary }, emphasis: { focus: 'series' } },
        { name: '最低温度', type: 'line', data: min, smooth: true, connectNulls: false, lineStyle: { width: 2, color: NEON_COLORS.success }, itemStyle: { color: NEON_COLORS.success }, emphasis: { focus: 'series' } },
        { name: '最高温度', type: 'line', data: max, smooth: true, connectNulls: false, lineStyle: { width: 2, color: NEON_COLORS.purple }, itemStyle: { color: NEON_COLORS.purple }, emphasis: { focus: 'series' } },
      ],
      animationDuration: 800
    };
  }, [sensorId, data]);

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default TemperatureSeriesChart;
