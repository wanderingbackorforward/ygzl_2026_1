import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from './EChartsWrapper';
import { usePointPrediction } from '../../hooks/useSettlementData';
import type { CardComponentProps } from '../../types/layout';
import { NEON_COLORS } from './cyberpunkTheme';

interface TrendPredictionChartProps extends CardComponentProps {
  pointId: string | null;
}

export const TrendPredictionChart: React.FC<TrendPredictionChartProps> = ({ pointId }) => {
  const { data, loading, error } = usePointPrediction(pointId);

  const option = useMemo((): EChartsOption => {
    if (!data) {
      return {
        title: {
          text: pointId ? '加载中...' : '请选择监测点',
          left: 'center',
          top: 'center',
          textStyle: { color: '#888', fontSize: 14 }
        }
      };
    }

    const { historical, prediction, regression, risk_assessment } = data;

    // Prepare historical data
    const historicalDates = historical.dates.map(d => d.split('T')[0]);
    const historicalValues = historical.values;
    const fittedValues = historical.fitted_values;

    // Prepare prediction data
    const predictionDates = prediction.dates.map(d => d.split('T')[0]);
    const predictionValues = prediction.values;

    // Prepare confidence interval data
    const upperBound = prediction.confidence_intervals.map(ci => ci.upper);
    const lowerBound = prediction.confidence_intervals.map(ci => ci.lower);

    // Combine all dates
    const allDates = [...historicalDates, ...predictionDates];

    // Create series data with proper null padding
    const historicalSeries = [...historicalValues, ...Array(predictionDates.length).fill(null)];
    const fittedSeries = [...fittedValues, ...Array(predictionDates.length).fill(null)];
    const predictionSeries = [...Array(historicalDates.length - 1).fill(null), historicalValues[historicalValues.length - 1], ...predictionValues];
    const upperSeries = [...Array(historicalDates.length - 1).fill(null), historicalValues[historicalValues.length - 1], ...upperBound];
    const lowerSeries = [...Array(historicalDates.length - 1).fill(null), historicalValues[historicalValues.length - 1], ...lowerBound];

    // Risk level color
    const riskColors: Record<string, string> = {
      critical: NEON_COLORS.warning,
      high: NEON_COLORS.orange,
      medium: '#ffeb3b',
      low: NEON_COLORS.success,
      normal: NEON_COLORS.primary
    };
    const riskColor = riskColors[risk_assessment.risk_level] || NEON_COLORS.primary;

    return {
      title: {
        text: `${data.point_id} - 沉降趋势预测`,
        subtext: `R² = ${regression.r_squared.toFixed(4)} | ${regression.equation}`,
        left: 'center',
        textStyle: { fontSize: 14, color: NEON_COLORS.primary },
        subtextStyle: { fontSize: 11, color: '#aaa' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 18, 30, 0.95)',
        borderColor: 'rgba(0, 229, 255, 0.3)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number | null; axisValue: string; color: string }>;
          let result = `<div style="font-weight:bold;margin-bottom:4px;">${items[0]?.axisValue}</div>`;
          items.forEach(item => {
            if (item.value !== null && item.value !== undefined) {
              const value = typeof item.value === 'number' ? item.value.toFixed(4) : item.value;
              result += `<div style="display:flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:10px;height:10px;background:${item.color};border-radius:50%;"></span>
                <span>${item.seriesName}: ${value} mm</span>
              </div>`;
            }
          });
          return result;
        }
      },
      legend: {
        data: ['实测值', '拟合线', '预测值', '置信区间'],
        bottom: 5,
        textStyle: { color: '#ccc', fontSize: 11 },
        selectedMode: true
      },
      grid: {
        left: '8%',
        right: '4%',
        top: '18%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          rotate: 45,
          fontSize: 10,
          color: '#aaa',
          formatter: (value: string) => value.substring(5) // Show MM-DD
        },
        axisLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.3)' } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '沉降量 (mm)',
        nameTextStyle: { fontSize: 11, color: '#aaa' },
        axisLabel: { fontSize: 10, color: '#aaa' },
        axisLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.1)' } }
      },
      series: [
        {
          name: '置信区间',
          type: 'line',
          data: upperSeries,
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          stack: 'confidence',
          symbol: 'none',
          silent: true
        },
        {
          name: '置信区间',
          type: 'line',
          data: lowerSeries.map((val, i) => val !== null && upperSeries[i] !== null ? (upperSeries[i] as number) - (val as number) : null),
          lineStyle: { opacity: 0 },
          areaStyle: {
            color: 'rgba(0, 229, 255, 0.15)',
            origin: 'start'
          },
          stack: 'confidence',
          symbol: 'none',
          silent: true
        },
        {
          name: '实测值',
          type: 'scatter',
          data: historicalSeries,
          symbolSize: 6,
          itemStyle: {
            color: NEON_COLORS.primary,
            shadowColor: NEON_COLORS.primary,
            shadowBlur: 4
          },
          z: 10
        },
        {
          name: '拟合线',
          type: 'line',
          data: fittedSeries,
          smooth: false,
          lineStyle: {
            color: NEON_COLORS.success,
            width: 2,
            type: 'solid'
          },
          symbol: 'none',
          z: 5
        },
        {
          name: '预测值',
          type: 'line',
          data: predictionSeries,
          smooth: false,
          lineStyle: {
            color: riskColor,
            width: 2,
            type: 'dashed'
          },
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: {
            color: riskColor,
            shadowColor: riskColor,
            shadowBlur: 6
          },
          z: 8,
          markPoint: {
            data: [
              {
                coord: [allDates.length - 1, predictionValues[predictionValues.length - 1]],
                value: predictionValues[predictionValues.length - 1].toFixed(3),
                symbol: 'pin',
                symbolSize: 40,
                itemStyle: { color: riskColor },
                label: {
                  show: true,
                  formatter: '{c}',
                  fontSize: 10,
                  color: '#fff'
                }
              }
            ]
          }
        }
      ],
      animation: true,
      animationDuration: 800
    };
  }, [data, pointId]);

  if (error) {
    return <div className="dashboard-card__error">{error}</div>;
  }

  return (
    <div className="dashboard-card__chart" style={{ position: 'relative' }}>
      <EChartsWrapper option={option} loading={loading} />
      {data && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 'bold',
          background: data.risk_assessment.risk_level === 'critical' ? NEON_COLORS.warning :
                      data.risk_assessment.risk_level === 'high' ? NEON_COLORS.orange :
                      data.risk_assessment.risk_level === 'medium' ? '#ffeb3b' :
                      NEON_COLORS.success,
          color: data.risk_assessment.risk_level === 'medium' ? '#000' : '#fff',
          boxShadow: '0 0 8px rgba(0,0,0,0.3)'
        }}>
          {data.risk_assessment.risk_level === 'critical' ? '[!] 严重' :
           data.risk_assessment.risk_level === 'high' ? '[!] 高风险' :
           data.risk_assessment.risk_level === 'medium' ? '中风险' :
           data.risk_assessment.risk_level === 'low' ? '低风险' : '正常'}
        </div>
      )}
    </div>
  );
};

export default TrendPredictionChart;
