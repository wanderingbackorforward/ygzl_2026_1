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

export const TemperatureRangeChart: React.FC<Props> = ({ sensorId, data, loading = false }) => {
  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) {
      return { title: { text: sensorId ? `${sensorId} - Daily Range` : 'Select a sensor', subtext: 'No data available', left: 'center', top: 'center', textStyle: { color: '#888', fontSize: 14 } } };
    }
    const dates = data.map(d => d.measurement_date);
    const ranges = data.map(d => d.temperature_range);
    return {
      title: { text: `${sensorId} - Daily Temperature Range`, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: '10%', right: '5%', bottom: '20%', top: '20%', containLabel: true },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', name: '°C', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      series: [{
        name: 'Range',
        type: 'bar',
        data: ranges.map(v => ({ value: v, itemStyle: { color: NEON_COLORS.orange } })),
        barWidth: '40%'
      }],
      animationDuration: 800
    };
  }, [sensorId, data]);

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default TemperatureRangeChart;
