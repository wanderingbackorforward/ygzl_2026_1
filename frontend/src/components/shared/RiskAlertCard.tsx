import React from 'react';
import { useRiskAlerts } from '../../hooks/useSettlementData';
import type { CardComponentProps } from '../../types/layout';
import { NEON_COLORS } from '../charts/cyberpunkTheme';

interface RiskAlertCardProps extends CardComponentProps {
  onSelectPoint?: (pointId: string) => void;
}

const riskLevelConfig: Record<string, { label: string; color: string; textColor: string }> = {
  critical: { label: '严重', color: NEON_COLORS.warning, textColor: '#fff' },
  high: { label: '高风险', color: NEON_COLORS.orange, textColor: '#fff' },
  medium: { label: '中风险', color: '#ffeb3b', textColor: '#000' },
  low: { label: '低风险', color: NEON_COLORS.success, textColor: '#fff' },
  normal: { label: '正常', color: NEON_COLORS.primary, textColor: '#fff' }
};

export const RiskAlertCard: React.FC<RiskAlertCardProps> = ({ onSelectPoint }) => {
  const { data, loading, error } = useRiskAlerts();

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.noData}>暂无数据</div>
      </div>
    );
  }

  const { alerts, stats } = data;

  return (
    <div style={styles.container}>
      {/* Stats Overview */}
      <div style={styles.statsGrid}>
        <div style={{ ...styles.statItem, borderColor: NEON_COLORS.warning }}>
          <div style={{ ...styles.statValue, color: NEON_COLORS.warning }}>{stats.critical}</div>
          <div style={styles.statLabel}>严重</div>
        </div>
        <div style={{ ...styles.statItem, borderColor: NEON_COLORS.orange }}>
          <div style={{ ...styles.statValue, color: NEON_COLORS.orange }}>{stats.high}</div>
          <div style={styles.statLabel}>高风险</div>
        </div>
        <div style={{ ...styles.statItem, borderColor: '#ffeb3b' }}>
          <div style={{ ...styles.statValue, color: '#ffeb3b' }}>{stats.medium}</div>
          <div style={styles.statLabel}>中风险</div>
        </div>
        <div style={{ ...styles.statItem, borderColor: NEON_COLORS.success }}>
          <div style={{ ...styles.statValue, color: NEON_COLORS.success }}>{stats.low + stats.normal}</div>
          <div style={styles.statLabel}>正常</div>
        </div>
      </div>

      {/* Alert List */}
      <div style={styles.alertList}>
        {alerts.length === 0 ? (
          <div style={styles.noAlerts}>
            <span style={{ color: NEON_COLORS.success, fontSize: 24 }}>[OK]</span>
            <span style={{ marginLeft: 8 }}>所有监测点状态正常</span>
          </div>
        ) : (
          alerts.slice(0, 5).map((alert, index) => {
            const config = riskLevelConfig[alert.risk_level] || riskLevelConfig.normal;
            return (
              <div
                key={alert.point_id}
                style={{
                  ...styles.alertItem,
                  borderLeftColor: config.color,
                  animationDelay: `${index * 0.1}s`
                }}
                onClick={() => onSelectPoint?.(alert.point_id)}
              >
                <div style={styles.alertHeader}>
                  <span style={styles.pointId}>{alert.point_id}</span>
                  <span style={{
                    ...styles.riskBadge,
                    background: config.color,
                    color: config.textColor
                  }}>
                    {config.label}
                  </span>
                </div>
                <div style={styles.alertDetails}>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>斜率:</span>
                    <span style={{
                      ...styles.detailValue,
                      color: alert.trend_slope < -0.05 ? NEON_COLORS.warning :
                             alert.trend_slope < 0 ? NEON_COLORS.orange : NEON_COLORS.success
                    }}>
                      {alert.trend_slope.toFixed(4)} mm/天
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>30天预测:</span>
                    <span style={{
                      ...styles.detailValue,
                      color: alert.predicted_change_30d < -1 ? NEON_COLORS.warning : '#aaa'
                    }}>
                      {alert.predicted_change_30d > 0 ? '+' : ''}{alert.predicted_change_30d.toFixed(2)} mm
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>R^2:</span>
                    <span style={styles.detailValue}>{alert.r_squared.toFixed(4)}</span>
                  </div>
                </div>
                {alert.warnings && alert.warnings !== '[]' && (
                  <div style={styles.warnings}>
                    {alert.warnings.replace(/[[\]']/g, '').split(',').map((w, i) => (
                      <span key={i} style={styles.warningTag}>{w.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {alerts.length > 5 && (
        <div style={styles.moreAlerts}>
          还有 {alerts.length - 5} 个预警...
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    overflow: 'hidden'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888'
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: NEON_COLORS.warning
  },
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
    marginBottom: 12
  },
  statItem: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    padding: '8px 4px',
    textAlign: 'center',
    borderLeft: '3px solid',
    borderLeftColor: NEON_COLORS.primary
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 1.2
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2
  },
  alertList: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  noAlerts: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: NEON_COLORS.success,
    fontSize: 14
  },
  alertItem: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    padding: 10,
    borderLeft: '3px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    animation: 'fadeIn 0.3s ease forwards'
  },
  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  pointId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: NEON_COLORS.primary
  },
  riskBadge: {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold'
  },
  alertDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
    fontSize: 11
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'column'
  },
  detailLabel: {
    color: '#666',
    fontSize: 9
  },
  detailValue: {
    color: '#aaa',
    fontFamily: 'monospace'
  },
  warnings: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6
  },
  warningTag: {
    background: 'rgba(255, 62, 95, 0.2)',
    color: NEON_COLORS.warning,
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 9
  },
  moreAlerts: {
    textAlign: 'center',
    padding: 8,
    color: '#666',
    fontSize: 11
  }
};

export default RiskAlertCard;
