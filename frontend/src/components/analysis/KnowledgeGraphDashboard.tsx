import React, { useState, useCallback, useEffect, useRef } from 'react';
import KnowledgeGraphViz from '../assistant/KnowledgeGraphViz';
import {
  fetchKGStats,
  fetchKGNeighbors,
  fetchKGRiskPoints,
  fetchKGQA,
  fetchKGDocuments,
  addKGDocument,
  deleteKGDocument,
} from '../../utils/apiClient';

type SubTab = 'docs' | 'explore' | 'risk' | 'qa';

export const KnowledgeGraphDashboard: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('docs');
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [qaQuestion, setQaQuestion] = useState('');

  // Auto-insights: proactively answer key questions for the user
  const [insights, setInsights] = useState<Array<{ q: string; a: any; loading: boolean; category?: string; icon?: string; color?: string }>>([]);
  const insightsLoaded = useRef(false);

  useEffect(() => {
    fetchKGStats()
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // Smart default tab: show explore if has data, docs if empty
  useEffect(() => {
    if (stats && !stats.mock && stats.total_nodes > 0 && subTab === 'docs') {
      setSubTab('explore');
    }
  }, [stats]);

  // Auto-load insights when graph has data
  useEffect(() => {
    if (!stats || stats.total_nodes === 0 || insightsLoaded.current) return;
    insightsLoaded.current = true;

    const insightCategories = [
      {
        title: '风险预警', icon: 'exclamation-triangle', color: '#ef4444',
        questions: [
          '哪些点位风险最高？',
          '哪些点位沉降超过预警阈值？',
          '最近有哪些异常事件？',
        ],
      },
      {
        title: '施工影响', icon: 'hard-hat', color: '#f59e0b',
        questions: [
          '盾构施工如何影响地表沉降？',
          '爆破振动对结构有什么影响？',
          '基坑开挖对邻近建筑的影响？',
        ],
      },
      {
        title: '地质与环境', icon: 'mountain', color: '#38bdf8',
        questions: [
          '地下水对沉降有什么影响？',
          '软土地基沉降有什么特征？',
          '温度变化对监测数据有什么影响？',
        ],
      },
      {
        title: '控制与处置', icon: 'shield-alt', color: '#10b981',
        questions: [
          '沉降控制措施有哪些？',
          '裂缝和沉降有什么关系？',
          '注浆加固效果如何？',
        ],
      },
      {
        title: '监测技术', icon: 'satellite-dish', color: '#a78bfa',
        questions: [
          '监测数据异常值如何识别？',
          '多源数据融合有什么优势？',
          '沉降监测自动化系统怎么设计？',
        ],
      },
      {
        title: '规范标准', icon: 'book-open', color: '#06b6d4',
        questions: [
          '沉降监测规范有哪些要求？',
          '监测点位如何优化布设？',
          '沉降速率阈值如何动态调整？',
        ],
      },
    ];

    // Flatten all questions with category info
    const allQuestions = insightCategories.flatMap(cat =>
      cat.questions.map(q => ({ q, category: cat.title, icon: cat.icon, color: cat.color }))
    );

    setInsights(allQuestions.map(aq => ({ q: aq.q, a: null, loading: true, category: aq.category, icon: aq.icon, color: aq.color })));

    allQuestions.forEach((aq, idx) => {
      // Stagger requests to avoid overloading
      setTimeout(() => {
        fetchKGQA(aq.q)
          .then(result => {
            setInsights(prev => prev.map((item, i) =>
              i === idx ? { ...item, a: result, loading: false } : item
            ));
          })
          .catch(() => {
            setInsights(prev => prev.map((item, i) =>
              i === idx ? { ...item, a: null, loading: false } : item
            ));
          });
      }, idx * 200); // 200ms stagger
    });
  }, [stats]);

  // Quick question handler
  const handleQuickQuestion = (q: string) => {
    setQaQuestion(q);
    setSubTab('qa');
  };

  // Compute user-friendly stats
  const docCount = statsLoading ? '...' : String(
    (stats?.node_types?.Document || 0) + (stats?.node_types?.AcademicPaper || 0)
  );
  const pointCount = statsLoading ? '...' : String(stats?.node_types?.MonitoringPoint || 0);
  const relationCount = statsLoading ? '...' : String(stats?.total_edges ?? 0);
  const anomalyCount = statsLoading ? '...' : String(stats?.node_types?.Anomaly || 0);

  return (
    <div style={styles.container}>
      {/* Empty state: 3-step workflow guide */}
      {stats && !stats.mock && stats.total_nodes === 0 && (
        <div style={{
          display: 'flex', gap: '16px', padding: '20px',
          backgroundColor: 'rgba(74, 158, 255, 0.06)',
          border: '1px solid rgba(74, 158, 255, 0.2)',
          borderRadius: '12px', alignItems: 'stretch',
        }}>
          {/* Step 1 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(74,158,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-upload" style={{ color: '#4a9eff', fontSize: '16px' }} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>1. 添加文献</div>
            <div style={{ fontSize: '14px', color: '#e2e8f0', textAlign: 'center' }}>上传论文、笔记或粘贴文本内容</div>
          </div>
          {/* Arrow */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#4a9eff', fontSize: '18px', flexShrink: 0 }}>
            <i className="fas fa-chevron-right" />
          </div>
          {/* Step 2 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-cogs" style={{ color: '#10b981', fontSize: '16px' }} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>2. 自动构建</div>
            <div style={{ fontSize: '14px', color: '#e2e8f0', textAlign: 'center' }}>系统自动提取实体和关系，构建知识图谱</div>
          </div>
          {/* Arrow */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#4a9eff', fontSize: '18px', flexShrink: 0 }}>
            <i className="fas fa-chevron-right" />
          </div>
          {/* Step 3 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(251,146,60,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-comments" style={{ color: '#fb923c', fontSize: '16px' }} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>3. 智能问答</div>
            <div style={{ fontSize: '14px', color: '#e2e8f0', textAlign: 'center' }}>基于图谱内容提问，获得精准回答</div>
          </div>
        </div>
      )}
      {stats?.mock && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 16px',
          backgroundColor: 'rgba(255, 169, 64, 0.12)',
          border: '1px solid rgba(255, 169, 64, 0.4)',
          borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
        }}>
          <i className="fas fa-info-circle" style={{ color: '#ffa940', fontSize: '16px', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ color: '#e2e8f0' }}>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>演示模式：</span>
            当前显示模拟数据。添加文献后将使用真实图谱数据。
          </div>
        </div>
      )}

      {/* Stats cards - user friendly */}
      <div style={styles.statsGrid}>
        <StatCard label="已录文献" value={docCount} icon="book" color="#3b82f6" />
        <StatCard label="监测点位" value={pointCount} icon="map-marker-alt" color="#06b6d4" />
        <StatCard label="知识关联" value={relationCount} icon="link" color="#a78bfa" />
        <StatCard label="异常发现" value={anomalyCount} icon="exclamation-triangle" color="#ef4444" />
      </div>

      {/* Auto-insights: grouped by category */}
      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-lightbulb" style={{ color: '#facc15' }} />
            智能洞察
            <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#e2e8f0' }}>
              — 基于 {docCount} 篇文献自动分析
            </span>
          </div>
          {(() => {
            // Group insights by category
            const groups: Record<string, typeof insights> = {};
            insights.forEach(item => {
              const cat = item.category || '其他';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(item);
            });
            return Object.entries(groups).map(([catName, items]) => (
              <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                  <i className={`fas fa-${items[0]?.icon || 'folder'}`} style={{ color: items[0]?.color || '#4a9eff', fontSize: '14px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: items[0]?.color || '#fff' }}>{catName}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {items.map((insight, idx) => (
                    <div key={idx} style={{
                      padding: '12px 14px', backgroundColor: 'rgba(30,30,50,0.8)', borderRadius: '8px',
                      borderLeft: `3px solid ${insight.color || '#4a9eff'}`,
                      display: 'flex', flexDirection: 'column', gap: '6px',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{insight.q}</div>
                      {insight.loading ? (
                        <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                          <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }} />分析中...
                        </div>
                      ) : insight.a?.answer ? (
                        <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '72px', overflow: 'hidden' }}>
                          {insight.a.answer.split('\n').filter((l: string) => l.trim() && !l.startsWith('---')).slice(0, 2).join('\n')}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#e2e8f0' }}>暂无相关文献数据</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Sub-tab selector */}
      <div style={styles.subTabs}>
        <button
          style={{ ...styles.subTab, ...(subTab === 'docs' ? styles.subTabActive : {}) }}
          onClick={() => setSubTab('docs')}
        >
          <i className="fas fa-book" style={{ marginRight: '6px' }} />
          文献管理
        </button>
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

      {subTab === 'docs' && <DocsPanel onStatsChange={() => {
        fetchKGStats().then(data => setStats(data)).catch(() => {});
      }} />}
      {subTab === 'explore' && <ExplorePanel />}
      {subTab === 'risk' && <RiskPanel />}
      {subTab === 'qa' && <QAPanel initialQuestion={qaQuestion} onQuestionConsumed={() => setQaQuestion('')} />}
    </div>
  );
};

// ━━━ Docs Panel (文献管理) ━━━
const DocsPanel: React.FC<{ onStatsChange: () => void }> = ({ onStatsChange }) => {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('text');
  const [formUrl, setFormUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKGDocuments();
      setDocs(data?.documents || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await addKGDocument(formTitle, formContent, formType, formUrl);
      if (result?.success) {
        setFormTitle(''); setFormContent(''); setFormUrl(''); setShowForm(false);
        loadDocs();
        onStatsChange();
      } else {
        setError(result?.message || '添加失败，请重试');
      }
    } catch { setError('网络错误，请检查连接后重试'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (docId: string) => {
    setDeleting(docId);
    setError('');
    try {
      await deleteKGDocument(docId);
      loadDocs();
      onStatsChange();
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  return (
    <div style={styles.panelContent}>
      {/* Error message */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
          backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', fontSize: '13px', color: '#fca5a5',
        }}>
          <i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }} />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
            <i className="fas fa-times" />
          </button>
        </div>
      )}

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: '#fff' }}>
          共 {docs.length} 篇文献
        </div>
        <button
          style={{ ...styles.runButton, marginLeft: 'auto' }}
          onClick={() => setShowForm(!showForm)}
        >
          <i className={`fas fa-${showForm ? 'times' : 'plus'}`} style={{ marginRight: '6px' }} />
          {showForm ? '取消' : '添加文献'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          padding: '16px', backgroundColor: 'rgba(30,30,50,0.8)', borderRadius: '8px',
          border: '1px solid rgba(74,158,255,0.3)', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select value={formType} onChange={e => setFormType(e.target.value)} style={styles.select}>
              <option value="text">文本</option>
              <option value="url">网页链接</option>
              <option value="pdf">PDF摘要</option>
            </select>
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="文献标题"
              style={{ ...styles.input, flex: 1 }}
            />
          </div>
          {formType === 'url' && (
            <input
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              placeholder="来源链接 (可选)"
              style={styles.input}
            />
          )}
          <textarea
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            placeholder="粘贴文献内容、摘要或笔记..."
            rows={6}
            style={{ ...styles.input, resize: 'vertical', lineHeight: '1.6' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              style={{ ...styles.runButton, opacity: submitting || !formTitle.trim() || !formContent.trim() ? 0.4 : 1 }}
              onClick={handleSubmit}
              disabled={submitting || !formTitle.trim() || !formContent.trim()}
            >
              {submitting ? '处理中...' : '提交并提取知识'}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div style={styles.emptyHint}>加载中...</div>
      ) : docs.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          padding: '48px 20px', color: '#fff',
        }}>
          <i className="fas fa-book-open" style={{ fontSize: '36px', color: 'rgba(74,158,255,0.4)' }} />
          <div style={{ fontSize: '15px' }}>暂无文献</div>
          <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
            点击"添加文献"上传知识内容，系统将自动提取实体和关系
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {docs.map((doc: any) => (
            <div key={doc.id} style={{
              padding: '14px 16px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
              border: '1px solid rgba(74,158,255,0.15)', display: 'flex', alignItems: 'flex-start', gap: '14px',
            }}>
              <i className={`fas fa-${doc.source_type === 'url' ? 'link' : doc.source_type === 'pdf' ? 'file-pdf' : 'file-alt'}`}
                style={{ fontSize: '18px', color: '#4a9eff', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                  {doc.title}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#e2e8f0', flexWrap: 'wrap' }}>
                  <span>{doc.source_type === 'url' ? '网页' : doc.source_type === 'pdf' ? 'PDF' : '文本'}</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  {doc.processed && (
                    <>
                      <span style={{ color: '#52c41a' }}>
                        <i className="fas fa-check" style={{ marginRight: '4px' }} />已处理
                      </span>
                      <span>实体: {doc.entity_count}</span>
                      <span>关系: {doc.relation_count}</span>
                    </>
                  )}
                  {!doc.processed && (
                    <span style={{ color: '#facc15' }}>待处理</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deleting === doc.id}
                style={{
                  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                  fontSize: '14px', padding: '4px 8px', opacity: deleting === doc.id ? 0.4 : 0.7,
                  flexShrink: 0,
                }}
                title="删除"
              >
                <i className={`fas fa-${deleting === doc.id ? 'spinner fa-spin' : 'trash'}`} />
              </button>
            </div>
          ))}
        </div>
      )}
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
        {loading && <span style={{ fontSize: '13px', color: '#e2e8f0' }}>加载中...</span>}
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
        <div style={styles.emptyHint}>该点位暂无邻居数据。尝试选择其他点位，或添加更多文献丰富图谱。</div>
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
          <option value="critical">严重</option>
          <option value="high">高</option>
          <option value="medium">中等</option>
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
        !loading && <div style={styles.emptyHint}>未发现符合条件的风险点。尝试降低严重程度筛选条件。</div>
      )}
    </div>
  );
};

// ━━━ QA Panel ━━━
const QAPanel: React.FC<{ initialQuestion?: string; onQuestionConsumed?: () => void }> = ({ initialQuestion, onQuestionConsumed }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ q: string; a: any }>>([]);

  // Auto-fill from quick question
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim()) {
      setQuestion(initialQuestion);
      onQuestionConsumed?.();
    }
  }, [initialQuestion]);

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
                    <div style={{
                      ...styles.qaConfidence,
                      color: item.a.confidence > 0.7 ? '#52c41a' : item.a.confidence > 0.5 ? '#facc15' : '#fb923c',
                    }}>
                      <i className="fas fa-chart-line" style={{ marginRight: '4px' }} />
                      置信度: {(item.a.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                  {item.a.sources && item.a.sources.length > 0 && (
                    <div style={styles.qaSources}>
                      <i className="fas fa-bookmark" style={{ marginRight: '4px', color: '#4a9eff' }} />
                      来源: {item.a.sources.map((s: string, si: number) => (
                        <span key={si} style={{
                          display: 'inline-block', padding: '2px 8px', margin: '2px 4px',
                          backgroundColor: s === 'knowledge_graph' ? 'rgba(6,182,212,0.15)' : 'rgba(74,158,255,0.12)',
                          borderRadius: '10px', fontSize: '13px',
                          color: s === 'knowledge_graph' ? '#06b6d4' : '#e2e8f0',
                        }}>{s === 'knowledge_graph' ? '知识图谱' : s}</span>
                      ))}
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
  statValue: { fontSize: '18px', fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: '14px', color: '#fff', marginTop: '2px' },
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
  paramLabel: { fontSize: '14px', color: '#e2e8f0', whiteSpace: 'nowrap' },
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
  emptyHint: { padding: '40px', textAlign: 'center', color: '#fff', fontSize: '14px' },
  // Risk panel
  riskList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  riskCard: {
    padding: '16px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.15)',
  },
  riskHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  riskPointId: { fontSize: '16px', fontWeight: 'bold', color: '#fff' },
  severityBadge: {
    padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
  },
  riskDesc: { fontSize: '14px', color: '#e2e8f0', lineHeight: '1.5', marginBottom: '8px' },
  riskMeta: { display: 'flex', gap: '16px', fontSize: '13px', color: '#e2e8f0' },
  // QA panel
  presetRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  presetButton: {
    padding: '8px 14px', backgroundColor: 'rgba(74,158,255,0.08)',
    border: '1px solid rgba(74,158,255,0.2)', borderRadius: '16px',
    color: '#fff', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
  },
  qaHistory: {
    display: 'flex', flexDirection: 'column', gap: '16px',
    flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px',
  },
  qaItem: { display: 'flex', flexDirection: 'column', gap: '8px' },
  qaQuestion: {
    padding: '10px 14px', backgroundColor: 'rgba(74,158,255,0.1)',
    borderRadius: '8px', color: '#fff', fontSize: '14px',
  },
  qaAnswer: {
    display: 'flex', padding: '12px 14px', backgroundColor: 'rgba(30,30,50,0.6)',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6',
  },
  qaConfidence: { marginTop: '8px', fontSize: '13px', color: '#52c41a' },
  qaSources: { marginTop: '4px', fontSize: '13px', color: '#e2e8f0' },
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
