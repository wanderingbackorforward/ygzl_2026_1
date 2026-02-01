import React, { useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { ProfilePoint, GeologicalLayer } from '../../hooks/useAdvancedAnalysis';

interface ProfileChartProps {
  profile: ProfilePoint[];
  layers: GeologicalLayer[];
  date: string | null;
  tunnelLength?: number;
  tunnelDepth?: number;
}

export const ProfileChart: React.FC<ProfileChartProps> = ({
  profile,
  layers,
  date,
  tunnelLength = 565,
  tunnelDepth = 23,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!profile.length) return { xData: [], yData: [], colors: [] };

    const xData = profile.map(p => p.chainage_m);
    const yData = profile.map(p => p.cumulative_change ?? p.value ?? 0);

    // Color based on value (more negative = more red)
    const colors = yData.map(v => {
      if (v === null || v === undefined) return '#888';
      if (v < -5) return '#ff4444';
      if (v < -3) return '#ff8800';
      if (v < -1) return '#ffcc00';
      if (v < 0) return '#88cc00';
      return '#44cc44';
    });

    return { xData, yData, colors };
  }, [profile]);

  // Layer background data
  const layerVisualData = useMemo(() => {
    return layers.map(layer => ({
      name: layer.layer_name,
      yMin: -layer.depth_bottom,
      yMax: -layer.depth_top,
      color: layer.color || '#cccccc',
    }));
  }, [layers]);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;
    const { xData, yData } = chartData;

    // Calculate y-axis range
    const minY = Math.min(...yData.filter(v => v !== null)) - 2;
    const maxY = Math.max(...yData.filter(v => v !== null)) + 2;

    const option: echarts.EChartsOption = {
      backgroundColor: '#1a1a2e',
      title: {
        text: `隧道沉降剖面${date ? ` - ${date}` : ''}`,
        left: 'center',
        top: 10,
        textStyle: {
          color: '#ffffff',
          fontSize: 16,
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 20, 40, 0.9)',
        borderColor: '#4a9eff',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const data = params[0];
          if (!data || data.dataIndex === undefined) return '';
          const point = profile[data.dataIndex];
          if (!point) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${point.point_id}</div>
              <div>里程：${point.chainage_m?.toFixed(1) ?? '-'} m</div>
              <div>沉降：${(point.cumulative_change ?? point.value ?? 0).toFixed(2)} mm</div>
              ${point.daily_change !== null && point.daily_change !== undefined ? `<div>日变化率：${point.daily_change.toFixed(3)} mm/天</div>` : ''}
            </div>
          `;
        },
      },
      grid: {
        left: 60,
        right: 40,
        top: 60,
        bottom: 80,
      },
      xAxis: {
        type: 'value',
        name: '里程（m）',
        nameLocation: 'middle',
        nameGap: 35,
        min: 0,
        max: tunnelLength,
        axisLine: { lineStyle: { color: '#4a9eff' } },
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: 'rgba(74, 158, 255, 0.2)' } },
      },
      yAxis: {
        type: 'value',
        name: '沉降（mm）',
        nameLocation: 'middle',
        nameGap: 45,
        min: minY,
        max: maxY,
        axisLine: { lineStyle: { color: '#4a9eff' } },
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: 'rgba(74, 158, 255, 0.2)' } },
      },
      visualMap: {
        show: true,
        type: 'continuous',
        min: -10,
        max: 2,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        text: ['抬升', '沉降'],
        textStyle: { color: '#aaa' },
        inRange: {
          color: ['#ff4444', '#ff8800', '#ffcc00', '#88cc00', '#44cc44'],
        },
      },
      series: [
        // Geological layers as background
        ...layerVisualData.map((layer, idx) => ({
          type: 'line' as const,
          name: layer.name,
          data: [],
          markArea: {
            silent: true,
            data: [[
              { xAxis: 0, yAxis: layer.yMax },
              { xAxis: tunnelLength, yAxis: layer.yMin },
            ]],
            itemStyle: {
              color: layer.color,
              opacity: 0.15,
            },
            label: {
              show: idx === 0,
              position: 'insideLeft',
              formatter: layer.name,
              color: '#888',
              fontSize: 10,
            },
          },
        })),
        // Tunnel outline
        {
          type: 'line',
          name: '隧道',
          data: [],
          markArea: {
            silent: true,
            data: [[
              { xAxis: 0, yAxis: -tunnelDepth + 3 },
              { xAxis: tunnelLength, yAxis: -tunnelDepth - 3 },
            ]],
            itemStyle: {
              color: '#4a9eff',
              opacity: 0.3,
            },
          },
        },
        // Zero line
        {
          type: 'line',
          name: '零线',
          data: [[0, 0], [tunnelLength, 0]],
          lineStyle: {
            color: '#ffffff',
            width: 1,
            type: 'dashed',
          },
          symbol: 'none',
        },
        // Settlement profile
        {
          type: 'line',
          name: '沉降',
          data: xData.map((x, i) => [x, yData[i]]),
          smooth: true,
          lineStyle: {
            width: 3,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(74, 158, 255, 0.4)' },
              { offset: 1, color: 'rgba(74, 158, 255, 0.1)' },
            ]),
          },
          emphasis: {
            focus: 'series',
          },
        },
        // Point markers
        {
          type: 'scatter',
          name: '点位',
          data: xData.map((x, i) => ({
            value: [x, yData[i]],
            itemStyle: {
              color: yData[i] < -3 ? '#ff4444' : yData[i] < -1 ? '#ffcc00' : '#44cc44',
            },
          })),
          symbolSize: 10,
          emphasis: {
            scale: 1.5,
          },
        },
      ],
    };

    chart.setOption(option);

    // Handle resize
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chartData, layerVisualData, date, tunnelLength, tunnelDepth, profile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '400px',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
};

export default ProfileChart;
