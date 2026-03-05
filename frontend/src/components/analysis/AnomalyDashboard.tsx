import React, { useState, useEffect } from 'react';
import type { Anomaly, AnomalyDetectionResult } from '../../types/analysis';
import { AnomalyStatCards } from './AnomalyStatCards';
import { AnomalyList } from './AnomalyList';
import { mlBatchDetectAnomalies } from '../../lib/mlApi';
import { calculateAnomalyStatistics } from '../../utils/analysis';
import { fetchBatchAnomalies } from '../../utils/apiClient';

export const AnomalyDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  // 加载异常数据
  useEffect(() => {
    loadAnomalies();
  }, []);

  const loadAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取所有监测点ID
      const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

      // 使用支持自动降级的 API 客户端
      const result = await fetchBatchAnomalies(pointIds);

      if (result.success) {
        // 转换为 Anomaly 类型
        const allAnomalies: Anomaly[] = result.anomalies.map((item: any) => ({
          point_id: item.point_id,
          point_name: item.point_id,
          date: item.detected_at || new Date().toISOString().split('T')[0],
          value: item.current_value,
          severity: item.severity,
          anomaly_type: item.anomaly_type,
          reason: item.reason,
          threshold: item.threshold,
          deviation: item.deviation,
        }));

        setAnomalies(allAnomalies);
      } else {
        setError('加载异常数据失败');
      }
    } catch (err) {
      console.error('加载异常数据失败:', err);
      setError(err instanceof Error ? err.message : '加载异常数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAnomalyClick = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
  };

  const handleCloseDetail = () => {
    setSelectedAnomaly(null);
  };

  // 计算统计数据
  const stats = calculateAnomalyStatistics(anomalies);

  // 加载状态
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>
          <i className="fas fa-spinner fa-spin" style={styles.spinnerIcon} />
        </div>
        <div style={styles.loadingText}>正在检测异常...</div>
        <div style={styles.loadingHint}>使用机器学习算法分析所有监测点数据</div>
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
        <button style={styles.retryButton} onClick={loadAnomalies}>
          <i className="fas fa-redo" style={{ marginRight: '8px' }} />
          重试
        </button>
      </div>
    );
  }

  // 空状态
  if (anomalies.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>
          <i className="fas fa-check-circle" />
        </div>
        <div style={styles.emptyTitle}>未发现异常</div>
        <div style={styles.emptyMessage}>所有监测点数据正常，无需处理</div>
        <button style={styles.refreshButton} onClick={loadAnomalies}>
          <i className="fas fa-sync" style={{ marginRight: '8px' }} />
          刷新数据
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 头部操作栏 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>智能异常诊断</h2>
          <div style={styles.subtitle}>
            基于孤立森林算法自动检测异常沉降模式
          </div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.refreshButton} onClick={loadAnomalies}>
            <i className="fas fa-sync" style={{ marginRight: '8px' }} />
            刷新
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <AnomalyStatCards stats={stats} />

      {/* 异常列表 */}
      <div style={styles.listContainer}>
        <AnomalyList anomalies={anomalies} onAnomalyClick={handleAnomalyClick} />
      </div>

      {/* 异常详情弹窗 */}
      {selectedAnomaly && (
        <AnomalyDetailModal anomaly={selectedAnomaly} onClose={handleCloseDetail} />
      )}
    </div>
  );
};

// 异常详情弹窗组件
interface AnomalyDetailModalProps {
  anomaly: Anomaly;
  onClose: () => void;
}

const AnomalyDetailModal: React.FC<AnomalyDetailModalProps> = ({ anomaly, onClose }) => {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>异常详情 - {anomaly.point_id}</h3>
          <button style={styles.closeButton} onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={styles.modalContent}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>监测点:</span>
            <span style={styles.detailValue}>{anomaly.point_id}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>日期:</span>
            <span style={styles.detailValue}>{anomaly.date}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>沉降值:</span>
            <span style={styles.detailValue}>{anomaly.settlement.toFixed(2)} mm</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>异常分数:</span>
            <span style={styles.detailValue}>{anomaly.anomaly_score.toFixed(3)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>严重程度:</span>
            <span style={styles.detailValue}>
              {anomaly.severity === 'critical' && '严重'}
              {anomaly.severity === 'high' && '高'}
              {anomaly.severity === 'medium' && '中'}
              {anomaly.severity === 'low' && '低'}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>异常类型:</span>
            <span style={styles.detailValue}>
              {anomaly.anomaly_type === 'spike' && '突变'}
              {anomaly.anomaly_type === 'acceleration' && '加速'}
              {anomaly.anomaly_type === 'fluctuation' && '波动'}
              {anomaly.anomaly_type === 'trend' && '趋势异常'}
              {anomaly.anomaly_type === 'unknown' && '未知'}
            </span>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.modalButton} onClick={onClose}>
            关闭
          </button>
        </div>
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
    color: '#888',
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
  listContainer: {
    flex: 1,
    overflow: 'hidden',
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
    color: '#888',
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
    color: '#888',
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
    color: '#888',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '500px',
    maxWidth: '90%',
    backgroundColor: 'rgba(20, 20, 40, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#888',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modalContent: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(74, 158, 255, 0.1)',
  },
  detailLabel: {
    fontSize: '14px',
    color: '#888',
  },
  detailValue: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '500',
  },
  modalFooter: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(74, 158, 255, 0.2)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  modalButton: {
    padding: '8px 20px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
