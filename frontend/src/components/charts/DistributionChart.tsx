import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from './EChartsWrapper';
import { useSettlementSummary } from '../../hooks/useSettlementData';
import type { CardComponentProps } from '../../types/layout';

const TREND_COLORS: Record<string, string> = {
  'Significant Sinking': '#ff3e5f',
  'Mild Sinking': '#ff9e0d',
  'Stable': '#00e676',
  'Mild Rising': '#0088ff',
  'Significant Rising': '#bf5af2',
  // Chinese labels
  '[XZ]': '#ff3e5f',
  '[QX]': '#ff9e0d',
  '[WD]': '#00e676',
  '[QL]': '#0088ff',
  '[XL]': '#bf5af2',
};

export const DistributionChart: React.FC<CardComponentProps> = () => {
  const { data, loading, error } = useSettlementSummary();

  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'No Data',
          left: 'center',
          top: 'center',
          textStyle: { color: '#888' }
        }
      };
    }

    // Count by trend type
    const trendCounts: Record<string, number> = {};
    data.forEach(item => {
      if (item.trend_type) {
        trendCounts[item.trend_type] = (trendCounts[item.trend_type] || 0) + 1;
      }
    });

    const pieData = Object.entries(trendCounts).map(([name, value]) => ({
      name,
      value
    }));

    const colorList = pieData.map(item => TREND_COLORS[item.name] || '#00e5ff');

    return {
      title: {
        text: 'Alert Level Distribution',
        left: 'center',
        textStyle: { fontSize: 16 }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: {
          fontSize: 11,
          color: 'rgba(224, 247, 250, 0.8)'
        },
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
        formatter: (name: string) => {
          const item = pieData.find(p => p.name === name);
          return item ? `${name}: ${item.value}` : name;
        }
      },
      series: [{
        name: 'Alert Level',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '55%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: 'rgba(16, 23, 41, 0.8)',
          borderWidth: 2,
          shadowBlur: 15,
          shadowColor: 'rgba(0, 0, 0, 0.4)'
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 25
          }
        },
        labelLine: { show: false },
        data: pieData,
        color: colorList
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

export default DistributionChart;
