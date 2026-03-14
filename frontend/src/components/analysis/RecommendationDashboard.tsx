import React, { useState, useEffect } from 'react';
import type { Anomaly, Recommendation } from '../../types/analysis';
import { RecommendationList } from './RecommendationList';
import { mlBatchDetectAnomalies } from '../../lib/mlApi';
import { generateRecommendations } from '../../utils/analysis';
import { fetchRecommendations } from '../../utils/apiClient';

export const RecommendationDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // 加载建议数据
  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取所有监测点ID
      const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

      // 使用支持自动降级的 API 客户端
      const result = await fetchRecommendations(pointIds);

      if (result.recommendations && Array.isArray(result.recommendations)) {
        // 转换为 Recommendation 类型
        const allRecommendations: Recommendation[] = result.recommendations.map((item: any) => ({
          id: item.id,
          priority: item.priority,
          action: item.action,
          title: item.title,
          reason: item.reason,
          related_anomalies: item.related_anomalies || [],
          estimated_time: item.estimated_time,
          point_ids: item.point_ids || [],
        }));

        setRecommendations(allRecommendations);
      } else {
        setError('加载建议数据失败');
      }
    } catch (err) {
      console.error('加载建议数据失败:', err);
      setError(err instanceof Error ? err.message : '加载建议数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>
          <i className="fas fa-spinner fa-spin" style={styles.spinnerIcon} />
        </div>
        <div style={styles.loadingText}>正在生成处置建议...</div>
        <div style={styles.loadingHint}>基于异常检测结果智能生成行动方案</div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>
          <i className="fas fa-exclamation-triangle" />
        </div>
        <div style={styles.errorTitle}>加载失败</div>
        <div style={styles.errorMessage}>{error}</div>
        <button style={styles.retryButton} onClick={loadRecommendations}>
          <i className="fas fa-redo" style={{ marginRight: '8px' }} />
          重试
        </button>
      </div>
    );
  }

  // 空状态
  if (recommendations.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>
          <i className="fas fa-check-circle" />
        </div>
        <div style={styles.emptyTitle}>无需处置</div>
        <div style={styles.emptyMessage}>当前没有需要处理的异常，系统运行正常</div>
        <button style={styles.refreshButton} onClick={loadRecommendations}>
          <i className="fas fa-sync" style={{ marginRight: '8px' }} />
          刷新数据
        </button>
      </div>
    );
  }

  // 统计数据
  const stats = {
    total: recommendations.length,
    urgent: recommendations.filter(r => r.priority === 'urgent').length,
    high: recommendations.filter(r => r.priority === 'high').length,
    medium: recommendations.filter(r => r.priority === 'medium').length,
    low: recommendations.filter(r => r.priority === 'low').length,
  };

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>处置建议</h2>
          <div style={styles.subtitle}>
            基于异常检测结果自动生成的行动方案
          </div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.refreshButton} onClick={loadRecommendations}>
            <i className="fas fa-sync" style={{ marginRight: '8px' }} />
            刷新
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={styles.statsContainer}>
        <StatCard
          label="建议总数"
          value={stats.total}
          icon="clipboard-list"
          color="#4a9eff"
        />
        <StatCard
          label="紧急"
          value={stats.urgent}
          icon="exclamation-triangle"
          color="#ff4d4f"
          highlight={stats.urgent > 0}
        />
        <StatCard
          label="高优先级"
          value={stats.high}
          icon="exclamation"
          color="#ff7a45"
        />
        <StatCard
          label="中优先级"
          value={stats.medium}
          icon="info-circle"
          color="#ffa940"
        />
        <StatCard
          label="低优先级"
          value={stats.low}
          icon="check-circle"
          color="#52c41a"
        />
      </div>

      {/* 建议列表 */}
      <div style={styles.listContainer}>
        <RecommendationList recommendations={recommendations} />
      </div>
    </div>
  );
};

// 统计卡片组件
interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, highlight }) => {
  return (
    <div
      style={{
        ...styles.statCard,
        ...(highlight ? styles.statCardHighlight : {}),
      }}
    >
      <div style={{ ...styles.statIconContainer, backgroundColor: `${color}20` }}>
        <i className={`fas fa-${icon}`} style={{ ...styles.statIcon, color }} />
      </div>
      <div style={styles.statContent}>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#fff',
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    transition: 'all 0.2s',
  },
  statCardHighlight: {
    borderColor: '#ff4d4f',
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
  },
  statIconContainer: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  statIcon: {
    fontSize: '20px',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '12px',
    color: '#fff',
    marginTop: '2px',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  spinner: {
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '50%',
  },
  spinnerIcon: {
    fontSize: '28px',
    color: '#4a9eff',
  },
  loadingText: {
    fontSize: '18px',
    color: '#fff',
    fontWeight: '500',
  },
  loadingHint: {
    fontSize: '13px',
    color: '#fff',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  errorIcon: {
    fontSize: '48px',
    color: '#ff4d4f',
  },
  errorTitle: {
    fontSize: '20px',
    color: '#fff',
    fontWeight: 'bold',
  },
  errorMessage: {
    fontSize: '14px',
    color: '#fff',
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '14px',
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
    height: '100%',
    gap: '16px',
  },
  emptyIcon: {
    fontSize: '64px',
    color: '#52c41a',
  },
  emptyTitle: {
    fontSize: '20px',
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#fff',
  },
};
