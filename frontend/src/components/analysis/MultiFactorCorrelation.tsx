import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { fetchMultiFactorCorrelation } from '../../utils/apiClient';

interface FactorPair {
  factor_x: string;
  factor_y: string;
  correlation: number;
  p_value: number;
  sample_size: number;
  interpretation: string;
}

interface MultiFactorData {
  success: boolean;
  mock?: boolean;
  factors: string[];
  correlation_matrix: number[][];
  factor_pairs: FactorPair[];
  data_summary: {
    settlement_points: number;
    temperature_sensors: number;
    crack_points: number;
    date_range: string[];
    merged_records?: number;
  };
}

const FACTOR_LABELS: Record<string, string> = {
  settlement: '沉降',
  temperature: '温度',
  crack_width: '裂缝宽度',
};

export const MultiFactorCorrelation: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [data, setData] = useState<MultiFactorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMultiFactorCorrelation();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 渲染热力图
  useEffect(() => {
    if (!chartRef.current || !data || !data.correlation_matrix) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;
    const labels = data.factors.map(f => FACTOR_LABELS[f] || f);
    const heatmapData: [number, number, number][] = [];

    data.correlation_matrix.forEach((row, i) => {
      row.forEach((value, j) => {
        heatmapData.push([j, i, value]);
      });
    });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: '多因素相关性矩阵',
        subtext: data.mock ? '(演示数据)' : `基于 ${data.data_summary.merged_records || '-'} 条对齐记录`,
        left: 'center',
        textStyle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
        subtextStyle: { color: '#e2e8f0', fontSize: 12 },
      },
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(20, 20, 40, 0.95)',
        borderColor: 'rgba(74, 158, 255, 0.3)',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const [x, y, value] = params.data;
          return `${labels[y]} - ${labels[x]}<br/>相关系数 r = ${value.toFixed(4)}`;
        },
      },
      grid: { left: '15%', right: '12%', bottom: '18%', top: 80, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: true },
        axisLabel: { color: '#fff', fontSize: 14 },
      },
      yAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: true },
        axisLabel: { color: '#fff', fontSize: 14 },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '3%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
        },
        textStyle: { color: '#fff' },
      },
      series: [
        {
          name: '相关系数',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
            formatter: (params: any) => params.data[2].toFixed(2),
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
          },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  const getStrengthColor = (r: number) => {
    const abs = Math.abs(r);
    if (abs >= 0.7) return '#d73027';
    if (abs >= 0.4) return '#ffa940';
    if (abs >= 0.2) return '#52c41a';
    return '#8c8c8c';
  };

  const getStrengthLabel = (r: number) => {
    const abs = Math.abs(r);
    if (abs >= 0.7) return '强相关';
    if (abs >= 0.4) return '中等相关';
    if (abs >= 0.2) return '弱相关';
    return '极弱相关';
  };

  const getSignificanceLabel = (p: number) => {
    if (p < 0.001) return '极显著***';
    if (p < 0.01) return '显著**';
    if (p < 0.05) return '显著*';
    return '不显著';
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <div style={styles.loadingText}>正在计算多因素相关性...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <i className="fas fa-exclamation-circle" style={{ fontSize: '48px', color: '#ff4d4f' }} />
        <div style={styles.errorText}>{error}</div>
        <button style={styles.retryButton} onClick={loadData}>
          <i className="fas fa-redo" style={{ marginRight: '6px' }} />
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={styles.container}>
      {/* 数据概况统计卡片 */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <i className="fas fa-ruler-vertical" style={{ fontSize: '24px', color: '#4a9eff' }} />
          <div style={styles.summaryContent}>
            <div style={styles.summaryValue}>{data.data_summary.settlement_points}</div>
            <div style={styles.summaryLabel}>沉降监测点</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <i className="fas fa-thermometer-half" style={{ fontSize: '24px', color: '#ff7a45' }} />
          <div style={styles.summaryContent}>
            <div style={styles.summaryValue}>{data.data_summary.temperature_sensors}</div>
            <div style={styles.summaryLabel}>温度传感器</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <i className="fas fa-expand-alt" style={{ fontSize: '24px', color: '#ffa940' }} />
          <div style={styles.summaryContent}>
            <div style={styles.summaryValue}>{data.data_summary.crack_points}</div>
            <div style={styles.summaryLabel}>裂缝监测点</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <i className="fas fa-calendar-alt" style={{ fontSize: '24px', color: '#52c41a' }} />
          <div style={styles.summaryContent}>
            <div style={styles.summaryValue}>
              {data.data_summary.date_range.length === 2
                ? `${data.data_summary.date_range[0].slice(5)} ~ ${data.data_summary.date_range[1].slice(5)}`
                : '-'}
            </div>
            <div style={styles.summaryLabel}>数据时间范围</div>
          </div>
        </div>
      </div>

      {data.mock && (
        <div style={styles.mockBanner}>
          <i className="fas fa-info-circle" style={{ marginRight: '8px' }} />
          当前显示演示数据，实际数据不足时自动回退
        </div>
      )}

      {/* 热力图 */}
      <div style={styles.chartContainer}>
        <div ref={chartRef} style={{ width: '100%', height: '420px' }} />
      </div>

      {/* 因素对详情 */}
      <div style={styles.pairsContainer}>
        <h3 style={styles.pairsTitle}>
          <i className="fas fa-link" style={{ marginRight: '8px', color: '#4a9eff' }} />
          因素关联详情
        </h3>
        <div style={styles.pairsList}>
          {data.factor_pairs.map((pair, idx) => (
            <div key={idx} style={styles.pairCard}>
              <div style={styles.pairHeader}>
                <div style={styles.pairFactors}>
                  <span style={styles.factorTag}>{FACTOR_LABELS[pair.factor_x] || pair.factor_x}</span>
                  <i className="fas fa-arrows-alt-h" style={{ color: '#fff', margin: '0 8px' }} />
                  <span style={styles.factorTag}>{FACTOR_LABELS[pair.factor_y] || pair.factor_y}</span>
                </div>
                <div style={{ ...styles.strengthBadge, backgroundColor: `${getStrengthColor(pair.correlation)}30`, borderColor: getStrengthColor(pair.correlation), color: getStrengthColor(pair.correlation) }}>
                  {getStrengthLabel(pair.correlation)}
                </div>
              </div>

              <div style={styles.pairMetrics}>
                <div style={styles.metric}>
                  <div style={styles.metricLabel}>相关系数 r</div>
                  <div style={{ ...styles.metricValue, color: getStrengthColor(pair.correlation) }}>
                    {pair.correlation >= 0 ? '+' : ''}{pair.correlation.toFixed(4)}
                  </div>
                </div>
                <div style={styles.metric}>
                  <div style={styles.metricLabel}>显著性 P</div>
                  <div style={styles.metricValue}>
                    {pair.p_value < 0.001 ? '<0.001' : pair.p_value.toFixed(4)}
                    <span style={{ marginLeft: '4px', color: pair.p_value < 0.05 ? '#52c41a' : '#ff4d4f' }}>
                      {getSignificanceLabel(pair.p_value)}
                    </span>
                  </div>
                </div>
                <div style={styles.metric}>
                  <div style={styles.metricLabel}>样本量</div>
                  <div style={styles.metricValue}>{pair.sample_size}</div>
                </div>
              </div>

              <div style={styles.pairInterpretation}>
                <i className="fas fa-lightbulb" style={{ color: '#ffa940', marginRight: '8px', flexShrink: 0 }} />
                {pair.interpretation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  summaryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#e2e8f0',
  },
  mockBanner: {
    padding: '10px 16px',
    backgroundColor: 'rgba(255, 169, 64, 0.15)',
    border: '1px solid rgba(255, 169, 64, 0.4)',
    borderRadius: '6px',
    color: '#ffa940',
    fontSize: '13px',
  },
  chartContainer: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  pairsContainer: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  pairsTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  pairsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  pairCard: {
    padding: '16px',
    backgroundColor: 'rgba(20, 20, 40, 0.7)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.15)',
  },
  pairHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  pairFactors: {
    display: 'flex',
    alignItems: 'center',
  },
  factorTag: {
    padding: '4px 12px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
  },
  strengthBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    border: '1px solid',
  },
  pairMetrics: {
    display: 'flex',
    gap: '24px',
    marginBottom: '12px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricLabel: {
    fontSize: '12px',
    color: '#e2e8f0',
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  pairInterpretation: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 169, 64, 0.08)',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#fff',
    lineHeight: '1.5',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(74, 158, 255, 0.2)',
    borderTop: '4px solid #4a9eff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: '#fff',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '12px',
  },
  errorText: {
    fontSize: '14px',
    color: '#fff',
  },
  retryButton: {
    marginTop: '8px',
    padding: '10px 20px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};
