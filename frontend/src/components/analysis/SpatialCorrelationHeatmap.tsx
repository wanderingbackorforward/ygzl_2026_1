import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface SpatialCorrelationData {
  success: boolean;
  points: Array<{
    point_id: string;
    x: number;
    y: number;
  }>;
  correlation_matrix: number[][];
  adjacency_matrix: number[][];
  clusters: number[][];
  cluster_count: number;
}

interface SpatialCorrelationHeatmapProps {
  data: SpatialCorrelationData;
  height?: number;
}

export const SpatialCorrelationHeatmap: React.FC<SpatialCorrelationHeatmapProps> = ({
  data,
  height = 500,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || !data.correlation_matrix) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // 准备热力图数据
    const pointIds = data.points.map(p => p.point_id);
    const heatmapData: [number, number, number][] = [];

    data.correlation_matrix.forEach((row, i) => {
      row.forEach((value, j) => {
        heatmapData.push([j, i, value]);
      });
    });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: '空间相关性矩阵',
        subtext: `发现 ${data.cluster_count} 个空间聚类`,
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
        position: 'top',
        backgroundColor: 'rgba(20, 20, 40, 0.95)',
        borderColor: 'rgba(74, 158, 255, 0.3)',
        textStyle: {
          color: '#fff',
        },
        formatter: (params: any) => {
          const [x, y, value] = params.data;
          return `${pointIds[y]} - ${pointIds[x]}<br/>相关系数: ${value.toFixed(3)}`;
        },
      },
      grid: {
        left: '10%',
        right: '10%',
        bottom: '10%',
        top: 80,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: pointIds,
        splitArea: {
          show: true,
        },
        axisLabel: {
          color: '#fff',
          rotate: 45,
        },
      },
      yAxis: {
        type: 'category',
        data: pointIds,
        splitArea: {
          show: true,
        },
        axisLabel: {
          color: '#fff',
        },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
        },
        textStyle: {
          color: '#fff',
        },
      },
      series: [
        {
          name: '相关系数',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
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
  }, [data]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  if (!data || !data.correlation_matrix) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyMessage}>暂无空间相关性数据</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />

      {/* 聚类信息 */}
      {data.clusters && data.clusters.length > 0 && (
        <div style={styles.clustersContainer}>
          <div style={styles.clustersHeader}>
            <h3 style={styles.clustersTitle}>空间聚类</h3>
            <div style={styles.clustersSubtitle}>
              相关性高且距离近的点位群
            </div>
          </div>

          <div style={styles.clustersList}>
            {data.clusters.map((cluster, index) => (
              <div key={index} style={styles.clusterCard}>
                <div style={styles.clusterHeader}>
                  <div style={styles.clusterBadge}>聚类 {index + 1}</div>
                  <div style={styles.clusterCount}>{cluster.length} 个点位</div>
                </div>
                <div style={styles.clusterPoints}>
                  {cluster.map(pointIndex => (
                    <span key={pointIndex} style={styles.pointTag}>
                      {data.points[pointIndex].point_id}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 说明 */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendColor, backgroundColor: '#a50026' }} />
          <span style={styles.legendText}>强正相关 (0.7 ~ 1.0)</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendColor, backgroundColor: '#ffffbf' }} />
          <span style={styles.legendText}>弱相关 (-0.3 ~ 0.3)</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendColor, backgroundColor: '#313695' }} />
          <span style={styles.legendText}>强负相关 (-1.0 ~ -0.7)</span>
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
  clustersContainer: {
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  clustersHeader: {
    marginBottom: '16px',
  },
  clustersTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  clustersSubtitle: {
    fontSize: '12px',
    color: '#fff',
    marginTop: '4px',
  },
  clustersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  clusterCard: {
    padding: '12px',
    backgroundColor: 'rgba(20, 20, 40, 0.6)',
    borderRadius: '6px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  clusterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  clusterBadge: {
    padding: '4px 10px',
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#4a9eff',
  },
  clusterCount: {
    fontSize: '12px',
    color: '#fff',
  },
  clusterPoints: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  pointTag: {
    padding: '4px 8px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#fff',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    padding: '12px',
    backgroundColor: 'rgba(30, 30, 50, 0.4)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.1)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendColor: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  legendText: {
    fontSize: '12px',
    color: '#fff',
  },
  emptyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#fff',
  },
};
