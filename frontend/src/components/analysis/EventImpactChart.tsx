import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface EventImpactData {
  method: string;
  treatment_effect: number;
  treated_change: number;
  control_change: number;
  confidence_interval: [number, number];
  interpretation: string;
  before_period: {
    dates: string[];
    treated_values: number[];
    control_values: number[];
  };
  after_period: {
    dates: string[];
    treated_values: number[];
    control_values: number[];
    counterfactual?: number[];
  };
}

interface EventImpactChartProps {
  data: EventImpactData;
  eventDate: string;
  eventName?: string;
  height?: number;
}

export const EventImpactChart: React.FC<EventImpactChartProps> = ({
  data,
  eventDate,
  eventName = '施工事件',
  height = 400,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // 合并前后期数据
    const allDates = [
      ...data.before_period.dates,
      ...data.after_period.dates,
    ];
    const treatedValues = [
      ...data.before_period.treated_values,
      ...data.after_period.treated_values,
    ];
    const controlValues = [
      ...data.before_period.control_values,
      ...data.after_period.control_values,
    ];

    // 找到事件日期的索引
    const eventIndex = allDates.indexOf(eventDate);

    // 反事实预测（如果有）
    const counterfactual = data.after_period.counterfactual
      ? [
          ...Array(data.before_period.dates.length).fill(null),
          ...data.after_period.counterfactual,
        ]
      : [];

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `${eventName}影响分析`,
        subtext: `方法: ${data.method === 'DID' ? '双重差分法' : '合成控制法'}`,
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
        data: ['处理组（受影响点位）', '对照组（未受影响点位）', '反事实预测'],
        top: 40,
        textStyle: {
          color: '#fff',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 100,
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
        // 处理组
        {
          name: '处理组（受影响点位）',
          type: 'line',
          data: treatedValues,
          lineStyle: {
            color: '#ff7a45',
            width: 2,
          },
          itemStyle: {
            color: '#ff7a45',
          },
          symbol: 'circle',
          symbolSize: 6,
          markLine: {
            data: [
              {
                xAxis: eventIndex,
                label: {
                  formatter: eventName,
                  color: '#fff',
                },
                lineStyle: {
                  color: '#ff4d4f',
                  type: 'dashed',
                  width: 2,
                },
              },
            ],
          },
        },
        // 对照组
        {
          name: '对照组（未受影响点位）',
          type: 'line',
          data: controlValues,
          lineStyle: {
            color: '#4a9eff',
            width: 2,
          },
          itemStyle: {
            color: '#4a9eff',
          },
          symbol: 'circle',
          symbolSize: 6,
        },
        // 反事实预测
        ...(counterfactual.length > 0
          ? [
              {
                name: '反事实预测',
                type: 'line',
                data: counterfactual,
                lineStyle: {
                  color: '#52c41a',
                  width: 2,
                  type: 'dashed',
                },
                itemStyle: {
                  color: '#52c41a',
                },
                symbol: 'circle',
                symbolSize: 4,
              },
            ]
          : []),
      ],
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, eventDate, eventName]);

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

      {/* 分析结果 */}
      <div style={styles.resultContainer}>
        <div style={styles.resultCard}>
          <div style={styles.resultLabel}>处理效应</div>
          <div style={styles.resultValue}>
            {(data.treatment_effect ?? 0) > 0 ? '+' : ''}
            {(data.treatment_effect ?? 0).toFixed(3)} mm
          </div>
          <div style={styles.resultHint}>
            事件导致的净影响
          </div>
        </div>

        <div style={styles.resultCard}>
          <div style={styles.resultLabel}>处理组变化</div>
          <div style={styles.resultValue}>
            {(data.treated_change ?? 0) > 0 ? '+' : ''}
            {(data.treated_change ?? 0).toFixed(3)} mm
          </div>
          <div style={styles.resultHint}>
            受影响点位的变化
          </div>
        </div>

        <div style={styles.resultCard}>
          <div style={styles.resultLabel}>对照组变化</div>
          <div style={styles.resultValue}>
            {(data.control_change ?? 0) > 0 ? '+' : ''}
            {(data.control_change ?? 0).toFixed(3)} mm
          </div>
          <div style={styles.resultHint}>
            未受影响点位的变化
          </div>
        </div>

        <div style={styles.resultCard}>
          <div style={styles.resultLabel}>置信区间</div>
          <div style={styles.resultValue}>
            [{(data.confidence_interval?.[0] ?? 0).toFixed(3)}, {(data.confidence_interval?.[1] ?? 0).toFixed(3)}]
          </div>
          <div style={styles.resultHint}>
            95%置信水平
          </div>
        </div>
      </div>

      {/* 解释 */}
      <div style={styles.interpretation}>
        <div style={styles.interpretationIcon}>
          <i className="fas fa-info-circle" />
        </div>
        <div style={styles.interpretationText}>
          {data.interpretation}
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
  resultContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  resultCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  resultLabel: {
    fontSize: '12px',
    color: '#fff',
  },
  resultValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  resultHint: {
    fontSize: '13px',
    color: '#ccc',
  },
  interpretation: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  interpretationIcon: {
    fontSize: '20px',
    color: '#4a9eff',
    flexShrink: 0,
  },
  interpretationText: {
    fontSize: '14px',
    color: '#fff',
    lineHeight: '1.6',
  },
};
