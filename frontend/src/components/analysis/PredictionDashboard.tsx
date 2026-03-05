import React, { useState, useEffect } from 'react';
import { PredictionChart } from './PredictionChart';
import { RiskPointList } from './RiskPointList';
import { ModelComparisonTable } from './ModelComparisonTable';
import type { PredictionResult } from '../../types/analysis';
import { fetchAutoPrediction, fetchModelComparison } from '../../utils/apiClient';

interface PredictionDashboardProps {
  pointIds?: string[];
  threshold?: number;
}

export const PredictionDashboard: React.FC<PredictionDashboardProps> = ({
  pointIds = [],
  threshold = -30,
}) => {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);

  useEffect(() => {
    if (pointIds.length > 0) {
      fetchPredictions();
    }
  }, [pointIds]);

  const fetchPredictions = async () => {
    setLoading(true);
    setError(null);

    try {
      const results: PredictionResult[] = [];

      for (const pointId of pointIds) {
        const data = await fetchAutoPrediction(pointId, 30);
        results.push(data);
      }

      setPredictions(results);
      if (results.length > 0 && !selectedPoint) {
        setSelectedPoint(results[0].point_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载预测数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchModelComparisonData = async (pointId: string) => {
    try {
      const data = await fetchModelComparison(pointId);
      setComparisonData(data);
      setShowComparison(true);
    } catch (err) {
      console.error('模型对比失败:', err);
    }
  };

  const selectedPrediction = predictions.find(p => p.point_id === selectedPoint);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <div style={styles.loadingText}>正在加载预测数据...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>
          <i className="fas fa-exclamation-circle" />
        </div>
        <div style={styles.errorTitle}>加载失败</div>
        <div style={styles.errorMessage}>{error}</div>
        <button style={styles.retryButton} onClick={fetchPredictions}>
          <i className="fas fa-redo" style={{ marginRight: '6px' }} />
          重试
        </button>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>
          <i className="fas fa-chart-line" />
        </div>
        <div style={styles.emptyTitle}>暂无预测数据</div>
        <div style={styles.emptyMessage}>
          请先选择监测点位进行预测分析
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 统计卡片 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#4a9eff' }}>
            <i className="fas fa-chart-line" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{predictions.length}</div>
            <div style={styles.statLabel}>预测点位</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#ff7a45' }}>
            <i className="fas fa-exclamation-triangle" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>
              {predictions.filter(p => {
                const minValue = Math.min(...p.forecast.values);
                return minValue <= threshold;
              }).length}
            </div>
            <div style={styles.statLabel}>高风险点位</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#52c41a' }}>
            <i className="fas fa-calendar-alt" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>30</div>
            <div style={styles.statLabel}>预测天数</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#ffa940' }}>
            <i className="fas fa-brain" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>
              {selectedPrediction?.selected_model.toUpperCase() || '-'}
            </div>
            <div style={styles.statLabel}>当前模型</div>
          </div>
        </div>
      </div>

      {/* 点位选择器 */}
      <div style={styles.selectorContainer}>
        <div style={styles.selectorLabel}>选择监测点位:</div>
        <div style={styles.pointButtons}>
          {predictions.map(pred => (
            <button
              key={pred.point_id}
              style={{
                ...styles.pointButton,
                ...(selectedPoint === pred.point_id ? styles.pointButtonActive : {}),
              }}
              onClick={() => setSelectedPoint(pred.point_id)}
            >
              {pred.point_id}
            </button>
          ))}
        </div>
        {selectedPoint && (
          <button
            style={styles.compareButton}
            onClick={() => fetchModelComparisonData(selectedPoint)}
          >
            <i className="fas fa-balance-scale" style={{ marginRight: '6px' }} />
            模型对比
          </button>
        )}
      </div>

      {/* 预测图表 */}
      {selectedPrediction && (
        <div style={styles.chartSection}>
          <PredictionChart prediction={selectedPrediction} height={450} />
        </div>
      )}

      {/* 模型对比 */}
      {showComparison && comparisonData && (
        <div style={styles.comparisonSection}>
          <div style={styles.comparisonHeader}>
            <h3 style={styles.comparisonTitle}>模型性能对比</h3>
            <button
              style={styles.closeButton}
              onClick={() => setShowComparison(false)}
            >
              <i className="fas fa-times" />
            </button>
          </div>
          <ModelComparisonTable
            models={comparisonData.models || []}
            selectedModel={comparisonData.best_model}
          />
        </div>
      )}

      {/* 高风险点位列表 */}
      <div style={styles.riskSection}>
        <RiskPointList predictions={predictions} threshold={threshold} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '20px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  statIcon: {
    fontSize: '32px',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: '13px',
    color: '#888',
  },
  selectorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    flexWrap: 'wrap',
  },
  selectorLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
  },
  pointButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    flex: 1,
  },
  pointButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#888',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  pointButtonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  compareButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 169, 64, 0.2)',
    border: '1px solid rgba(255, 169, 64, 0.3)',
    borderRadius: '6px',
    color: '#ffa940',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
  },
  chartSection: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  comparisonSection: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  comparisonHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  comparisonTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  riskSection: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
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
    color: '#888',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '12px',
  },
  errorIcon: {
    fontSize: '48px',
    color: '#ff4d4f',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  errorMessage: {
    fontSize: '14px',
    color: '#888',
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
    color: '#888',
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
