/**
 * CrackConfidenceBandChart — Datadog-style "flatline = happy"
 * Grey confidence band shows expected range
 * Line piercing band = anomaly (highlighted in red)
 */
import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import { mean, stddev } from '../../../utils/crack';
import type { CardComponentProps } from '../../../types/layout';

export const CrackConfidenceBandChart: React.FC<CardComponentProps> = () => {
  const { trendData, trendLoading, selectedPointId } = useCracks();

  const option = useMemo((): EChartsOption => {
    if (!trendData || trendData.length < 10) {
      return {
        title: {
          text: selectedPointId ? 'Insufficient data' : 'Select a monitoring point',
          left: 'center',
          top: 'center',
          textStyle: { color: '#888' },
        },
      };
    }

    const dates = trendData.map(d => d.measurement_date);
    const values = trendData.map(d => d.value);

    // Compute baseline statistics from first 30 points (or all if fewer)
    const baselineSize = Math.min(30, Math.floor(values.length * 0.3));
    const baseline = values.slice(0, baselineSize);
    const mu = mean(baseline);
    const sigma = stddev(baseline);

    // Confidence band: μ ± 2σ
    const upperBand = values.map(() => mu + 2 * sigma);
    const lowerBand = values.map(() => mu - 2 * sigma);

    // Detect anomalies (values outside band)
    const anomalyIndices = values
      .map((v, i) => (v > upperBand[i] || v < lowerBand[i] ? i : -1))
      .filter(i => i >= 0);

    // Split series into normal and anomaly segments
    const normalData = values.map((v, i) =>
      anomalyIndices.includes(i) ? null : v
    );
    const anomalyData = values.map((v, i) =>
      anomalyIndices.includes(i) ? v : null
    );

    return {
      title: {
        text: `${selectedPointId} — Confidence Band`,
        left: 'center',
        top: 10,
        textStyle: { fontSize: 16, color: '#fff' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const date = params[0]?.axisValue ?? '';
          const val = params.find((p: any) => p.seriesName === 'Actual')?.value ?? '--';
          const upper = params.find((p: any) => p.seriesName === 'Upper')?.value ?? '--';
          const lower = params.find((p: any) => p.seriesName === 'Lower')?.value ?? '--';
          return `${date}<br/>Value: ${val}<br/>Band: [${lower?.toFixed(2)}, ${upper?.toFixed(2)}]`;
        },
      },
      legend: {
        data: ['Confidence Band', 'Normal', 'Anomaly'],
        top: 40,
        textStyle: { fontSize: 11, color: '#ccc' },
      },
      grid: {
        left: 60,
        right: 40,
        top: 80,
        bottom: 60,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 10, color: '#888', rotate: 45 },
        axisLine: { lineStyle: { color: '#555' } },
      },
      yAxis: {
        type: 'value',
        name: 'Width (mm)',
        nameTextStyle: { color: '#ccc' },
        axisLabel: { fontSize: 10, color: '#888' },
        axisLine: { lineStyle: { color: '#555' } },
        splitLine: { lineStyle: { color: '#333' } },
      },
      series: [
        {
          name: 'Upper',
          type: 'line',
          data: upperBand,
          lineStyle: { width: 0 },
          showSymbol: false,
          stack: 'confidence',
          areaStyle: { color: 'rgba(100, 100, 100, 0.2)' },
        },
        {
          name: 'Lower',
          type: 'line',
          data: lowerBand,
          lineStyle: { width: 0 },
          showSymbol: false,
          stack: 'confidence',
          areaStyle: { color: 'rgba(100, 100, 100, 0.2)' },
        },
        {
          name: 'Normal',
          type: 'line',
          data: normalData,
          lineStyle: { color: '#3b82f6', width: 2 },
          showSymbol: false,
          z: 10,
        },
        {
          name: 'Anomaly',
          type: 'line',
          data: anomalyData,
          lineStyle: { color: '#ef4444', width: 3 },
          itemStyle: { color: '#ef4444' },
          showSymbol: true,
          symbolSize: 8,
          z: 20,
        },
      ],
      animationDuration: 800,
    };
  }, [trendData, selectedPointId]);

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={trendLoading} />
    </div>
  );
};

export default CrackConfidenceBandChart;
