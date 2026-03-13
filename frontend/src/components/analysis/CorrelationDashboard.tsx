import React, { useState, useEffect } from 'react';
import { CausalAnalysis } from './CausalAnalysis';
import { SpatialCorrelationHeatmap } from './SpatialCorrelationHeatmap';
import { fetchSpatialCorrelation } from '../../utils/apiClient';

interface CorrelationDashboardProps {
  pointIds?: string[];
}

type AnalysisType = 'causal' | 'spatial';

interface SpatialCorrelationData {
  success: boolean;
  points: Array<{
    point_id: string;
    x: number;
    y: number;
  }>;
  correlation_matrix: number[][];
  adjacency_matrix: number[][];
  clusters: number[][];
  cluster_count: number;
}

export const CorrelationDashboard: React.FC<CorrelationDashboardProps> = ({
  pointIds = [],
}) => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('causal');
  const [spatialData, setSpatialData] = useState<SpatialCorrelationData | null>(null);
  const [spatialLoading, setSpatialLoading] = useState(false);
  const [spatialError, setSpatialError] = useState<string | null>(null);
  const [distanceThreshold, setDistanceThreshold] = useState<number>(50);

  useEffect(() => {
    if (analysisType === 'spatial') {
      fetchSpatialCorrelationData();
    }
  }, [analysisType, distanceThreshold]);

  const fetchSpatialCorrelationData = async () => {
    setSpatialLoading(true);
    setSpatialError(null);

    try {
      const data = await fetchSpatialCorrelation(distanceThreshold);
      setSpatialData(data);
    } catch (err) {
      setSpatialError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setSpatialLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* 统计卡片 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#4a9eff' }}>
            <i className="fas fa-map-marked-alt" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{pointIds.length}</div>
            <div style={styles.statLabel}>监测点位</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#ff7a45' }}>
            <i className="fas fa-project-diagram" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>
              {spatialData?.cluster_count || '-'}
            </div>
            <div style={styles.statLabel}>空间聚类</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#52c41a' }}>
            <i className="fas fa-chart-line" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>DID / SCM</div>
            <div style={styles.statLabel}>因果推断方法</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, color: '#ffa940' }}>
            <i className="fas fa-calendar-check" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>实时</div>
            <div style={styles.statLabel}>分析状态</div>
          </div>
        </div>
      </div>

      {/* 分析类型选择 */}
      <div style={styles.typeSelector}>
        <div style={styles.typeSelectorLabel}>分析类型:</div>
        <div style={styles.typeButtons}>
          <button
            style={{
              ...styles.typeButton,
              ...(analysisType === 'causal' ? styles.typeButtonActive : {}),
            }}
            onClick={() => setAnalysisType('causal')}
          >
            <i className="fas fa-project-diagram" style={{ marginRight: '6px' }} />
            因果分析
          </button>
          <button
            style={{
              ...styles.typeButton,
              ...(analysisType === 'spatial' ? styles.typeButtonActive : {}),
            }}
            onClick={() => setAnalysisType('spatial')}
          >
            <i className="fas fa-th" style={{ marginRight: '6px' }} />
            空间关联
          </button>
        </div>

        {/* 空间关联配置 */}
        {analysisType === 'spatial' && (
          <div style={styles.spatialConfig}>
            <label style={styles.configLabel}>距离阈值 (米):</label>
            <input
              type="number"
              value={distanceThreshold}
              onChange={e => setDistanceThreshold(Number(e.target.value))}
              min={10}
              max={200}
              step={10}
              style={styles.configInput}
            />
            <button style={styles.refreshButton} onClick={fetchSpatialCorrelationData}>
              <i className="fas fa-sync-alt" style={{ marginRight: '6px' }} />
              刷新
            </button>
          </div>
        )}
      </div>

      {/* 分析内容 */}
      <div style={styles.analysisContent}>
        {analysisType === 'causal' && (
          <CausalAnalysis pointIds={pointIds} />
        )}

        {analysisType === 'spatial' && (
          <>
            {spatialLoading && (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner} />
                <div style={styles.loadingText}>正在加载空间关联数据...</div>
              </div>
            )}

            {spatialError && (
              <div style={styles.errorContainer}>
                <i className="fas fa-exclamation-circle" style={styles.errorIcon} />
                <div style={styles.errorText}>{spatialError}</div>
                <button style={styles.retryButton} onClick={fetchSpatialCorrelationData}>
                  <i className="fas fa-redo" style={{ marginRight: '6px' }} />
                  重试
                </button>
              </div>
            )}

            {!spatialLoading && !spatialError && spatialData && (
              <div style={styles.spatialContainer}>
                <SpatialCorrelationHeatmap data={spatialData} height={550} />
              </div>
            )}
          </>
        )}
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
    color: '#fff',
  },
  typeSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    flexWrap: 'wrap',
  },
  typeSelectorLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
  },
  typeButtons: {
    display: 'flex',
    gap: '8px',
    flex: 1,
  },
  typeButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  spatialConfig: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginLeft: 'auto',
  },
  configLabel: {
    fontSize: '13px',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  configInput: {
    width: '100px',
    padding: '8px 12px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  },
  refreshButton: {
    padding: '8px 16px',
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
  },
  analysisContent: {
    minHeight: '400px',
  },
  spatialContainer: {
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
    color: '#fff',
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
  errorText: {
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
};
