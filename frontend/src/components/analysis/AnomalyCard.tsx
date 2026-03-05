import React from 'react';
import type { Anomaly } from '../../types/analysis';
import {
  severityText,
  severityColor,
  severityBgColor,
  anomalyTypeText,
  anomalyTypeIcon,
  formatDate,
  formatRelativeTime,
} from '../../utils/analysis';

interface AnomalyCardProps {
  anomaly: Anomaly;
  onClick?: () => void;
}

export const AnomalyCard: React.FC<AnomalyCardProps> = ({ anomaly, onClick }) => {
  return (
    <div
      style={{
        ...styles.card,
        borderColor: severityColor[anomaly.severity],
        backgroundColor: severityBgColor[anomaly.severity],
      }}
      onClick={onClick}
    >
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.pointId}>{anomaly.point_id}</div>
          <div style={styles.date}>
            {formatDate(anomaly.date)} ({formatRelativeTime(anomaly.date)})
          </div>
        </div>
        <div
          style={{
            ...styles.severityBadge,
            backgroundColor: severityColor[anomaly.severity],
          }}
        >
          {severityText[anomaly.severity]}
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.row}>
          <div style={styles.label}>
            <i className={`fas fa-${anomalyTypeIcon[anomaly.anomaly_type]}`} style={styles.icon} />
            异常类型
          </div>
          <div style={styles.value}>{anomalyTypeText[anomaly.anomaly_type]}</div>
        </div>

        <div style={styles.row}>
          <div style={styles.label}>
            <i className="fas fa-arrow-down" style={styles.icon} />
            沉降值
          </div>
          <div style={styles.value}>{anomaly.settlement.toFixed(2)} mm</div>
        </div>

        <div style={styles.row}>
          <div style={styles.label}>
            <i className="fas fa-exclamation-triangle" style={styles.icon} />
            异常分数
          </div>
          <div style={styles.value}>{anomaly.anomaly_score.toFixed(3)}</div>
        </div>
      </div>

      {onClick && (
        <div style={styles.footer}>
          <span style={styles.viewDetail}>
            查看详情 <i className="fas fa-chevron-right" />
          </span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '16px',
    borderRadius: '8px',
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  headerLeft: {
    flex: 1,
  },
  pointId: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '4px',
  },
  date: {
    fontSize: '12px',
    color: '#888',
  },
  severityBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#aaa',
  },
  icon: {
    fontSize: '12px',
    color: '#4a9eff',
  },
  value: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
  },
  footer: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(74, 158, 255, 0.2)',
  },
  viewDetail: {
    fontSize: '13px',
    color: '#4a9eff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};
