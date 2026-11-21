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

/**
 * 走势图只负责"看图核对"，结论和依据在页面上方的结论卡里。
 * 不在图里重复摆数字，避免同一件事说三遍。
 */
export const EventImpactChart: React.FC<EventImpactChartProps> = ({
  data,
  eventDate,
  eventName = '施工事件',
  height = 340,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    const beforeCount = data.before_period.dates.length;
    const allDates = [...data.before_period.dates, ...data.after_period.dates];
    const treatedValues = [
      ...data.before_period.treated_values,
      ...data.after_period.treated_values,
    ];
    const controlValues = [
      ...data.before_period.control_values,
      ...data.after_period.control_values,
    ];

    // 施工日不是测量日：竖线放在"施工后第一次测量"的位置，之前的写法取不到值，线会消失
    const eventIndex = beforeCount;

    const counterfactual = data.after_period.counterfactual
      ? [
          ...Array(beforeCount).fill(null),
          ...data.after_period.counterfactual,
        ]
      : [];

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 20, 40, 0.95)',
        borderColor: 'rgba(74, 158, 255, 0.3)',
        textStyle: { color: '#fff' },
        valueFormatter: (v) => (v === null || v === undefined ? '-' : `${Number(v).toFixed(2)} mm`),
      },
      legend: {
        data: ['受影响点位', '对比点位（均值）'].concat(counterfactual.length ? ['如果没施工'] : []),
        top: 0,
        textStyle: { color: '#cfe0f2', fontSize: 12 },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '6%',
        top: 44,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: allDates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(74, 158, 255, 0.3)' } },
        axisLabel: { color: '#9fb8d1', rotate: 45, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '累计沉降 (mm)',
        nameTextStyle: { color: '#9fb8d1', fontSize: 11 },
        axisLine: { show: false },
        axisLabel: { color: '#9fb8d1', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [
        {
          name: '受影响点位',
          type: 'line',
          data: treatedValues,
          lineStyle: { color: '#ff7a45', width: 2.5 },
          itemStyle: { color: '#ff7a45' },
          symbol: 'circle',
          symbolSize: 6,
          markArea: {
            silent: true,
            data: [
              [
                {
                  xAxis: allDates[0],
                  itemStyle: { color: 'rgba(120,160,210,0.06)' },
                  label: { show: true, position: 'insideTop', color: '#8fa8c2', fontSize: 11, formatter: '施工前' },
                },
                { xAxis: allDates[beforeCount - 1] },
              ],
              [
                {
                  xAxis: allDates[beforeCount],
                  itemStyle: { color: 'rgba(255,122,69,0.07)' },
                  label: { show: true, position: 'insideTop', color: '#ffb28c', fontSize: 11, formatter: '施工后' },
                },
                { xAxis: allDates[allDates.length - 1] },
              ],
            ],
          },
          markLine: {
            symbol: 'none',
            data: [
              {
                xAxis: eventIndex,
                label: {
                  formatter: `施工日 ${eventDate.slice(5)}`,
                  color: '#fff',
                  fontSize: 11,
                  rotate: 0,
                  position: 'insideEndTop',
                  backgroundColor: 'rgba(255,77,79,0.85)',
                  padding: [2, 6],
                  borderRadius: 3,
                },
                lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1.5 },
              },
            ],
          },
        },
        {
          name: '对比点位（均值）',
          type: 'line',
          data: controlValues,
          lineStyle: { color: '#4a9eff', width: 2 },
          itemStyle: { color: '#4a9eff' },
          symbol: 'circle',
          symbolSize: 5,
        },
        ...(counterfactual.length > 0
          ? [
              {
                name: '如果没施工',
                type: 'line' as const,
                data: counterfactual,
                lineStyle: { color: '#52c41a', width: 2, type: 'dashed' as const },
                itemStyle: { color: '#52c41a' },
                symbol: 'circle' as const,
                symbolSize: 4,
              },
            ]
          : []),
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, eventDate, eventName]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
};
