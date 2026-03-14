import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { PredictionResult } from '../../types/analysis';

interface PredictionChartProps {
  prediction: PredictionResult;
  historicalData?: Array<{ date: string; value: number }>;
  height?: number;
}

export const PredictionChart: React.FC<PredictionChartProps> = ({
  prediction,
  historicalData = [],
  height = 400,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const dataCharacteristics = prediction.model_selection_info?.data_characteristics ?? {
    data_size: 0,
    trend_strength: 0,
    volatility: 0,
    seasonality_strength: 0,
  };
  const bestScore = prediction.model_selection_info?.best_score;

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // 准备数据
    const historicalDates = historicalData.map(d => d.date);
    const historicalValues = historicalData.map(d => d.value);
    const forecastDates = prediction.forecast.dates;
    const forecastValues = prediction.forecast.values;
    const lowerBound = prediction.forecast.lower_bound;
    const upperBound = prediction.forecast.upper_bound;

    // 合并日期轴
    const allDates = [...historicalDates, ...forecastDates];

    // 配置图表
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `${prediction.point_id} 沉降预测`,
        subtext: `模型: ${prediction.selected_model.toUpperCase()}`,
        left: 'center',
        textStyle: {
          color: '#fff',
          fontSize: 16,
          fontWeight: 'bold',
        },
        subtextStyle: {
          color: '#fff',
          fontSize: 12,
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 20, 40, 0.95)',
        borderColor: 'rgba(74, 158, 255, 0.3)',
        textStyle: {
          color: '#fff',
        },
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: 'rgba(74, 158, 255, 0.8)',
          },
        },
      },
      legend: {
        data: ['历史数据', '预测值', '置信区间'],
        top: 40,
        textStyle: {
          color: '#fff',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 80,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: allDates,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: 'rgba(74, 158, 255, 0.3)',
          },
        },
        axisLabel: {
          color: '#fff',
          rotate: 45,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(74, 158, 255, 0.1)',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: '沉降 (mm)',
        nameTextStyle: {
          color: '#fff',
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(74, 158, 255, 0.3)',
          },
        },
        axisLabel: {
          color: '#fff',
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(74, 158, 255, 0.1)',
          },
        },
      },
      series: [
        // 历史数据
        {
          name: '历史数据',
          type: 'line',
          data: [...historicalValues, ...Array(forecastDates.length).fill(null)],
          smooth: true,
          lineStyle: {
            color: '#4a9eff',
            width: 2.5,
          },
          itemStyle: {
            color: '#4a9eff',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(74, 158, 255, 0.15)' },
                { offset: 1, color: 'rgba(74, 158, 255, 0.01)' },
              ],
            },
          },
          symbol: 'circle',
          symbolSize: 3,
          showSymbol: false,
        },
        // 预测值
        {
          name: '预测值',
          type: 'line',
          data: [
            ...Array(historicalDates.length).fill(null),
            historicalValues[historicalValues.length - 1],
            ...forecastValues,
          ],
          smooth: true,
          lineStyle: {
            color: '#ff7a45',
            width: 2.5,
            type: 'dashed',
          },
          itemStyle: {
            color: '#ff7a45',
          },
          symbol: 'diamond',
          symbolSize: 5,
          showSymbol: false,
        },
        // 置信区间上界
        {
          name: '置信区间',
          type: 'line',
          data: [
            ...Array(historicalDates.length).fill(null),
            historicalValues[historicalValues.length - 1],
            ...upperBound,
          ],
          smooth: true,
          lineStyle: {
            opacity: 0,
          },
          stack: 'confidence',
          symbol: 'none',
        },
        // 置信区间下界
        {
          name: '置信区间',
          type: 'line',
          data: [
            ...Array(historicalDates.length).fill(null),
            historicalValues[historicalValues.length - 1],
            ...lowerBound,
          ],
          smooth: true,
          lineStyle: {
            opacity: 0,
          },
          areaStyle: {
            color: 'rgba(255, 122, 69, 0.15)',
          },
          stack: 'confidence',
          symbol: 'none',
        },
      ],
    };

    chart.setOption(option);

    // 响应式
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [prediction, historicalData]);

  // 清理
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return (
    <div style={styles.container}>
      <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />

      {/* 模型信息 */}
      <div style={styles.modelInfo}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>数据量</span>
          <span style={styles.infoValue}>
            {dataCharacteristics.data_size} 条
          </span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>趋势强度</span>
          <span style={styles.infoValue}>
            {(dataCharacteristics.trend_strength * 100).toFixed(1)}%
          </span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>波动性</span>
          <span style={styles.infoValue}>
            {(dataCharacteristics.volatility * 100).toFixed(1)}%
          </span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>季节性</span>
          <span style={styles.infoValue}>
            {(dataCharacteristics.seasonality_strength * 100).toFixed(1)}%
          </span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>模型得分</span>
          <span style={styles.infoValue}>
            {typeof bestScore === 'number' ? bestScore.toFixed(3) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modelInfo: {
    display: 'flex',
    gap: '24px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#fff',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
};
