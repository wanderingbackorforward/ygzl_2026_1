import React, { useMemo } from 'react';
import type { Recommendation } from '../../types/analysis';
import { RecommendationCard } from './RecommendationCard';

interface RecommendationListProps {
  recommendations: Recommendation[];
}

export const RecommendationList: React.FC<RecommendationListProps> = ({ recommendations }) => {
  // 按优先级排序
  const sortedRecommendations = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...recommendations].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }, [recommendations]);

  // 按优先级分组
  const groupedRecommendations = useMemo(() => {
    const groups = {
      urgent: [] as Recommendation[],
      high: [] as Recommendation[],
      medium: [] as Recommendation[],
      low: [] as Recommendation[],
    };

    sortedRecommendations.forEach(rec => {
      groups[rec.priority].push(rec);
    });

    return groups;
  }, [sortedRecommendations]);

  if (recommendations.length === 0) {
    return (
      <div style={styles.empty}>
        <i className="fas fa-check-circle" style={styles.emptyIcon} />
        <div style={styles.emptyText}>暂无处置建议</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 紧急建议 */}
      {groupedRecommendations.urgent.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <i className="fas fa-exclamation-triangle" style={styles.sectionIcon} />
            <h3 style={styles.sectionTitle}>紧急建议 ({groupedRecommendations.urgent.length})</h3>
          </div>
          <div style={styles.list}>
            {groupedRecommendations.urgent.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* 高优先级建议 */}
      {groupedRecommendations.high.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <i className="fas fa-exclamation" style={styles.sectionIcon} />
            <h3 style={styles.sectionTitle}>高优先级建议 ({groupedRecommendations.high.length})</h3>
          </div>
          <div style={styles.list}>
            {groupedRecommendations.high.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* 中优先级建议 */}
      {groupedRecommendations.medium.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <i className="fas fa-info-circle" style={styles.sectionIcon} />
            <h3 style={styles.sectionTitle}>中优先级建议 ({groupedRecommendations.medium.length})</h3>
          </div>
          <div style={styles.list}>
            {groupedRecommendations.medium.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* 低优先级建议 */}
      {groupedRecommendations.low.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <i className="fas fa-check-circle" style={styles.sectionIcon} />
            <h3 style={styles.sectionTitle}>低优先级建议 ({groupedRecommendations.low.length})</h3>
          </div>
          <div style={styles.list}>
            {groupedRecommendations.low.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '16px',
    color: '#4a9eff',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '16px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '48px',
    color: 'rgba(74, 158, 255, 0.3)',
  },
  emptyText: {
    fontSize: '16px',
    color: '#fff',
  },
};
