import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedPoints, setFailedPoints] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const abortRef = useRef(false);

  const isFullyLoaded = loadedCount >= pointIds.length;

  useEffect(() => {
    if (pointIds.length > 0) {
      fetchProgressively();
    }
    return () => { abortRef.current = true; };
  }, [pointIds]);

  const fetchProgressively = useCallback(async () => {
    abortRef.current = false;
    setInitialLoading(true);
    setError(null);
    setPredictions([]);
    setLoadedCount(0);
    setFailedPoints([]);
    setSelectedPoint(null);

    let firstLoaded = false;

    for (let i = 0; i < pointIds.length; i++) {
      if (abortRef.current) break;
      const pointId = pointIds[i];

      try {
        const data = await fetchAutoPrediction(pointId, 30);
        if (abortRef.current) break;

        setPredictions(prev => [...prev, data]);
        setLoadedCount(i + 1);

        if (!firstLoaded) {
          firstLoaded = true;
          setSelectedPoint(data.point_id);
          setInitialLoading(false);
        }
      } catch (err) {
        if (abortRef.current) break;
        setLoadedCount(i + 1);
        setFailedPoints(prev => [...prev, pointId]);

        if (!firstLoaded && i === pointIds.length - 1) {
          setError('所有点位预测均失败');
          setInitialLoading(false);
        }
      }
    }

    if (!firstLoaded) {
      setInitialLoading(false);
    }
  }, [pointIds]);

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

  // ── 首个点位加载中 ──
  if (initialLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinnerOuter}>
          <div style={styles.spinner} />
        </div>
        <div style={styles.loadingTitle}>正在加载预测模型</div>
        <div style={styles.loadingText}>
          加载中: {pointIds[loadedCount] || pointIds[0]} ({loadedCount}/{pointIds.length})
        </div>
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${Math.max(2, (loadedCount / pointIds.length) * 100)}%`,
            }}
          />
        </div>
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
        <button style={styles.retryButton} onClick={fetchProgressively}>
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
      {/* 加载进度条 - 仅在后台加载时显示 */}
      {!isFullyLoaded && (
        <div style={styles.progressBanner}>
          <div style={styles.progressInfo}>
            <div style={styles.miniSpinner} />
            <span>
              正在加载: {pointIds[loadedCount] || '...'} ({loadedCount}/{pointIds.length})
            </span>
            {failedPoints.length > 0 && (
              <span style={styles.failedHint}>
                {failedPoints.length} 个失败
              </span>
            )}
          </div>
          <div style={styles.progressBarBgSmall}>
            <div
              style={{
                ...styles.progressBarFillSmall,
                width: `${(loadedCount / pointIds.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#4a9eff' }}>
            <i className="fas fa-chart-line" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>
              {predictions.length}
              {!isFullyLoaded && (
                <span style={styles.statSuffix}>/{pointIds.length}</span>
              )}
            </div>
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
              {selectedPrediction?.selected_model?.toUpperCase() || '-'}
            </div>
            <div style={styles.statLabel}>当前模型</div>
          </div>
        </div>
      </div>

      {/* 点位选择器 */}
      <div style={styles.selectorContainer}>
        <div style={styles.selectorLabel}>选择监测点位:</div>
        <div style={styles.pointButtons}>
          {pointIds.map(pid => {
            const loaded = predictions.some(p => p.point_id === pid);
            const failed = failedPoints.includes(pid);
            return (
              <button
                key={pid}
                style={{
                  ...styles.pointButton,
                  ...(selectedPoint === pid ? styles.pointButtonActive : {}),
                  ...(failed ? styles.pointButtonFailed : {}),
                  ...(!loaded && !failed ? styles.pointButtonPending : {}),
                }}
                onClick={() => loaded && setSelectedPoint(pid)}
                disabled={!loaded}
              >
                {pid}
              </button>
            );
          })}
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
          <PredictionChart
            prediction={selectedPrediction}
            historicalData={selectedPrediction.historical || []}
            height={450}
          />
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
  // ── 进度条横幅 ──
  progressBanner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.25)',
  },
  progressInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#aac8ff',
  },
  failedHint: {
    color: '#ff7a45',
    fontSize: '12px',
  },
  miniSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    borderTop: '2px solid #4a9eff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    flexShrink: 0,
  },
  progressBarBgSmall: {
    height: '4px',
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBarFillSmall: {
    height: '100%',
    backgroundColor: '#4a9eff',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },
  // ── 统计卡片 ──
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
  statSuffix: {
    fontSize: '14px',
    fontWeight: 'normal',
    color: '#ccc',
  },
  statLabel: {
    fontSize: '13px',
    color: '#fff',
  },
  // ── 点位选择器 ──
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
    color: '#fff',
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
  pointButtonPending: {
    opacity: 0.35,
    cursor: 'default',
    borderStyle: 'dashed',
  },
  pointButtonFailed: {
    opacity: 0.5,
    borderColor: 'rgba(255, 77, 79, 0.4)',
    color: '#ff4d4f',
    cursor: 'default',
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
  // ── 图表/模型/风险区块 ──
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
    color: '#fff',
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
  // ── 全屏加载状态 ──
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    gap: '16px',
  },
  spinnerOuter: {
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 158, 255, 0.08)',
    borderRadius: '50%',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(74, 158, 255, 0.2)',
    borderTop: '3px solid #4a9eff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ccc',
  },
  loadingText: {
    fontSize: '13px',
    color: '#fff',
  },
  progressBarBg: {
    width: '240px',
    height: '6px',
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a9eff',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  // ── 错误/空状态 ──
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
    color: '#fff',
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
    color: '#fff',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#fff',
  },
};
