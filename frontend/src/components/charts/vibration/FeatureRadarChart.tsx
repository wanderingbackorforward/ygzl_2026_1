import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useVibration } from '../../../contexts/VibrationContext';
import type { CardComponentProps } from '../../../types/layout';

export const FeatureRadarChart: React.FC<CardComponentProps> = () => {
  const { radar, radarLoading, radarError } = useVibration();
  const option = useMemo((): EChartsOption => {
    if (!radar || radar.length === 0) {
      return { title: { text: 'No Data', left: 'center', top: 'center', textStyle: { color: '#888' } } };
    }
    const indicators = radar.map(r => ({ name: r.indicator, max: Math.max(...radar.map(x => x.value)) || 1 }));
    const values = radar.map(r => r.value);
    return {
      title: { text: 'Feature Radar', left: 'center', textStyle: { fontSize: 16 } },
      radar: { indicator: indicators },
      series: [{ type: 'radar', data: [{ value: values }] }],
      animationDuration: 600
    };
  }, [radar]);
  if (radarError) return <div className="dashboard-card__error">{radarError}</div>;
  return <div className="dashboard-card__chart"><EChartsWrapper option={option} loading={radarLoading} /></div>;
};

export default FeatureRadarChart;
