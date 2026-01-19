/**
 * 二级数据分析 Tab 组件
 * 显示异常列表和处置建议
 */

import React, { useState } from 'react';
import { useSettlementAnalysisV2 } from '../../hooks/useSecondaryData';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  ANOMALY_TYPE_LABELS,
} from '../../types/analysis-v2';
import type { AnomalyItem, Recommendation, SeverityLevel } from '../../types/analysis-v2';

interface SecondaryDataTabProps {
  onSelectPoint?: (pointId: string) => void;
  onCreateTicket?: (anomaly: AnomalyItem) => void;
}

type TabType = 'anomalies' | 'recommendations';

export const SecondaryDataTab: React.FC<SecondaryDataTabProps> = ({
  onSelectPoint,
  onCreateTicket,
}) => {
  const { data, loading, error, refetch } = useSettlementAnalysisV2();
  const [activeTab, setActiveTab] = useState<TabType>('anomalies');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>加载二级分析数据...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <span style={styles.errorIcon}>[X]</span>
          <span>{error}</span>
          <button onClick={refetch} style={styles.retryButton}>
            重试
          </button>
        </div>
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

  const { stats, anomalies, recommendations, summary } = data;

  // 过滤异常
  const filteredAnomalies =
    severityFilter === 'all'
      ? anomalies
      : anomalies.filter((a) => a.severity === severityFilter);

  return (
    <div style={styles.container}>
      {/* 统计概览 */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>总点数</span>
          <span style={styles.statValue}>{stats.total_points}</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>异常数</span>
          <span style={{ ...styles.statValue, color: stats.anomaly_count > 0 ? '#ff7a45' : '#73d13d' }}>
            {stats.anomaly_count}
          </span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>严重</span>
          <span style={{ ...styles.statValue, color: SEVERITY_COLORS.critical }}>
            {stats.critical_count}
          </span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>高风险</span>
          <span style={{ ...styles.statValue, color: SEVERITY_COLORS.high }}>
            {stats.high_count}
          </span>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'anomalies' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setActiveTab('anomalies')}
        >
          异常列表 ({anomalies.length})
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'recommendations' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setActiveTab('recommendations')}
        >
          处置建议 ({recommendations.length})
        </button>
      </div>

      {/* 内容区域 */}
      <div style={styles.content}>
        {activeTab === 'anomalies' ? (
          <AnomalyList
            anomalies={filteredAnomalies}
            severityFilter={severityFilter}
            onFilterChange={setSeverityFilter}
            onSelectPoint={onSelectPoint}
            onCreateTicket={onCreateTicket}
          />
        ) : (
          <RecommendationList recommendations={recommendations} />
        )}
      </div>

      {/* 分析时间 */}
      <div style={styles.footer}>
        分析时间: {new Date(data.analysis_time).toLocaleString('zh-CN')}
        <button onClick={refetch} style={styles.refreshButton}>
          刷新
        </button>
      </div>
    </div>
  );
};

// 异常列表子组件
const AnomalyList: React.FC<{
  anomalies: AnomalyItem[];
  severityFilter: SeverityLevel | 'all';
  onFilterChange: (filter: SeverityLevel | 'all') => void;
  onSelectPoint?: (pointId: string) => void;
  onCreateTicket?: (anomaly: AnomalyItem) => void;
}> = ({ anomalies, severityFilter, onFilterChange, onSelectPoint, onCreateTicket }) => {
  return (
    <>
      {/* 过滤器 */}
      <div style={styles.filterBar}>
        <span style={styles.filterLabel}>严重程度:</span>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((level) => (
          <button
            key={level}
            style={{
              ...styles.filterButton,
              ...(severityFilter === level ? styles.filterButtonActive : {}),
              ...(level !== 'all' ? { borderColor: SEVERITY_COLORS[level as SeverityLevel] } : {}),
            }}
            onClick={() => onFilterChange(level)}
          >
            {level === 'all' ? '全部' : SEVERITY_LABELS[level as SeverityLevel]}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div style={styles.list}>
        {anomalies.length === 0 ? (
          <div style={styles.emptyList}>
            <span style={{ color: '#73d13d', marginRight: 8 }}>[OK]</span>
            {severityFilter === 'all' ? '所有监测点状态正常' : '没有匹配的异常'}
          </div>
        ) : (
          anomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onSelect={() => onSelectPoint?.(anomaly.point_id)}
              onCreateTicket={() => onCreateTicket?.(anomaly)}
            />
          ))
        )}
      </div>
    </>
  );
};

// 异常卡片
const AnomalyCard: React.FC<{
  anomaly: AnomalyItem;
  onSelect?: () => void;
  onCreateTicket?: () => void;
}> = ({ anomaly, onSelect, onCreateTicket }) => {
  const severityColor = SEVERITY_COLORS[anomaly.severity as SeverityLevel] || '#888';

  return (
    <div
      style={{ ...styles.card, borderLeftColor: severityColor }}
      onClick={onSelect}
    >
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>
          <span style={{ ...styles.pointBadge, background: severityColor }}>
            {anomaly.point_id}
          </span>
          <span style={styles.anomalyTitle}>{anomaly.title}</span>
        </div>
        <span
          style={{
            ...styles.severityBadge,
            background: severityColor,
            color: ['critical', 'high'].includes(anomaly.severity) ? '#fff' : '#000',
          }}
        >
          {SEVERITY_LABELS[anomaly.severity as SeverityLevel]}
        </span>
      </div>

      <div style={styles.cardBody}>
        <p style={styles.description}>{anomaly.description}</p>

        <div style={styles.cardMeta}>
          <span style={styles.metaItem}>
            类型: {ANOMALY_TYPE_LABELS[anomaly.anomaly_type] || anomaly.anomaly_type}
          </span>
          {anomaly.current_value != null && (
            <span style={styles.metaItem}>
              当前值: {anomaly.current_value.toFixed(4)}
            </span>
          )}
          {anomaly.threshold != null && (
            <span style={styles.metaItem}>阈值: {anomaly.threshold}</span>
          )}
        </div>
      </div>

      {onCreateTicket && (
        <div style={styles.cardActions}>
          <button
            style={styles.ticketButton}
            onClick={(e) => {
              e.stopPropagation();
              onCreateTicket();
            }}
          >
            创建工单
          </button>
        </div>
      )}
    </div>
  );
};

// 建议列表子组件
const RecommendationList: React.FC<{
  recommendations: Recommendation[];
}> = ({ recommendations }) => {
  return (
    <div style={styles.list}>
      {recommendations.length === 0 ? (
        <div style={styles.emptyList}>暂无建议</div>
      ) : (
        recommendations.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))
      )}
    </div>
  );
};

// 建议卡片
const RecommendationCard: React.FC<{
  recommendation: Recommendation;
}> = ({ recommendation }) => {
  const priorityColor =
    PRIORITY_COLORS[recommendation.priority as keyof typeof PRIORITY_COLORS] || '#888';

  return (
    <div style={{ ...styles.card, borderLeftColor: priorityColor }}>
      <div style={styles.cardHeader}>
        <span style={styles.recTitle}>{recommendation.title}</span>
        <span
          style={{
            ...styles.priorityBadge,
            background: priorityColor,
            color: ['urgent', 'high'].includes(recommendation.priority) ? '#fff' : '#000',
          }}
        >
          {PRIORITY_LABELS[recommendation.priority as keyof typeof PRIORITY_LABELS]}
        </span>
      </div>

      <div style={styles.cardBody}>
        <p style={styles.description}>{recommendation.description}</p>

        {recommendation.target_points && recommendation.target_points.length > 0 && (
          <div style={styles.targetPoints}>
            <span style={styles.targetLabel}>涉及监测点:</span>
            <div style={styles.pointTags}>
              {recommendation.target_points.slice(0, 5).map((p) => (
                <span key={p} style={styles.pointTag}>
                  {p}
                </span>
              ))}
              {recommendation.target_points.length > 5 && (
                <span style={styles.pointTag}>+{recommendation.target_points.length - 5}</span>
              )}
            </div>
          </div>
        )}

        {recommendation.estimated_urgency && (
          <div style={styles.urgency}>
            <span style={styles.urgencyLabel}>建议时限:</span>
            <span style={styles.urgencyValue}>{recommendation.estimated_urgency}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 样式定义
const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0, 20, 40, 0.95)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
    gap: 12,
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2px solid #333',
    borderTopColor: '#00d4ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#ff4d4f',
    gap: 8,
  },
  errorIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  retryButton: {
    marginTop: 8,
    padding: '6px 16px',
    background: 'transparent',
    border: '1px solid #ff4d4f',
    color: '#ff4d4f',
    borderRadius: 4,
    cursor: 'pointer',
  },
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  tabBar: {
    display: 'flex',
    padding: '8px 12px',
    gap: 8,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  tabButton: {
    flex: 1,
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #333',
    color: '#888',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    transition: 'all 0.2s',
  },
  tabButtonActive: {
    background: 'rgba(0, 212, 255, 0.1)',
    borderColor: '#00d4ff',
    color: '#00d4ff',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 11,
    color: '#666',
    marginRight: 4,
  },
  filterButton: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid #444',
    color: '#888',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
  },
  filterButtonActive: {
    background: 'rgba(0, 212, 255, 0.1)',
    borderColor: '#00d4ff',
    color: '#00d4ff',
  },
  list: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyList: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    fontSize: 13,
  },
  card: {
    flexShrink: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    borderLeft: '3px solid #888',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pointBadge: {
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  anomalyTitle: {
    fontSize: 12,
    color: '#ddd',
    fontWeight: 500,
  },
  severityBadge: {
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    padding: '8px 12px',
  },
  description: {
    margin: 0,
    fontSize: 11,
    color: '#aaa',
    lineHeight: 1.5,
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    fontSize: 10,
    color: '#666',
  },
  metaItem: {
    fontFamily: 'monospace',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '8px 12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  ticketButton: {
    padding: '4px 12px',
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid #00d4ff',
    color: '#00d4ff',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
  },
  recTitle: {
    fontSize: 13,
    color: '#ddd',
    fontWeight: 500,
  },
  priorityBadge: {
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 'bold',
  },
  targetPoints: {
    marginTop: 8,
  },
  targetLabel: {
    fontSize: 10,
    color: '#666',
    marginRight: 8,
  },
  pointTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  pointTag: {
    padding: '2px 6px',
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid #00d4ff',
    borderRadius: 3,
    fontSize: 9,
    color: '#00d4ff',
  },
  urgency: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  urgencyLabel: {
    fontSize: 10,
    color: '#666',
  },
  urgencyValue: {
    fontSize: 11,
    color: '#ff7a45',
    fontWeight: 500,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    fontSize: 10,
    color: '#555',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  refreshButton: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid #444',
    color: '#666',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
  },
};

export default SecondaryDataTab;
