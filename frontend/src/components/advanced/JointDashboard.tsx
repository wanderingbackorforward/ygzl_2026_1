import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { useJointMapping, useJointData, useJointAlerts, type JointAlert } from '../../hooks/useAdvancedAnalysis';

interface JointDashboardProps {
  onSelectSettlementPoint?: (pointId: string) => void;
}

export const JointDashboard: React.FC<JointDashboardProps> = ({ onSelectSettlementPoint }) => {
  const { mapping, loading: mappingLoading } = useJointMapping();
  const { alerts, loading: alertsLoading } = useJointAlerts();
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const { data: jointData, loading: dataLoading } = useJointData(selectedPoint);

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

  return (
    <div style={styles.container}>
      {/* Header with alerts */}
      <div style={styles.header}>
        <h3 style={styles.title}>Settlement + Crack Joint Analysis</h3>
        {alerts.length > 0 && (
          <div style={styles.alertBadge}>
            {alerts.length} Joint Alert{alerts.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div style={styles.content}>
        {/* Left panel: Point selector */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>Settlement Points</div>
          <div style={styles.pointList}>
            {mappingLoading ? (
              <div style={styles.loading}>Loading...</div>
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
                    <span style={styles.crackCount}>{p.crack_count} cracks</span>
                    {hasAlert && <span style={styles.alertDot} />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Middle panel: Charts */}
        <div style={styles.middlePanel}>
          {selectedPoint && jointData ? (
            <>
              <JointChart data={jointData} />
            </>
          ) : (
            <div style={styles.placeholder}>
              Select a settlement point to view joint analysis
            </div>
          )}
        </div>

        {/* Right panel: Alerts */}
        <div style={styles.rightPanel}>
          <div style={styles.panelHeader}>Joint Alerts</div>
          <div style={styles.alertList}>
            {alertsLoading ? (
              <div style={styles.loading}>Loading...</div>
            ) : alerts.length === 0 ? (
              <div style={styles.noAlerts}>No active alerts</div>
            ) : (
              alerts.map((alert, idx) => (
                <AlertCard
                  key={idx}
                  alert={alert}
                  onClick={() => handlePointSelect(alert.settlement_point)}
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
        text: `${data.settlement_point} - Joint Analysis`,
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
          name: 'Settlement (mm)',
          position: 'left',
          axisLine: { lineStyle: { color: '#4a9eff' } },
          axisLabel: { color: '#4a9eff' },
          splitLine: { lineStyle: { color: 'rgba(74, 158, 255, 0.2)' } },
        },
        {
          type: 'value',
          name: 'Crack Width (mm)',
          position: 'right',
          axisLine: { lineStyle: { color: '#ff9800' } },
          axisLabel: { color: '#ff9800' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Settlement',
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
const AlertCard: React.FC<{ alert: JointAlert; onClick: () => void }> = ({ alert, onClick }) => {
  const severityColors: Record<string, string> = {
    critical: '#ff4444',
    high: '#ff8800',
    medium: '#ffcc00',
    low: '#88cc00',
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
          {alert.severity.toUpperCase()}
        </span>
        <span style={styles.alertPoints}>
          {alert.settlement_point} + {alert.crack_point}
        </span>
      </div>
      <div style={styles.alertMessage}>{alert.message}</div>
      <div style={styles.alertRecommendation}>{alert.recommendation}</div>
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
};

export default JointDashboard;
