import React, { useState } from 'react';
import { EventImpactChart } from './EventImpactChart';
import { fetchCausalAnalysis } from '../../utils/apiClient';

interface CausalAnalysisProps {
  pointIds?: string[];
}

interface EventImpactResult {
  method: string;
  treatment_effect: number;
  treated_change: number;
  control_change: number;
  confidence_interval: [number, number];
  interpretation: string;
  before_period: {
    dates: string[];
    treated_values: number[];
    control_values: number[];
  };
  after_period: {
    dates: string[];
    treated_values: number[];
    control_values: number[];
    counterfactual?: number[];
  };
}

export const CausalAnalysis: React.FC<CausalAnalysisProps> = ({
  pointIds = [],
}) => {
  // 默认日期设为数据中间时段（数据范围约2021年）
  const [selectedPoint, setSelectedPoint] = useState<string>(pointIds[0] || '');
  const [eventDate, setEventDate] = useState<string>('2021-06-01');
  const [eventName, setEventName] = useState<string>('基坑开挖');
  const [controlPoints, setControlPoints] = useState<string[]>([]);
  const [method, setMethod] = useState<'DID' | 'SCM'>('DID');
  const [windowDays, setWindowDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventImpactResult | null>(null);

  const handleAnalyze = async () => {
    if (!selectedPoint || !eventDate) {
      setError('请选择监测点位和事件日期');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchCausalAnalysis({
        point_id: selectedPoint,
        event_date: eventDate,
        control_point_ids: controlPoints.length > 0 ? controlPoints : undefined,
        method,
        window_days: windowDays,
      });

      // 检查后端是否返回错误（success: false）
      if (data && (data as any).success === false) {
        setError((data as any).message || '分析失败，请检查参数');
        setResult(null);
      } else if (data && typeof data.treatment_effect === 'number') {
        setResult(data);
      } else {
        setError('返回数据格式异常，请检查参数后重试');
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleControlPointToggle = (pointId: string) => {
    setControlPoints(prev =>
      prev.includes(pointId)
        ? prev.filter(p => p !== pointId)
        : [...prev, pointId]
    );
  };

  return (
    <div style={styles.container}>
      {/* 配置面板 */}
      <div style={styles.configPanel}>
        <div style={styles.configHeader}>
          <h3 style={styles.configTitle}>因果分析配置</h3>
          <div style={styles.configSubtitle}>
            分析施工事件对沉降的真实影响
          </div>
        </div>

        <div style={styles.configGrid}>
          {/* 处理组点位 */}
          <div style={styles.configItem}>
            <label style={styles.label}>处理组点位（受影响）</label>
            <select
              value={selectedPoint}
              onChange={e => setSelectedPoint(e.target.value)}
              style={styles.select}
            >
              <option value="">请选择点位</option>
              {pointIds.map(id => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {/* 事件日期 */}
          <div style={styles.configItem}>
            <label style={styles.label}>事件日期</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* 事件名称 */}
          <div style={styles.configItem}>
            <label style={styles.label}>事件名称（可选）</label>
            <input
              type="text"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="例如：爆破施工"
              style={styles.input}
            />
          </div>

          {/* 分析方法 */}
          <div style={styles.configItem}>
            <label style={styles.label}>分析方法</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as 'DID' | 'SCM')}
              style={styles.select}
            >
              <option value="DID">双重差分法 (DID)</option>
              <option value="SCM">合成控制法 (SCM)</option>
            </select>
          </div>

          {/* 时间窗口 */}
          <div style={styles.configItem}>
            <label style={styles.label}>时间窗口（天）</label>
            <input
              type="number"
              value={windowDays}
              onChange={e => setWindowDays(Number(e.target.value))}
              min={7}
              max={90}
              style={styles.input}
            />
          </div>
        </div>

        {/* 对照组选择 */}
        <div style={styles.controlGroup}>
          <label style={styles.label}>对照组点位（未受影响，可选）</label>
          <div style={styles.pointButtons}>
            {pointIds
              .filter(id => id !== selectedPoint)
              .map(id => (
                <button
                  key={id}
                  style={{
                    ...styles.pointButton,
                    ...(controlPoints.includes(id) ? styles.pointButtonActive : {}),
                  }}
                  onClick={() => handleControlPointToggle(id)}
                >
                  {id}
                </button>
              ))}
          </div>
          <div style={styles.hint}>
            未选择时将自动选择距离较远的点位作为对照组
          </div>
        </div>

        {/* 分析按钮 */}
        <div style={styles.buttonGroup}>
          <button
            style={styles.analyzeButton}
            onClick={handleAnalyze}
            disabled={loading || !selectedPoint || !eventDate}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                分析中...
              </>
            ) : (
              <>
                <i className="fas fa-chart-line" style={{ marginRight: '8px' }} />
                开始分析
              </>
            )}
          </button>

          {!result && !loading && (
            <div style={styles.quickDemo}>
              <i className="fas fa-info-circle" style={{ marginRight: '6px' }} />
              已自动填充演示参数，直接点击"开始分析"即可查看效果
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={styles.errorContainer}>
          <i className="fas fa-exclamation-circle" style={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* 分析结果 */}
      {result && (
        <div style={styles.resultContainer}>
          <EventImpactChart
            data={result}
            eventDate={eventDate}
            eventName={eventName || '施工事件'}
            height={450}
          />
        </div>
      )}

      {/* 空状态 */}
      {!result && !loading && !error && (
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>
            <i className="fas fa-project-diagram" />
          </div>
          <div style={styles.emptyTitle}>因果分析</div>
          <div style={styles.emptyMessage}>
            配置参数后点击"开始分析"按钮，量化施工事件对沉降的真实影响
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
    gap: '20px',
  },
  configPanel: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  configHeader: {
    marginBottom: '20px',
  },
  configTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  configSubtitle: {
    fontSize: '13px',
    color: '#888',
    marginTop: '4px',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  configItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#888',
  },
  select: {
    padding: '10px 12px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  input: {
    padding: '10px 12px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
  },
  pointButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
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
  hint: {
    fontSize: '12px',
    color: '#666',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  analyzeButton: {
    width: '100%',
    padding: '12px 20px',
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
    justifyContent: 'center',
  },
  quickDemo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(82, 196, 26, 0.3)',
    color: '#52c41a',
    fontSize: '13px',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 77, 79, 0.3)',
    color: '#ff4d4f',
    fontSize: '14px',
  },
  errorIcon: {
    fontSize: '20px',
  },
  resultContainer: {
    padding: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
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
    textAlign: 'center',
    maxWidth: '400px',
  },
};
