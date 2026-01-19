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
    return {
      title: { text: `${sensorId} - 温度时间序列`, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      legend: { data: ['平均温度', '最低温度', '最高温度'], bottom: 5, textStyle: { fontSize: 10 }, itemWidth: 15, itemHeight: 10 },
      grid: { left: '8%', right: '8%', bottom: '18%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', name: '°C', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', bottom: 25, height: 15, start: 0, end: 100 }],
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
