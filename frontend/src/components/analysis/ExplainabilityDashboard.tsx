import React, { useState, useCallback, useEffect, useRef } from 'react';
import { fetchSHAPExplanation, fetchCausalDiscover } from '../../utils/apiClient';

type SubTab = 'shap' | 'causal';

export const ExplainabilityDashboard: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('shap');

  return (
    <div style={styles.container}>
      {/* Sub-tab selector */}
      <div style={styles.subTabs}>
        <button
          style={{ ...styles.subTab, ...(subTab === 'shap' ? styles.subTabActive : {}) }}
          onClick={() => setSubTab('shap')}
        >
          <i className="fas fa-chart-bar" style={{ marginRight: '6px' }} />
          SHAP 特征重要性
        </button>
        <button
          style={{ ...styles.subTab, ...(subTab === 'causal' ? styles.subTabActive : {}) }}
          onClick={() => setSubTab('causal')}
        >
          <i className="fas fa-share-alt" style={{ marginRight: '6px' }} />
          因果发现
        </button>
      </div>

      {subTab === 'shap' && <SHAPPanel />}
      {subTab === 'causal' && <CausalDiscoverPanel />}
    </div>
  );
};

// ━━━ SHAP Panel ━━━
const SHAPPanel: React.FC = () => {
  const [selectedPoint, setSelectedPoint] = useState('S1');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

  const loadSHAP = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSHAPExplanation(selectedPoint);
      setData(result);
    } catch (err) {
      console.error('SHAP failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPoint]);

  useEffect(() => { loadSHAP(); }, [loadSHAP]);

  // Draw bar chart on canvas
  useEffect(() => {
    if (!data?.feature_importance || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const features = data.feature_importance;
    const maxVal = Math.max(...features.map((f: any) => f.importance));
    const barH = 36;
    const gap = 12;
    const leftPad = 120;
    const rightPad = 60;
    const topPad = 20;

    features.forEach((feat: any, i: number) => {
      const y = topPad + i * (barH + gap);
      const barW = ((w - leftPad - rightPad) * feat.importance) / maxVal;

      // Bar
      const gradient = ctx.createLinearGradient(leftPad, y, leftPad + barW, y);
      gradient.addColorStop(0, '#4a9eff');
      gradient.addColorStop(1, '#00d4ff');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(leftPad, y, barW, barH, 4);
      ctx.fill();

      // Feature label
      ctx.fillStyle = '#ccc';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(feat.feature, leftPad - 12, y + barH / 2);

      // Value label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(feat.importance.toFixed(2), leftPad + barW + 8, y + barH / 2);
    });
  }, [data]);

  return (
    <div style={styles.panelContent}>
      {/* SHAP 演示模式提示 */}
      {data?.mock && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 16px', marginBottom: '14px',
          backgroundColor: 'rgba(255, 169, 64, 0.12)',
          border: '1px solid rgba(255, 169, 64, 0.4)',
          borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
        }}>
          <i className="fas fa-info-circle" style={{ color: '#ffa940', fontSize: '16px', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ color: '#e2e8f0' }}>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>演示模式：</span>
            SHAP 可解释性分析需要较大算力（依赖 shap 库），当前云端环境暂未部署，显示的是模拟数据。
            Granger 因果检验使用真实监测数据，请切换到"因果发现"标签页查看。
          </div>
        </div>
      )}

      <div style={styles.paramRow}>
        <label style={styles.paramLabel}>监测点位:</label>
        <select value={selectedPoint} onChange={e => setSelectedPoint(e.target.value)} style={styles.select}>
          {pointIds.map(pid => <option key={pid} value={pid}>{pid}</option>)}
        </select>
        <button style={styles.runButton} onClick={loadSHAP} disabled={loading}>
          {loading ? '分析中...' : '运行 SHAP 分析'}
        </button>
      </div>

      {data?.feature_importance && (
        <>
          <div style={styles.chartBox}>
            <div style={styles.sectionTitle}>特征重要性排序 - {selectedPoint}</div>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: `${Math.max(200, data.feature_importance.length * 48 + 40)}px` }}
            />
          </div>

          {/* Summary table */}
          {data.summary && data.summary.length > 0 && (
            <div style={styles.tableSection}>
              <div style={styles.sectionTitle}>SHAP 统计详情</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>特征</th>
                      <th style={styles.th}>均值</th>
                      <th style={styles.th}>|均值|</th>
                      <th style={styles.th}>标准差</th>
                      <th style={styles.th}>最小值</th>
                      <th style={styles.th}>最大值</th>
                      <th style={styles.th}>中位数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.map((s: any) => (
                      <tr key={s.feature}>
                        <td style={styles.td}>{s.feature}</td>
                        <td style={styles.tdNum}>{s.mean_shap.toFixed(4)}</td>
                        <td style={styles.tdNum}>{s.mean_abs_shap.toFixed(4)}</td>
                        <td style={styles.tdNum}>{s.std_shap.toFixed(4)}</td>
                        <td style={styles.tdNum}>{s.min_shap.toFixed(4)}</td>
                        <td style={styles.tdNum}>{s.max_shap.toFixed(4)}</td>
                        <td style={styles.tdNum}>{s.median_shap.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ━━━ Causal Discover Panel ━━━
const CausalDiscoverPanel: React.FC = () => {
  const [selectedPoints, setSelectedPoints] = useState<string[]>(['S1', 'S2', 'S3', 'S5', 'S7']);
  const [maxLag, setMaxLag] = useState(5);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

  const togglePoint = (pid: string) => {
    setSelectedPoints(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  };

  const runDiscover = useCallback(async () => {
    if (selectedPoints.length < 2) return;
    setLoading(true);
    try {
      const result = await fetchCausalDiscover(selectedPoints, maxLag);
      setData(result);
    } catch (err) {
      console.error('Causal discover failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPoints, maxLag]);

  return (
    <div style={styles.panelContent}>
      {/* Point selector */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>选择监测点位 (至少 2 个)</div>
        <div style={styles.checkboxGrid}>
          {pointIds.map(pid => (
            <label key={pid} style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedPoints.includes(pid)}
                onChange={() => togglePoint(pid)}
                style={styles.checkbox}
              />
              {pid}
            </label>
          ))}
        </div>
      </div>

      <div style={styles.paramRow}>
        <div style={styles.paramGroup}>
          <label style={styles.paramLabel}>最大滞后阶数:</label>
          <select value={maxLag} onChange={e => setMaxLag(Number(e.target.value))} style={styles.select}>
            {[1, 2, 3, 5, 7, 10].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <span style={styles.hintText}>
          已选 {selectedPoints.length} 个点位，将测试 {selectedPoints.length * (selectedPoints.length - 1) / 2} 对因果关系
        </span>
        <button
          style={{ ...styles.runButton, ...(selectedPoints.length < 2 ? { opacity: 0.4, cursor: 'default' } : {}) }}
          onClick={runDiscover}
          disabled={loading || selectedPoints.length < 2}
        >
          {loading ? '分析中...' : '运行 Granger 因果检验'}
        </button>
      </div>

      {/* Results */}
      {data && (
        <div style={styles.section}>
          {/* Summary cards */}
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryValue}>{data.summary?.total_tested ?? 0}</div>
              <div style={styles.summaryLabel}>总测试对数</div>
            </div>
            <div style={{ ...styles.summaryCard, borderColor: 'rgba(82,196,26,0.4)' }}>
              <div style={{ ...styles.summaryValue, color: '#52c41a' }}>
                {data.summary?.significant_count ?? 0}
              </div>
              <div style={styles.summaryLabel}>显著因果关系</div>
            </div>
          </div>

          {/* Relations table */}
          {data.relations && data.relations.length > 0 ? (
            <div style={styles.tableSection}>
              <div style={styles.sectionTitle}>显著因果关系 (p &lt; 0.05)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>因</th>
                      <th style={styles.th}></th>
                      <th style={styles.th}>果</th>
                      <th style={styles.th}>p 值</th>
                      <th style={styles.th}>F 统计量</th>
                      <th style={styles.th}>最优滞后</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.relations.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={styles.td}>{r.cause}</td>
                        <td style={{ ...styles.td, color: '#52c41a', fontWeight: 'bold' }}>-&gt;</td>
                        <td style={styles.td}>{r.effect}</td>
                        <td style={{
                          ...styles.tdNum,
                          color: r.p_value < 0.01 ? '#52c41a' : r.p_value < 0.05 ? '#ffa940' : '#888',
                        }}>
                          {r.p_value.toFixed(4)}
                        </td>
                        <td style={styles.tdNum}>{r.f_statistic.toFixed(2)}</td>
                        <td style={styles.tdNum}>{r.optimal_lag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={styles.emptyHint}>
              未发现显著因果关系 (p &lt; 0.05)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' },
  subTabs: { display: 'flex', gap: '8px' },
  subTab: {
    padding: '10px 20px', backgroundColor: 'rgba(30,30,50,0.8)',
    border: '1px solid rgba(74,158,255,0.2)', borderRadius: '8px',
    color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
  },
  subTabActive: {
    backgroundColor: 'rgba(74,158,255,0.15)', borderColor: '#4a9eff', color: '#4a9eff',
  },
  panelContent: { display: 'flex', flexDirection: 'column', gap: '20px' },
  paramRow: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
    backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)', flexWrap: 'wrap',
  },
  paramGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  paramLabel: { fontSize: '14px', color: '#aaa', whiteSpace: 'nowrap' },
  select: {
    padding: '8px 12px', backgroundColor: 'rgba(20,20,40,0.8)',
    border: '1px solid rgba(74,158,255,0.3)', borderRadius: '6px',
    color: '#fff', fontSize: '13px', outline: 'none',
  },
  runButton: {
    display: 'flex', alignItems: 'center', padding: '10px 20px',
    backgroundColor: 'rgba(74,158,255,0.2)', border: '1px solid rgba(74,158,255,0.4)',
    borderRadius: '6px', color: '#4a9eff', fontSize: '14px', fontWeight: '500',
    cursor: 'pointer', transition: 'all 0.2s', marginLeft: 'auto',
  },
  hintText: { fontSize: '12px', color: '#ccc' },
  section: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '12px' },
  chartBox: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  checkboxGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px',
  },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '13px', color: '#ccc', cursor: 'pointer',
  },
  checkbox: { accentColor: '#4a9eff' },
  summaryRow: { display: 'flex', gap: '16px', marginBottom: '16px' },
  summaryCard: {
    flex: 1, padding: '16px', textAlign: 'center',
    backgroundColor: 'rgba(20,20,40,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  summaryValue: { fontSize: '28px', fontWeight: 'bold', color: '#4a9eff' },
  summaryLabel: { fontSize: '13px', color: '#fff', marginTop: '4px' },
  tableSection: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: '13px',
  },
  th: {
    padding: '10px 12px', textAlign: 'left', color: '#fff',
    borderBottom: '1px solid rgba(74,158,255,0.2)', fontWeight: '500',
  },
  td: {
    padding: '10px 12px', color: '#ddd',
    borderBottom: '1px solid rgba(74,158,255,0.08)',
  },
  tdNum: {
    padding: '10px 12px', color: '#ddd', fontFamily: 'monospace',
    borderBottom: '1px solid rgba(74,158,255,0.08)', textAlign: 'right',
  },
  emptyHint: {
    padding: '40px', textAlign: 'center', color: '#ccc', fontSize: '14px',
  },
};

export default ExplainabilityDashboard;
