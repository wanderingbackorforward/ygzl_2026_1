import React, { useState, useCallback, useEffect } from 'react';
import KnowledgeGraphViz from '../assistant/KnowledgeGraphViz';
import {
  fetchKGStats,
  fetchKGNeighbors,
  fetchKGRiskPoints,
  fetchKGQA,
} from '../../utils/apiClient';

type SubTab = 'explore' | 'risk' | 'qa';

export const KnowledgeGraphDashboard: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('explore');
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchKGStats()
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <div style={styles.container}>
      {/* Stats cards */}
      <div style={styles.statsGrid}>
        <StatCard label="节点总数" value={statsLoading ? '...' : String(stats?.total_nodes ?? 0)} icon="circle" color="#06b6d4" />
        <StatCard label="边总数" value={statsLoading ? '...' : String(stats?.total_edges ?? 0)} icon="share-alt" color="#a78bfa" />
        <StatCard
          label="节点类型"
          value={statsLoading ? '...' : String(Object.keys(stats?.node_types || {}).length)}
          icon="th-large" color="#f59e0b"
        />
        <StatCard
          label="边类型"
          value={statsLoading ? '...' : String(Object.keys(stats?.edge_types || {}).length)}
          icon="exchange-alt" color="#fb923c"
        />
      </div>

      {/* Sub-tab selector */}
      <div style={styles.subTabs}>
        <button
          style={{ ...styles.subTab, ...(subTab === 'explore' ? styles.subTabActive : {}) }}
          onClick={() => setSubTab('explore')}
        >
          <i className="fas fa-project-diagram" style={{ marginRight: '6px' }} />
          图谱探索
        </button>
        <button
          style={{ ...styles.subTab, ...(subTab === 'risk' ? styles.subTabActive : {}) }}
          onClick={() => setSubTab('risk')}
        >
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }} />
          风险查询
        </button>
        <button
          style={{ ...styles.subTab, ...(subTab === 'qa' ? styles.subTabActive : {}) }}
          onClick={() => setSubTab('qa')}
        >
          <i className="fas fa-comments" style={{ marginRight: '6px' }} />
          知识问答
        </button>
      </div>

      {subTab === 'explore' && <ExplorePanel />}
      {subTab === 'risk' && <RiskPanel />}
      {subTab === 'qa' && <QAPanel />}
    </div>
  );
};

// ━━━ Stat Card ━━━
const StatCard: React.FC<{ label: string; value: string; icon: string; color: string }> = ({
  label, value, icon, color,
}) => (
  <div style={styles.statCard}>
    <div style={{ ...styles.statIcon, color }}>
      <i className={`fas fa-${icon}`} />
    </div>
    <div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  </div>
);

// ━━━ Explore Panel ━━━
const ExplorePanel: React.FC = () => {
  const [selectedPoint, setSelectedPoint] = useState('S1');
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

  const loadNeighbors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKGNeighbors(selectedPoint);
      setGraphData(data);
    } catch (err) {
      console.error('KG neighbors failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPoint]);

  useEffect(() => { loadNeighbors(); }, [loadNeighbors]);

  return (
    <div style={styles.panelContent}>
      <div style={styles.paramRow}>
        <label style={styles.paramLabel}>中心点位:</label>
        <select value={selectedPoint} onChange={e => setSelectedPoint(e.target.value)} style={styles.select}>
          {pointIds.map(pid => <option key={pid} value={pid}>{pid}</option>)}
        </select>
        <button style={styles.runButton} onClick={loadNeighbors} disabled={loading}>
          {loading ? '加载中...' : '查询邻居'}
        </button>
      </div>

      {graphData && graphData.nodes && graphData.nodes.length > 0 && (
        <div style={styles.graphBox}>
          <KnowledgeGraphViz
            nodes={graphData.nodes}
            edges={graphData.edges}
            stats={{
              total_nodes: graphData.nodes.length,
              total_edges: graphData.edges.length,
            }}
          />
        </div>
      )}

      {!loading && graphData && (!graphData.nodes || graphData.nodes.length === 0) && (
        <div style={styles.emptyHint}>该点位暂无邻居数据</div>
      )}
    </div>
  );
};

// ━━━ Risk Panel ━━━
const RiskPanel: React.FC = () => {
  const [severity, setSeverity] = useState('high');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadRiskPoints = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchKGRiskPoints(severity);
      setData(result);
    } catch (err) {
      console.error('KG risk points failed:', err);
    } finally {
      setLoading(false);
    }
  }, [severity]);

  useEffect(() => { loadRiskPoints(); }, [loadRiskPoints]);

  return (
    <div style={styles.panelContent}>
      <div style={styles.paramRow}>
        <label style={styles.paramLabel}>最低严重程度:</label>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={styles.select}>
          <option value="critical">严重 (Critical)</option>
          <option value="high">高 (High)</option>
          <option value="medium">中 (Medium)</option>
        </select>
        <button style={styles.runButton} onClick={loadRiskPoints} disabled={loading}>
          {loading ? '查询中...' : '查询风险点'}
        </button>
      </div>

      {data?.risk_points && data.risk_points.length > 0 ? (
        <div style={styles.riskList}>
          {data.risk_points.map((rp: any) => (
            <div key={rp.point_id} style={styles.riskCard}>
              <div style={styles.riskHeader}>
                <span style={styles.riskPointId}>{rp.point_id}</span>
                <span style={{
                  ...styles.severityBadge,
                  backgroundColor: rp.severity === 'critical' ? 'rgba(239,68,68,0.2)' :
                    rp.severity === 'high' ? 'rgba(251,146,60,0.2)' : 'rgba(250,204,21,0.2)',
                  color: rp.severity === 'critical' ? '#ef4444' :
                    rp.severity === 'high' ? '#fb923c' : '#facc15',
                }}>
                  {rp.severity === 'critical' ? '严重' : rp.severity === 'high' ? '高' : '中'}
                </span>
              </div>
              <div style={styles.riskDesc}>{rp.description}</div>
              <div style={styles.riskMeta}>
                <span>异常次数: {rp.anomaly_count}</span>
                <span>最近异常: {rp.latest_anomaly_date}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && <div style={styles.emptyHint}>未发现符合条件的风险点</div>
      )}
    </div>
  );
};

// ━━━ QA Panel ━━━
const QAPanel: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ q: string; a: any }>>([]);

  const askQuestion = useCallback(async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const result = await fetchKGQA(question);
      setAnswer(result);
      setHistory(prev => [...prev, { q: question, a: result }]);
      setQuestion('');
    } catch (err) {
      console.error('KGQA failed:', err);
    } finally {
      setLoading(false);
    }
  }, [question]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  const presetQuestions = [
    '哪些点位风险最高？',
    '最近有哪些异常事件？',
    'S3和S7之间有什么关联？',
    '施工事件对沉降有什么影响？',
  ];

  return (
    <div style={styles.panelContent}>
      {/* Preset questions */}
      <div style={styles.presetRow}>
        {presetQuestions.map((pq, i) => (
          <button
            key={i}
            style={styles.presetButton}
            onClick={() => { setQuestion(pq); }}
          >
            {pq}
          </button>
        ))}
      </div>

      {/* QA history */}
      {history.length > 0 && (
        <div style={styles.qaHistory}>
          {history.map((item, i) => (
            <div key={i} style={styles.qaItem}>
              <div style={styles.qaQuestion}>
                <i className="fas fa-user" style={{ marginRight: '8px', color: '#4a9eff' }} />
                {item.q}
              </div>
              <div style={styles.qaAnswer}>
                <i className="fas fa-robot" style={{ marginRight: '8px', color: '#52c41a' }} />
                <div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{item.a.answer}</div>
                  {item.a.confidence != null && (
                    <div style={styles.qaConfidence}>
                      置信度: {(item.a.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                  {item.a.sources && item.a.sources.length > 0 && (
                    <div style={styles.qaSources}>
                      来源: {item.a.sources.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputRow}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入关于知识图谱的问题..."
          style={styles.input}
          disabled={loading}
        />
        <button
          style={{ ...styles.sendButton, ...(loading || !question.trim() ? { opacity: 0.4 } : {}) }}
          onClick={askQuestion}
          disabled={loading || !question.trim()}
        >
          {loading ? (
            <div style={styles.miniSpinner} />
          ) : (
            <i className="fas fa-paper-plane" />
          )}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
    backgroundColor: 'rgba(30,30,50,0.8)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  statIcon: { fontSize: '24px' },
  statValue: { fontSize: '22px', fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: '12px', color: '#fff', marginTop: '2px' },
  subTabs: { display: 'flex', gap: '8px' },
  subTab: {
    padding: '10px 20px', backgroundColor: 'rgba(30,30,50,0.8)',
    border: '1px solid rgba(74,158,255,0.2)', borderRadius: '8px',
    color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
  },
  subTabActive: {
    backgroundColor: 'rgba(74,158,255,0.15)', borderColor: '#4a9eff', color: '#4a9eff',
  },
  panelContent: { display: 'flex', flexDirection: 'column', gap: '16px' },
  paramRow: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
    backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)', flexWrap: 'wrap',
  },
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
  graphBox: {
    backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)', overflow: 'hidden',
  },
  emptyHint: { padding: '40px', textAlign: 'center', color: '#ccc', fontSize: '14px' },
  // Risk panel
  riskList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  riskCard: {
    padding: '16px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.15)',
  },
  riskHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  riskPointId: { fontSize: '16px', fontWeight: 'bold', color: '#fff' },
  severityBadge: {
    padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
  },
  riskDesc: { fontSize: '13px', color: '#bbb', lineHeight: '1.5', marginBottom: '8px' },
  riskMeta: { display: 'flex', gap: '16px', fontSize: '12px', color: '#ccc' },
  // QA panel
  presetRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  presetButton: {
    padding: '8px 14px', backgroundColor: 'rgba(74,158,255,0.08)',
    border: '1px solid rgba(74,158,255,0.2)', borderRadius: '16px',
    color: '#8bb8e8', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
  },
  qaHistory: {
    display: 'flex', flexDirection: 'column', gap: '16px',
    maxHeight: '400px', overflowY: 'auto', padding: '4px',
  },
  qaItem: { display: 'flex', flexDirection: 'column', gap: '8px' },
  qaQuestion: {
    padding: '10px 14px', backgroundColor: 'rgba(74,158,255,0.1)',
    borderRadius: '8px', color: '#ddd', fontSize: '14px',
  },
  qaAnswer: {
    display: 'flex', padding: '12px 14px', backgroundColor: 'rgba(30,30,50,0.6)',
    borderRadius: '8px', color: '#ccc', fontSize: '13px', lineHeight: '1.6',
  },
  qaConfidence: { marginTop: '8px', fontSize: '12px', color: '#52c41a' },
  qaSources: { marginTop: '4px', fontSize: '12px', color: '#ccc' },
  inputRow: {
    display: 'flex', gap: '8px', padding: '12px 16px',
    backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  input: {
    flex: 1, padding: '10px 14px', backgroundColor: 'rgba(20,20,40,0.8)',
    border: '1px solid rgba(74,158,255,0.3)', borderRadius: '6px',
    color: '#fff', fontSize: '14px', outline: 'none',
  },
  sendButton: {
    width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(74,158,255,0.3)', border: '1px solid rgba(74,158,255,0.5)',
    borderRadius: '6px', color: '#4a9eff', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s',
  },
  miniSpinner: {
    width: '16px', height: '16px', border: '2px solid rgba(74,158,255,0.3)',
    borderTop: '2px solid #4a9eff', borderRadius: '50%', animation: 'spin 1s linear infinite',
  },
};

export default KnowledgeGraphDashboard;
