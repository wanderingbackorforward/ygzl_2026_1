import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from './EChartsWrapper';
import type { PointTimeSeriesData } from '../../types/api';
import type { CardComponentProps } from '../../types/layout';
import { NEON_COLORS } from './cyberpunkTheme';

interface RateChartProps extends CardComponentProps {
  pointId?: string | null;
  data?: PointTimeSeriesData[] | null;
  loading?: boolean;
}

export const RateChart: React.FC<RateChartProps> = ({
  pointId,
  data,
  loading = false,
}) => {
  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: pointId ? `${pointId} - 速率分析` : '请选择监测点',
          subtext: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#888', fontSize: 14 }
        }
      };
    }

    const dates = data.map(item => item.date);
    const dailyRates = data.map(item => item.daily_change);

    // Calculate statistics
    const validRates = dailyRates.filter(r => r !== null && !isNaN(r));
    const avgRate = validRates.length > 0
      ? validRates.reduce((a, b) => a + b, 0) / validRates.length
      : 0;
    const maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;
    const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;

    return {
      title: {
        text: `${pointId} - 沉降速率`,
        left: 'center',
        textStyle: { fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(10, 18, 30, 0.95)',
        borderColor: 'rgba(0, 229, 255, 0.3)',
        formatter: (params: any) => {
          const point = params[0];
          if (!point) return '';
          const value = point.value;
          const status = value > 0.01 ? '上升' : value < -0.01 ? '下沉' : '稳定';
          return `
            <div style="padding: 4px;">
              <div style="margin-bottom: 4px;">${point.axisValue}</div>
              <div>速率: <strong style="color: ${point.color}">${value.toFixed(4)} mm/天</strong></div>
              <div>状态: ${status}</div>
            </div>
          `;
        }
      },
      grid: {
        left: '10%',
        right: '5%',
        bottom: '20%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          fontSize: 10,
          rotate: 30,
          formatter: (value: string) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '速率 (mm/天)',
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10 },
        splitLine: {
          lineStyle: { color: 'rgba(0, 229, 255, 0.1)' }
        }
      },
      visualMap: {
        show: false,
        pieces: [
          { lte: -0.05, color: NEON_COLORS.warning },
          { gt: -0.05, lte: -0.01, color: NEON_COLORS.orange },
          { gt: -0.01, lte: 0.01, color: NEON_COLORS.success },
          { gt: 0.01, lte: 0.05, color: NEON_COLORS.secondary },
          { gt: 0.05, color: NEON_COLORS.purple }
        ]
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', bottom: 5, height: 15, start: 0, end: 100 }
      ],
      series: [{
        name: 'Daily Rate',
        type: 'line',
        data: dailyRates,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 229, 255, 0.25)' },
              { offset: 1, color: 'rgba(0, 229, 255, 0.02)' }
            ]
          }
        },
        markLine: {
          silent: true,
          lineStyle: { type: 'dashed', width: 1 },
          data: [
            {
              yAxis: avgRate,
              label: {
                formatter: `Avg: ${avgRate.toFixed(4)}`,
                fontSize: 10
              },
              lineStyle: { color: NEON_COLORS.primary }
            },
            {
              yAxis: 0,
              label: { show: false },
              lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }
            }
          ]
        },
        markPoint: {
          symbol: 'pin',
          symbolSize: 30,
          data: [
            {
              type: 'max',
              name: 'Max',
              label: { fontSize: 9 },
              itemStyle: { color: maxRate > 0 ? NEON_COLORS.purple : NEON_COLORS.warning }
            },
            {
              type: 'min',
              name: 'Min',
              label: { fontSize: 9 },
              itemStyle: { color: minRate < 0 ? NEON_COLORS.warning : NEON_COLORS.success }
            }
          ]
        }
      }],
      animationDuration: 800
    };
  }, [pointId, data]);

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default RateChart;
