import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from './EChartsWrapper';
import type { PointTimeSeriesData } from '../../types/api';
import type { CardComponentProps } from '../../types/layout';
import { NEON_COLORS } from './cyberpunkTheme';

interface TimeSeriesChartProps extends CardComponentProps {
  pointId?: string | null;
  data?: PointTimeSeriesData[] | null;
  loading?: boolean;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  pointId,
  data,
  loading = false,
}) => {
  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: pointId ? `${pointId} - 时间序列` : '请选择监测点',
          subtext: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#888', fontSize: 14 }
        }
      };
    }

    const dates = data.map(item => item.date);
    const originalValues = data.map(item => item.original_value);
    const dailyChange = data.map(item => item.daily_change);
    const cumulativeChange = data.map(item => item.cumulative_change);

    return {
      title: {
        text: `${pointId} - 时间序列数据`,
        left: 'center',
        textStyle: { fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(10, 18, 30, 0.95)',
        borderColor: 'rgba(0, 229, 255, 0.3)',
        textStyle: { fontSize: 11 }
      },
      legend: {
        data: ['原始值', '日变化', '累计变化'],
        bottom: 5,
        textStyle: { fontSize: 10 },
        itemWidth: 15,
        itemHeight: 10
      },
      grid: {
        left: '8%',
        right: '8%',
        bottom: '18%',
        top: '18%',
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
      yAxis: [
        {
          type: 'value',
          name: '值 (mm)',
          nameTextStyle: { fontSize: 10 },
          axisLabel: { fontSize: 10 },
          splitLine: {
            lineStyle: { color: 'rgba(0, 229, 255, 0.1)' }
          }
        },
        {
          type: 'value',
          name: '变化 (mm)',
          nameTextStyle: { fontSize: 10 },
          axisLabel: { fontSize: 10 },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          bottom: 25,
          height: 15,
          start: 0,
          end: 100
        }
      ],
      series: [
        {
          name: 'Original Value',
          type: 'line',
          data: originalValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2 },
          itemStyle: { color: NEON_COLORS.primary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0, 229, 255, 0.3)' },
                { offset: 1, color: 'rgba(0, 229, 255, 0.02)' }
              ]
            }
          }
        },
        {
          name: 'Daily Change',
          type: 'bar',
          yAxisIndex: 1,
          data: dailyChange.map(v => ({
            value: v,
            itemStyle: {
              color: v >= 0 ? NEON_COLORS.success : NEON_COLORS.warning
            }
          })),
          barWidth: '40%'
        },
        {
          name: 'Cumulative Change',
          type: 'line',
          yAxisIndex: 1,
          data: cumulativeChange,
          smooth: true,
          symbol: 'diamond',
          symbolSize: 4,
          lineStyle: {
            width: 2,
            type: 'dashed'
          },
          itemStyle: { color: NEON_COLORS.purple }
        }
      ],
      animationDuration: 800
    };
  }, [pointId, data]);

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default TimeSeriesChart;
