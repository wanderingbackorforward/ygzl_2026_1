/**
 * CrackSpatialMap — Layer 3: 3-second spatial understanding
 * Inspired by Tesla's spatial vehicle visualization
 * Structure plan view with monitoring points as colored dots
 * Click any dot → opens side drawer with full diagnostics
 */
import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsWrapper from '../../charts/EChartsWrapper';
import { useCracks } from '../../../contexts/CracksContext';
import { classifyGB50292 } from '../../../utils/crack';
import type { CardComponentProps } from '../../../types/layout';

const GRADE_COLORS: Record<string, string> = {
  a: '#22c55e', // green
  b: '#eab308', // yellow
  c: '#f97316', // orange
  d: '#ef4444', // red
};

export const CrackSpatialMap: React.FC<CardComponentProps> = () => {
  const { points, overview, slopeData } = useCracks();

  const option = useMemo((): EChartsOption => {
    if (!points.length) {
      return {
        title: { text: '暂无监测点数据', left: 'center', top: 'center', textStyle: { color: '#888' } },
      };
    }

    // Mock coordinates (in real implementation, fetch from monitoring_points table)
    // For now, arrange points in a grid pattern
    const gridSize = Math.ceil(Math.sqrt(points.length));
    const mockPoints = points.map((id, idx) => {
      const row = Math.floor(idx / gridSize);
      const col = idx % gridSize;
      return {
        id,
        x: col * 10 + 5,
        y: row * 10 + 5,
        // Estimate severity from slope data
        slope: slopeData?.find(s => s.point === id)?.slope ?? 0,
      };
    });

    // Classify each point by grade
    const avgWidth = (overview as any)?.avg_width ?? 0.1;
    const scatterData = mockPoints.map(p => {
      // Estimate width from slope (mock logic until real data available)
      const estimatedWidth = avgWidth + p.slope * 10;
      const grade = classifyGB50292(Math.max(0, estimatedWidth));
      return {
        value: [p.x, p.y, estimatedWidth],
        name: p.id,
        itemStyle: { color: GRADE_COLORS[grade] },
        symbolSize: 20,
      };
    });

    return {
      title: {
        text: '空间分布热力图',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 16, color: '#fff' },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const name = params.name;
          const width = params.value[2]?.toFixed(2) ?? '--';
          return `${name}<br/>估计宽度: ${width}mm`;
        },
      },
      grid: {
        left: 40,
        right: 40,
        top: 60,
        bottom: 40,
      },
      xAxis: {
        type: 'value',
        name: 'X (m)',
        nameLocation: 'middle',
        nameGap: 25,
        axisLine: { lineStyle: { color: '#555' } },
        splitLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        name: 'Y (m)',
        nameLocation: 'middle',
        nameGap: 35,
        axisLine: { lineStyle: { color: '#555' } },
        splitLine: { lineStyle: { color: '#333' } },
      },
      series: [
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: 20,
          emphasis: {
            scale: 1.5,
            itemStyle: { borderColor: '#fff', borderWidth: 2 },
          },
        },
      ],
      legend: {
        data: [
          { name: 'A级 (完好)', icon: 'circle', itemStyle: { color: GRADE_COLORS.a } },
          { name: 'B级 (轻微)', icon: 'circle', itemStyle: { color: GRADE_COLORS.b } },
          { name: 'C级 (明显)', icon: 'circle', itemStyle: { color: GRADE_COLORS.c } },
          { name: 'D级 (严重)', icon: 'circle', itemStyle: { color: GRADE_COLORS.d } },
        ],
        bottom: 10,
        textStyle: { fontSize: 11, color: '#ccc' },
      },
      animationDuration: 800,
    };
  }, [points, overview, slopeData]);

  return (
    <div className="dashboard-card__chart">
      <EChartsWrapper option={option} loading={!points.length} />
    </div>
  );
};

export default CrackSpatialMap;
