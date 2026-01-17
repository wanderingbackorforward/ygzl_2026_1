import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import type { CardComponentProps } from '../../../types/layout';

export const CrackOverviewPieChart: React.FC<CardComponentProps> = () => {
  const { overview, overviewLoading, overviewError } = useCracks();
  const option = useMemo((): EChartsOption => {
    if (!overview) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    const data = [
      { name: '扩展', value: (overview as any).expanding_points ?? overview.expanding ?? 0 },
      { name: '稳定', value: (overview as any).stable_points ?? overview.stable ?? 0 },
      { name: '收缩', value: (overview as any).shrinking_points ?? overview.contracting ?? 0 },
    ];
    return {
      title: { text: '状态概览', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 11 } },
      series: [{ type: 'pie', radius: ['40%', '70%'], center: ['40%', '55%'], label: { show: false }, labelLine: { show: false }, data }],
      animationDuration: 800
    };
  }, [overview]);
  if (overviewError) return <div className="dashboard-card__error">{overviewError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={overviewLoading} /></div>;
};

export default CrackOverviewPieChart;
