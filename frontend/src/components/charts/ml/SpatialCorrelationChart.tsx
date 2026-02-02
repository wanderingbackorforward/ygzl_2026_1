import React, { useState, useEffect } from 'react';
import { CardBase } from '../cards/CardBase';
import { EChartsWrapper } from './EChartsWrapper';
import { mlSpatialCorrelation, type MLSpatialResult } from '../../lib/mlApi';
import type { EChartsOption } from 'echarts';

interface SpatialCorrelationChartProps {
  cardId: string;
}

export const SpatialCorrelationChart: React.FC<SpatialCorrelationChartProps> = ({
  cardId
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MLSpatialResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'scatter' | 'heatmap'>('scatter');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await mlSpatialCorrelation(50);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const scatterOption: EChartsOption | null = data ? {
    title: {
      text: '监测点空间分布与聚类',
      subtext: `发现 ${data.cluster_count} 个聚类`,
      left: 'center',
      textStyle: { color: '#fff', fontSize: 16 },
      subtextStyle: { color: '#00ffff', fontSize: 12 }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#00ffff',
      textStyle: { color: '#fff' },
      formatter: (params: any) => {
        return `
          <div style="padding: 8px;">
            <strong>${params.data.point_id}</strong><br/>
            坐标: (${params.data.value[0].toFixed(2)}, ${params.data.value[1].toFixed(2)})<br/>
            聚类: ${params.data.cluster >= 0 ? `聚类${params.data.cluster + 1}` : '独立点'}
          </div>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 80,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: 'X坐标 (m)',
      nameTextStyle: { color: '#fff' },
      axisLine: { lineStyle: { color: '#00ffff' } },
      axisLabel: { color: '#fff' },
      splitLine: { lineStyle: { color: 'rgba(0, 255, 255, 0.1)' } }
    },
    yAxis: {
      type: 'value',
      name: 'Y坐标 (m)',
      nameTextStyle: { color: '#fff' },
      axisLine: { lineStyle: { color: '#00ffff' } },
      axisLabel: { color: '#fff' },
      splitLine: { lineStyle: { color: 'rgba(0, 255, 255, 0.1)' } }
    },
    series: (() => {
      // 为每个聚类创建一个系列
      const clusterColors = ['#00ff00', '#00aaff', '#ff00ff', '#ffaa00', '#ff0000'];
      const clusterMap = new Map<number, number[]>();

      // 将点分配到聚类
      data.clusters.forEach((cluster, clusterIdx) => {
        cluster.forEach(pointIdx => {
          clusterMap.set(pointIdx, [clusterIdx, clusterColors[clusterIdx % clusterColors.length]]);
        });
      });

      // 创建系列数据
      const seriesData: any[] = [];
      const clusterSeries = new Map<number, any[]>();

      data.points.forEach((point, idx) => {
        const clusterInfo = clusterMap.get(idx);
        if (clusterInfo) {
          const [clusterIdx, color] = clusterInfo;
          if (!clusterSeries.has(clusterIdx)) {
            clusterSeries.set(clusterIdx, []);
          }
          clusterSeries.get(clusterIdx)!.push({
            value: [point.x_coord, point.y_coord],
            point_id: point.point_id,
            cluster: clusterIdx
          });
        } else {
          // 独立点
          seriesData.push({
            name: '独立点',
            type: 'scatter',
            data: [{
              value: [point.x_coord, point.y_coord],
              point_id: point.point_id,
              cluster: -1
            }],
            symbolSize: 10,
            itemStyle: { color: '#888' }
          });
        }
      });

      // 添加聚类系列
      clusterSeries.forEach((points, clusterIdx) => {
        seriesData.push({
          name: `聚类${clusterIdx + 1}`,
          type: 'scatter',
          data: points,
          symbolSize: 12,
          itemStyle: { color: clusterColors[clusterIdx % clusterColors.length] }
        });
      });

      return seriesData;
    })(),
    legend: {
      top: 40,
      textStyle: { color: '#fff' }
    }
  } : null;

  const heatmapOption: EChartsOption | null = data ? {
    title: {
      text: '监测点相关性热力图',
      subtext: '颜色越深表示相关性越强',
      left: 'center',
      textStyle: { color: '#fff', fontSize: 16 },
      subtextStyle: { color: '#888', fontSize: 12 }
    },
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#00ffff',
      textStyle: { color: '#fff' },
      formatter: (params: any) => {
        const [x, y, value] = params.data;
        return `
          <div style="padding: 8px;">
            ${data.points[x].point_id} ↔ ${data.points[y].point_id}<br/>
            相关系数: ${value.toFixed(3)}
          </div>
        `;
      }
    },
    grid: {
      height: '70%',
      top: '15%'
    },
    xAxis: {
      type: 'category',
      data: data.points.map(p => p.point_id),
      splitArea: { show: true },
      axisLabel: { color: '#fff', rotate: 45 }
    },
    yAxis: {
      type: 'category',
      data: data.points.map(p => p.point_id),
      splitArea: { show: true },
      axisLabel: { color: '#fff' }
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      inRange: {
        color: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
      },
      textStyle: { color: '#fff' }
    },
    series: [{
      name: '相关性',
      type: 'heatmap',
      data: (() => {
        const heatmapData: [number, number, number][] = [];
        data.correlation_matrix.forEach((row, i) => {
          row.forEach((value, j) => {
            heatmapData.push([i, j, value]);
          });
        });
        return heatmapData;
      })(),
      label: {
        show: false
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 255, 255, 0.5)'
        }
      }
    }]
  } : null;

  const renderContent = () => {
    if (error) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ff4444'
        }}>
          {error}
        </div>
      );
    }

    if (!data) {
      return null;
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 视图切换 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setViewMode('scatter')}
            style={{
              flex: 1,
              padding: '8px',
              background: viewMode === 'scatter' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: viewMode === 'scatter' ? '1px solid #00ffff' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📍 空间分布
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            style={{
              flex: 1,
              padding: '8px',
              background: viewMode === 'heatmap' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: viewMode === 'heatmap' ? '1px solid #00ffff' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔥 相关性热力图
          </button>
        </div>

        {/* 统计信息 */}
        <div style={{
          padding: '12px',
          background: 'rgba(0, 255, 255, 0.1)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(0, 255, 255, 0.3)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: '12px' }}>监测点总数</div>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                {data.points.length}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: '12px' }}>发现聚类数</div>
              <div style={{ color: '#00ffff', fontSize: '20px', fontWeight: 'bold' }}>
                {data.cluster_count}
              </div>
            </div>
          </div>
        </div>

        {/* 图表 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {viewMode === 'scatter' && scatterOption && <EChartsWrapper option={scatterOption} />}
          {viewMode === 'heatmap' && heatmapOption && <EChartsWrapper option={heatmapOption} />}
        </div>

        {/* 聚类详情 */}
        {data.cluster_count > 0 && (
          <div style={{
            marginTop: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: '8px',
            fontSize: '11px'
          }}>
            <div style={{ color: '#00ffff', marginBottom: '8px', fontWeight: 'bold' }}>
              聚类详情
            </div>
            {data.clusters.map((cluster, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px',
                  marginBottom: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                  borderLeft: '3px solid #00ff00'
                }}
              >
                <span style={{ color: '#00ff00', fontWeight: 'bold' }}>聚类{idx + 1}</span>
                <span style={{ color: '#888', marginLeft: '8px' }}>
                  ({cluster.length}个点): {cluster.map(i => data.points[i].point_id).join(', ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <CardBase
      cardId={cardId}
      title="🗺️ 空间关联分析"
      loading={loading}
    >
      {renderContent()}
    </CardBase>
  );
};
