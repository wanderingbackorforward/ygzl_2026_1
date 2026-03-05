import React, { useMemo } from 'react';
import type { PredictionResult } from '../../types/analysis';

interface RiskPoint {
  point_id: string;
  predicted_value: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  days_to_threshold: number;
  threshold: number;
}

interface RiskPointListProps {
  predictions: PredictionResult[];
  threshold?: number; // 沉降阈值（mm）
}

export const RiskPointList: React.FC<RiskPointListProps> = ({
  predictions,
  threshold = -30, // 默认阈值 -30mm
}) => {
  // 计算风险点位
  const riskPoints = useMemo(() => {
    const points: RiskPoint[] = [];

    predictions.forEach(pred => {
      if (!pred.success || pred.forecast.values.length === 0) return;

      // 找到最小预测值（最大沉降）
      const minValue = Math.min(...pred.forecast.values);
      const minIndex = pred.forecast.values.indexOf(minValue);

      // 计算风险等级
      let risk_level: RiskPoint['risk_level'] = 'low';
      if (minValue <= threshold) {
        risk_level = 'critical';
      } else if (minValue <= threshold * 0.8) {
        risk_level = 'high';
      } else if (minValue <= threshold * 0.6) {
        risk_level = 'medium';
      }

      // 计算到达阈值的天数
      let days_to_threshold = -1;
      for (let i = 0; i < pred.forecast.values.length; i++) {
        if (pred.forecast.values[i] <= threshold) {
          days_to_threshold = i + 1;
          break;
        }
      }

      // 只添加有风险的点位
      if (risk_level !== 'low' || days_to_threshold > 0) {
        points.push({
          point_id: pred.point_id,
          predicted_value: minValue,
          risk_level,
          days_to_threshold,
          threshold,
        });
      }
    });

    // 按风险等级和预测值排序
    return points.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (riskOrder[a.risk_level] !== riskOrder[b.risk_level]) {
        return riskOrder[a.risk_level] - riskOrder[b.risk_level];
      }
      return a.predicted_value - b.predicted_value;
    });
  }, [predictions, threshold]);

  if (riskPoints.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>
          <i className="fas fa-check-circle" />
        </div>
        <div style={styles.emptyTitle}>无高风险点位</div>
        <div style={styles.emptyMessage}>
          所有监测点的预测值均在安全范围内
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>高风险点位预警</h3>
        <div style={styles.subtitle}>
          共 {riskPoints.length} 个点位需要关注
        </div>
      </div>

      <div style={styles.list}>
        {riskPoints.map(point => (
          <div
            key={point.point_id}
            style={{
              ...styles.card,
              borderColor: riskLevelColor[point.risk_level],
            }}
          >
            <div style={styles.cardHeader}>
              <div style={styles.cardLeft}>
                <div style={styles.pointId}>{point.point_id}</div>
                <div
                  style={{
                    ...styles.riskBadge,
                    backgroundColor: riskLevelColor[point.risk_level],
                  }}
                >
                  {riskLevelText[point.risk_level]}
                </div>
              </div>
              <div style={styles.cardRight}>
                <div style={styles.predictedValue}>
                  {point.predicted_value.toFixed(2)} mm
                </div>
                <div style={styles.predictedLabel}>预测最大沉降</div>
              </div>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>
                  <i className="fas fa-exclamation-triangle" style={styles.infoIcon} />
                  阈值
                </span>
                <span style={styles.infoValue}>{point.threshold} mm</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>
                  <i className="fas fa-chart-line" style={styles.infoIcon} />
                  偏差
                </span>
                <span style={styles.infoValue}>
                  {(point.predicted_value - point.threshold).toFixed(2)} mm
                </span>
              </div>
              {point.days_to_threshold > 0 && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>
                    <i className="fas fa-clock" style={styles.infoIcon} />
                    预计超限
                  </span>
                  <span style={{ ...styles.infoValue, color: '#ff4d4f' }}>
                    {point.days_to_threshold} 天后
                  </span>
                </div>
              )}
            </div>

            <div style={styles.cardFooter}>
              <button style={styles.actionButton}>
                <i className="fas fa-chart-area" style={{ marginRight: '6px' }} />
                查看预测曲线
              </button>
              <button style={styles.secondaryButton}>
                <i className="fas fa-bell" style={{ marginRight: '6px' }} />
                设置预警
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const riskLevelText: Record<string, string> = {
  critical: '严重',
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

const riskLevelColor: Record<string, string> = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#ffa940',
  low: '#52c41a',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: '13px',
    color: '#888',
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '2px solid',
    transition: 'all 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pointId: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  riskBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#fff',
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  predictedValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ff7a45',
  },
  predictedLabel: {
    fontSize: '11px',
    color: '#888',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#888',
  },
  infoIcon: {
    fontSize: '12px',
    color: '#4a9eff',
  },
  infoValue: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#fff',
  },
  cardFooter: {
    display: 'flex',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(74, 158, 255, 0.2)',
  },
  actionButton: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#888',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '48px',
    color: '#52c41a',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#888',
  },
};
