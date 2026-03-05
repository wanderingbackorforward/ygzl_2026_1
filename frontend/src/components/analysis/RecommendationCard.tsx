import React from 'react';
import type { Recommendation } from '../../types/analysis';
import {
  priorityText,
  priorityColor,
  actionText,
  actionIcon,
} from '../../utils/analysis';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
  return (
    <div
      style={{
        ...styles.card,
        borderColor: priorityColor[recommendation.priority],
      }}
    >
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div
            style={{
              ...styles.priorityBadge,
              backgroundColor: priorityColor[recommendation.priority],
            }}
          >
            {priorityText[recommendation.priority]}
          </div>
          <div
            style={{
              ...styles.actionBadge,
            }}
          >
            <i className={`fas fa-${actionIcon[recommendation.action]}`} style={styles.actionIcon} />
            {actionText[recommendation.action]}
          </div>
        </div>
        {recommendation.estimated_time && (
          <div style={styles.time}>
            <i className="fas fa-clock" style={styles.timeIcon} />
            {recommendation.estimated_time}
          </div>
        )}
      </div>

      <div style={styles.content}>
        <h3 style={styles.title}>{recommendation.title}</h3>
        <p style={styles.reason}>{recommendation.reason}</p>

        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>
              <i className="fas fa-map-marker-alt" style={styles.detailIcon} />
              涉及点位
            </span>
            <span style={styles.detailValue}>
              {recommendation.point_ids.length} 个
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>
              <i className="fas fa-exclamation-circle" style={styles.detailIcon} />
              关联异常
            </span>
            <span style={styles.detailValue}>
              {recommendation.related_anomalies.length} 个
            </span>
          </div>
        </div>

        <div style={styles.pointList}>
          {recommendation.point_ids.slice(0, 5).map(pointId => (
            <span key={pointId} style={styles.pointTag}>
              {pointId}
            </span>
          ))}
          {recommendation.point_ids.length > 5 && (
            <span style={styles.pointMore}>
              +{recommendation.point_ids.length - 5}
            </span>
          )}
        </div>
      </div>

      <div style={styles.footer}>
        <button style={styles.actionButton}>
          <i className="fas fa-check" style={{ marginRight: '6px' }} />
          标记为已处理
        </button>
        <button style={styles.detailButton}>
          查看详情
          <i className="fas fa-chevron-right" style={{ marginLeft: '6px' }} />
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '20px',
    borderRadius: '8px',
    border: '2px solid',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    transition: 'all 0.2s',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  priorityBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
  },
  actionBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    color: '#4a9eff',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  actionIcon: {
    fontSize: '11px',
  },
  time: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#888',
  },
  timeIcon: {
    fontSize: '11px',
  },
  content: {
    marginBottom: '16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  reason: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: '#aaa',
    lineHeight: 1.6,
  },
  details: {
    display: 'flex',
    gap: '24px',
    marginBottom: '12px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  detailLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    color: '#888',
  },
  detailIcon: {
    fontSize: '11px',
    color: '#4a9eff',
  },
  detailValue: {
    fontSize: '13px',
    color: '#fff',
    fontWeight: '500',
  },
  pointList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  pointTag: {
    padding: '4px 10px',
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#4a9eff',
  },
  pointMore: {
    padding: '4px 10px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#888',
  },
  footer: {
    display: 'flex',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(74, 158, 255, 0.2)',
  },
  actionButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButton: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#888',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
  },
};
