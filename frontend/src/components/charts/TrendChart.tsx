import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from './EChartsWrapper';
import { useSettlementSummary } from '../../hooks/useSettlementData';
import type { CardComponentProps } from '../../types/layout';
import { NEON_COLORS } from './cyberpunkTheme';

function getColorBySlope(slope: number): string {
  if (slope < -0.05) return NEON_COLORS.warning;  // Significant sinking
  if (slope < -0.01) return NEON_COLORS.orange;   // Mild sinking
  if (slope > 0.05) return NEON_COLORS.purple;    // Significant rising
  if (slope > 0.01) return NEON_COLORS.secondary; // Mild rising
  return NEON_COLORS.success;                     // Stable
}

export const TrendChart: React.FC<CardComponentProps> = () => {
  const { data, loading, error } = useSettlementSummary();

  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#888' }
        }
      };
    }

    // Sort by point ID numerically
    const sortedData = [...data].sort((a, b) => {
      const numA = parseInt(a.point_id.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.point_id.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    const slopeData = sortedData.map(item => ({
      name: item.point_id,
      value: parseFloat((item.trend_slope || 0).toFixed(6)),
    }));

    return {
      title: {
        text: '沉降趋势分析',
        subtext: '斜率 (mm/天)',
        left: 'center',
        textStyle: { fontSize: 16 },
        subtextStyle: { fontSize: 12 }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} mm/天'
      },
      grid: {
        left: '10%',
        right: '4%',
        bottom: '15%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: slopeData.map(item => item.name),
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          margin: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '斜率 (mm/天)',
        nameTextStyle: {
          fontSize: 11,
          padding: [0, 0, 0, 30]
        },
        axisLabel: { fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: slopeData.map(item => ({
          value: item.value,
          itemStyle: {
            color: getColorBySlope(item.value),
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            shadowColor: getColorBySlope(item.value),
            shadowBlur: 8
          }
        })),
        barWidth: '60%',
        showBackground: true,
        backgroundStyle: {
          color: 'rgba(0, 229, 255, 0.03)'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 15,
            shadowColor: 'rgba(0, 229, 255, 0.6)'
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 12,
            fontWeight: 'bold'
          }
        }
      }],
      animationDuration: 1000,
      animationEasing: 'elasticOut'
    };
  }, [data]);

  if (error) {
    return <div className="dashboard-card__error">{error}</div>;
  }

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={loading} />
    </div>
  );
};

export default TrendChart;
