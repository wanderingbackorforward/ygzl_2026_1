import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import {
  useJointMapping,
  useJointData,
  useJointAlerts,
  useJointCorrelation,
  createJointAlertTicket,
  type JointAlert,
} from '../../hooks/useAdvancedAnalysis';

interface JointDashboardProps {
  onSelectSettlementPoint?: (pointId: string) => void;
  metric?: 'settlement' | 'crack' | 'correlation';
}

export const JointDashboard: React.FC<JointDashboardProps> = ({ onSelectSettlementPoint, metric = 'settlement' }) => {
  const { mapping, loading: mappingLoading } = useJointMapping();
  const { alerts, loading: alertsLoading } = useJointAlerts();
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const { data: jointData, loading: dataLoading } = useJointData(selectedPoint);
  const { analysis: correlation, loading: correlationLoading } = useJointCorrelation(selectedPoint);
  const [creatingTickets, setCreatingTickets] = useState<Record<string, boolean>>({});

  // Get unique settlement points with crack associations
  const settlementPoints = useMemo(() => {
    const points = new Map<string, string[]>();
    mapping.forEach(m => {
      if (!points.has(m.settlement_point)) {
        points.set(m.settlement_point, []);
      }
      points.get(m.settlement_point)?.push(m.crack_point);
    });
    return Array.from(points.entries()).map(([point, cracks]) => ({
      point_id: point,
      crack_count: cracks.length,
      cracks,
    }));
  }, [mapping]);

  const handlePointSelect = (pointId: string) => {
    setSelectedPoint(pointId);
    onSelectSettlementPoint?.(pointId);
  };

  const handleCreateTicket = async (alert: JointAlert) => {
    const ticketKey = `${alert.settlement_point}-${alert.crack_point}`;
    if (creatingTickets[ticketKey]) return;
    const sendEmail = window.confirm('创建联合预警工单并发送邮件通知？\n确定=发送；取消=仅创建工单');
    setCreatingTickets(prev => ({ ...prev, [ticketKey]: true }));
    try {
      const result = await createJointAlertTicket(alert, sendEmail);
      window.alert(`工单创建成功\n工单号: ${result.data?.ticket_number || 'N/A'}`);
    } catch (e) {
      window.alert(`工单创建失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setCreatingTickets(prev => ({ ...prev, [ticketKey]: false }));
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>沉降 + 裂缝联合分析</h3>
        {alerts.length > 0 && (
          <div style={styles.alertBadge}>
            {alerts.length} 条联合预警
          </div>
        )}
      </div>

      <div style={styles.content}>
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>沉降点位</div>
          <div style={styles.pointList}>
            {mappingLoading ? (
              <div style={styles.loading}>加载中...</div>
            ) : (
              settlementPoints.map(p => {
                const hasAlert = alerts.some(a => a.settlement_point === p.point_id);
                return (
                  <div
                    key={p.point_id}
                    style={{
                      ...styles.pointItem,
                      ...(selectedPoint === p.point_id ? styles.pointItemSelected : {}),
                      ...(hasAlert ? styles.pointItemAlert : {}),
                    }}
                    onClick={() => handlePointSelect(p.point_id)}
                  >
                    <span style={styles.pointId}>{p.point_id}</span>
                    <span style={styles.crackCount}>{p.crack_count} 条裂缝</span>
                    {hasAlert && <span style={styles.alertDot} />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={styles.middlePanel}>
          {selectedPoint && jointData ? (
            <>
              <JointChart data={jointData} />
              {metric === 'correlation' && (
                <CorrelationPanel analysis={correlation} loading={correlationLoading} />
              )}
            </>
          ) : (
            <div style={styles.placeholder}>
              请选择沉降点位查看联合分析
            </div>
          )}
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.panelHeader}>联合预警</div>
          <div style={styles.alertList}>
            {alertsLoading ? (
              <div style={styles.loading}>加载中...</div>
            ) : alerts.length === 0 ? (
              <div style={styles.noAlerts}>暂无预警</div>
            ) : (
              alerts.map((alert, idx) => (
                <AlertCard
                  key={idx}
                  alert={alert}
                  onClick={() => handlePointSelect(alert.settlement_point)}
                  onCreateTicket={() => handleCreateTicket(alert)}
                  creating={creatingTickets[`${alert.settlement_point}-${alert.crack_point}`] === true}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Joint Chart component
const JointChart: React.FC<{ data: any }> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;
    const settlementData = data.settlement_data || [];
    const relatedCracks = data.related_cracks || [];

    // Prepare settlement series
    const settlementDates = settlementData.map((d: any) => d.measurement_date);
    const settlementValues = settlementData.map((d: any) => d.cumulative_change ?? d.value ?? 0);

    // Prepare crack series
    const crackSeries = relatedCracks.map((crack: any, idx: number) => {
      const crackData = crack.data || [];
      return {
        name: crack.crack_point,
        type: 'line',
        yAxisIndex: 1,
        data: crackData.map((d: any) => [d.measurement_date, d.value]),
        lineStyle: {
          width: 2,
          type: 'dashed',
        },
        symbol: 'circle',
        symbolSize: 4,
        smooth: true,
      };
    });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `${data.settlement_point} - 联合分析`,
        left: 'center',
        textStyle: { color: '#fff', fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 20, 40, 0.9)',
        borderColor: '#4a9eff',
        textStyle: { color: '#fff' },
      },
      legend: {
        bottom: 10,
        textStyle: { color: '#aaa', fontSize: 11 },
      },
      grid: {
        left: 60,
        right: 60,
        top: 50,
        bottom: 60,
      },
      xAxis: {
        type: 'category',
        data: settlementDates,
        axisLine: { lineStyle: { color: '#4a9eff' } },
        axisLabel: {
          color: '#aaa',
          rotate: 45,
          fontSize: 10,
          formatter: (value: string) => value.slice(5),
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '沉降（mm）',
          position: 'left',
          axisLine: { lineStyle: { color: '#4a9eff' } },
          axisLabel: { color: '#4a9eff' },
          splitLine: { lineStyle: { color: 'rgba(74, 158, 255, 0.2)' } },
        },
        {
          type: 'value',
          name: '裂缝宽度（mm）',
          position: 'right',
          axisLine: { lineStyle: { color: '#ff9800' } },
          axisLabel: { color: '#ff9800' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '沉降',
          type: 'line',
          yAxisIndex: 0,
          data: settlementValues,
          lineStyle: { width: 3, color: '#4a9eff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(74, 158, 255, 0.4)' },
              { offset: 1, color: 'rgba(74, 158, 255, 0.1)' },
            ]),
          },
          symbol: 'circle',
          symbolSize: 6,
          smooth: true,
        },
        ...crackSeries,
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height: '300px' }} />;
};

// Alert Card component
const AlertCard: React.FC<{ alert: JointAlert; onClick: () => void; onCreateTicket: () => void; creating: boolean }> = ({ alert, onClick, onCreateTicket, creating }) => {
  const severityColors: Record<string, string> = {
    critical: '#ff4444',
    high: '#ff8800',
    medium: '#ffcc00',
    low: '#88cc00',
  };
  const severityLabels: Record<string, string> = {
    critical: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };

  return (
    <div style={styles.alertCard} onClick={onClick}>
      <div style={styles.alertHeader}>
        <span
          style={{
            ...styles.severityBadge,
            backgroundColor: severityColors[alert.severity] || '#888',
          }}
        >
          {severityLabels[alert.severity] || alert.severity}
        </span>
        <span style={styles.alertPoints}>
          {alert.settlement_point} + {alert.crack_point}
        </span>
      </div>
      <div style={styles.alertMessage}>{alert.message}</div>
      <div style={styles.alertRecommendation}>{alert.recommendation}</div>
      <button
        style={styles.ticketButton}
        onClick={e => {
          e.stopPropagation();
          onCreateTicket();
        }}
        disabled={creating}
      >
        {creating ? '创建中...' : '创建工单'}
      </button>
    </div>
  );
};

const CorrelationPanel: React.FC<{
  analysis: {
    settlement_stats?: {
      total_change?: number;
      avg_daily_rate?: number;
      max_daily_rate?: number;
    };
    crack_analysis?: Array<{
      crack_point: string;
      correlation_strength: string;
      total_change: number;
      avg_rate: number;
    }>;
    error?: string;
  } | null;
  loading: boolean;
}> = ({ analysis, loading }) => {
  if (loading) return <div style={styles.correlationLoading}>相关性计算中...</div>;
  if (!analysis || analysis.error) return <div style={styles.correlationEmpty}>暂无相关性分析结果</div>;
  const stats = analysis.settlement_stats;
  const cracks = analysis.crack_analysis || [];

  return (
    <div style={styles.correlationPanel}>
      <div style={styles.correlationTitle}>相关性摘要</div>
      <div style={styles.correlationGrid}>
        <div style={styles.correlationItem}>
          <div style={styles.correlationValue}>{(stats?.total_change ?? 0).toFixed(3)}</div>
          <div style={styles.correlationLabel}>累计变化</div>
        </div>
        <div style={styles.correlationItem}>
          <div style={styles.correlationValue}>{(stats?.avg_daily_rate ?? 0).toFixed(4)}</div>
          <div style={styles.correlationLabel}>平均速率</div>
        </div>
        <div style={styles.correlationItem}>
          <div style={styles.correlationValue}>{(stats?.max_daily_rate ?? 0).toFixed(4)}</div>
          <div style={styles.correlationLabel}>最大日速率</div>
        </div>
      </div>
      <div style={styles.correlationCracks}>
        {cracks.slice(0, 4).map(c => (
          <div key={c.crack_point} style={styles.correlationCrackRow}>
            <span style={styles.correlationCrackName}>{c.crack_point}</span>
            <span style={styles.correlationCrackStrength}>{c.correlation_strength}</span>
            <span style={styles.correlationCrackRate}>{c.avg_rate.toFixed(4)} mm/次</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'rgba(20, 20, 40, 0.9)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.3)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    color: '#fff',
  },
  alertBadge: {
    padding: '4px 12px',
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
    border: '1px solid #ff4444',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#ff4444',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    width: '180px',
    borderRight: '1px solid rgba(74, 158, 255, 0.2)',
    display: 'flex',
    flexDirection: 'column',
  },
  middlePanel: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightPanel: {
    width: '280px',
    borderLeft: '1px solid rgba(74, 158, 255, 0.2)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    padding: '12px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#888',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
  },
  pointList: {
    flex: 1,
    overflowY: 'auto',
  },
  pointItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'background-color 0.2s',
  },
  pointItemSelected: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
  },
  pointItemAlert: {
    borderLeft: '3px solid #ff4444',
  },
  pointId: {
    color: '#fff',
    fontWeight: 'bold',
  },
  crackCount: {
    color: '#888',
    fontSize: '12px',
  },
  alertDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ff4444',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#888',
  },
  placeholder: {
    color: '#666',
    fontSize: '14px',
  },
  alertList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  noAlerts: {
    padding: '20px',
    textAlign: 'center',
    color: '#666',
  },
  alertCard: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    border: '1px solid rgba(255, 68, 68, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  severityBadge: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
  },
  alertPoints: {
    fontSize: '12px',
    color: '#fff',
  },
  alertMessage: {
    fontSize: '12px',
    color: '#ccc',
    marginBottom: '6px',
  },
  alertRecommendation: {
    fontSize: '11px',
    color: '#888',
    fontStyle: 'italic',
  },
  ticketButton: {
    marginTop: '8px',
    width: '100%',
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(74, 255, 158, 0.5)',
    backgroundColor: 'rgba(74, 255, 158, 0.15)',
    color: '#4aff9e',
    cursor: 'pointer',
    fontSize: '12px',
  },
  correlationPanel: {
    marginTop: '12px',
    width: '100%',
    border: '1px solid rgba(74, 158, 255, 0.25)',
    borderRadius: '6px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    padding: '12px',
  },
  correlationTitle: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  correlationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    marginBottom: '10px',
  },
  correlationItem: {
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '4px',
    padding: '8px',
    textAlign: 'center',
  },
  correlationValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  correlationLabel: {
    color: '#888',
    fontSize: '11px',
    marginTop: '2px',
  },
  correlationCracks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  correlationCrackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(40, 40, 60, 0.6)',
    borderRadius: '4px',
    padding: '6px 8px',
  },
  correlationCrackName: {
    color: '#fff',
    minWidth: '46px',
    fontWeight: 'bold',
  },
  correlationCrackStrength: {
    color: '#4a9eff',
    fontSize: '11px',
    textTransform: 'uppercase',
  },
  correlationCrackRate: {
    marginLeft: 'auto',
    color: '#aaa',
    fontSize: '11px',
  },
  correlationLoading: {
    marginTop: '12px',
    color: '#888',
    fontSize: '12px',
  },
  correlationEmpty: {
    marginTop: '12px',
    color: '#666',
    fontSize: '12px',
  },
};

export default JointDashboard;
