import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileChart, TimeSlider, JointDashboard, EventManager } from '../components/advanced';
import { RecommendationDashboard, CorrelationDashboard, DeepLearningDashboard, ExplainabilityDashboard, KnowledgeGraphDashboard } from '../components/analysis';
import { useProfileData, useAvailableDates, useProfileStatistics } from '../hooks/useAdvancedAnalysis';
import { apiGet, createAlertTicket } from '../lib/api';
import { PageHeader, KpiCard } from '../components/common/ui';

import '../styles/variables.css';

type TabType = 'recommendation' | 'deeplearning' | 'correlation' | 'explainability' | 'knowledgegraph' | 'profile' | 'joint' | 'events';
type JointMetric = 'settlement' | 'crack' | 'correlation';

interface AnalysisTab {
  id: TabType;
  label: string;
  icon: string;
  desc: string;
}

// —— 按“值班决策顺序”分组，而不是按算法分组 ——
// 哪里有问题 / 会怎么发展 → 已在沉降页（SettlementV2 风险点、SettlementNew 趋势预测）
// 本页只回答：① 为什么 → ② 该怎么办
const PRIMARY_TABS: AnalysisTab[] = [
  { id: 'correlation', label: '① 施工影响多大', icon: 'project-diagram', desc: '选一个点位和施工事件，算出施工让它多沉了多少；也可以看哪些点位在同步变化' },
  { id: 'recommendation', label: '② 该怎么处理', icon: 'clipboard-list', desc: '按异常等级给出处置方案：紧急巡检 / 加密监测 / 持续跟踪' },
];

// 专题视图：按监测对象查看
const TOPIC_TABS: AnalysisTab[] = [
  { id: 'profile', label: '纵断面', icon: 'chart-line', desc: '沿线路方向把每个点位的累计沉降画成一条剖面，可按日期回看' },
  { id: 'joint', label: '沉降 + 裂缝', icon: 'link', desc: '同时展示沉降和裂缝数据，观察两者是否联动' },
  { id: 'events', label: '施工事件', icon: 'calendar-alt', desc: '记录现场施工（开挖、盾构、降水等），分析影响时直接选用' },
];

// 实验与资料：模型实验、因素分析与文献知识，不属于日常值班主流程
const LAB_TABS: AnalysisTab[] = [
  { id: 'explainability', label: '影响因素', icon: 'chart-bar', desc: '找出影响沉降的关键因素排序' },
  { id: 'deeplearning', label: '深度学习预测', icon: 'brain', desc: '用深度学习模型做更精准的预测（实验性）' },
  { id: 'knowledgegraph', label: '知识库', icon: 'share-alt', desc: '上传文献和笔记，自动整理出人物、工程、地点之间的关系，回答时标出来源' },
];

const ALL_TABS: AnalysisTab[] = [...PRIMARY_TABS, ...TOPIC_TABS, ...LAB_TABS];

// 链路参数：从总览/指标页带过来的点位
interface PointDetail {
  point_id: string;
  type: 'settlement' | 'temperature' | 'crack';
  matched: boolean;
  source_table?: string;
  data_cutoff?: string;
  latest?: Record<string, any>;
  note?: string;
  sid?: number | string;
}

function severityFromAlert(level?: string): 'low' | 'medium' | 'high' {
  if (!level) return 'low';
  if (/高|报警/.test(level)) return 'high';
  if (/中|需关注/.test(level)) return 'medium';
  return 'low';
}

const PointContextBar: React.FC<{ pointId: string; from?: string | null }> = ({ pointId, from }) => {
  const navigate = useNavigate();
  const [info, setInfo] = useState<PointDetail | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    setError('');
    apiGet<PointDetail>(`/metrics/point/${encodeURIComponent(pointId)}`)
      .then(d => { if (alive) setInfo(d); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : '点位数据不可用'); });
    return () => { alive = false; };
  }, [pointId]);

  const isTemp = info?.type === 'temperature';
  const latestValue = isTemp ? info?.latest?.avg_temperature : info?.latest?.total_change;
  const alertLevel = info?.latest?.alert_level;
  const canCreate = !!info?.matched && info?.type !== 'crack';

  const handleCreate = async () => {
    if (!info?.matched) return;
    setCreating(true);
    setError('');
    try {
      const res = await createAlertTicket({
        dataType: isTemp ? 'temperature' : 'settlement',
        pointId: info.point_id,
        title: `[${info.point_id}] ${isTemp ? '温度' : '沉降'}异常复核`,
        description: `${info.point_id} 告警级别：${alertLevel || '未知'}；最新值：${latestValue ?? '-'}；数据截止：${info.data_cutoff || '-'}。来源：${from || '分析诊断'}`,
        severity: severityFromAlert(alertLevel),
        anomalyType: 'threshold_exceeded',
        currentValue: latestValue ?? null,
        threshold: isTemp ? 30 : -5,
        sendEmail: false,
        source: from || 'advanced_analysis',
      });
      const ticketId = res?.id;
      navigate(ticketId ? `/tickets?ticketId=${ticketId}&created=1` : '/tickets');
    } catch (e) {
      setError(e instanceof Error ? e.message : '建单失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.pointBar}>
      <span style={styles.pointBarLabel}>当前点位</span>
      <span style={styles.pointBarId}>{pointId}</span>
      {info ? (
        <span style={styles.pointBarMeta}>
          {info.type === 'temperature' ? '温度' : info.type === 'crack' ? '裂缝' : '沉降'}
          {info.data_cutoff ? ` · 截止 ${info.data_cutoff.slice(0, 10)}` : ''}
          {info.matched ? ` · 最新值 ${typeof latestValue === 'number' ? latestValue.toFixed(2) : '-'}` : ' · 未映射到主表'}
        </span>
      ) : (
        <span style={styles.pointBarMeta}>{error || '读取点位数据…'}</span>
      )}
      {error && info && <span style={styles.pointBarError}>{error}</span>}
      <div style={{ flex: 1 }} />
      <button
        style={{ ...styles.pointBarButton, ...styles.pointBarPrimary, opacity: creating || !canCreate ? 0.5 : 1 }}
        disabled={creating || !canCreate}
        onClick={handleCreate}
      >
        {creating ? '建单中…' : info?.type === 'crack' ? '裂缝需手动建单' : '建单并转工单'}
      </button>
      {info && (
        <button
          style={styles.pointBarButton}
          onClick={() => {
            const target = info.type === 'temperature'
              ? `/temperature?point=${encodeURIComponent(String(info.sid ?? info.point_id))}`
              : info.type === 'crack'
              ? `/cracks?point=${encodeURIComponent(info.point_id)}`
              : `/settlement?point=${encodeURIComponent(info.point_id)}`;
            navigate(target);
          }}
        >
          查看点位
        </button>
      )}
      <button style={styles.pointBarButton} onClick={() => navigate('/advanced', { replace: true })}>
        取消点位
      </button>
    </div>
  );
};

const AdvancedAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('correlation');
  const [jointMetric, setJointMetric] = useState<JointMetric>('settlement');
  const [searchParams] = useSearchParams();
  const pointParam = searchParams.get('point');
  const fromParam = searchParams.get('from');

  const navigate = useNavigate();
  const activeInfo = ALL_TABS.find(i => i.id === activeTab) || null;
  const renderTab = (tab: AnalysisTab) => (
    <button
      key={tab.id}
      type="button"
      className={`ds-seg__item ${activeTab === tab.id ? 'ds-seg__item--active' : ''}`}
      onClick={() => setActiveTab(tab.id)}
      title={tab.desc}
    >
      <i className={`fas fa-${tab.icon}`} style={{ marginRight: 5 }} />
      {tab.label}
    </button>
  );

  return (
    <div style={styles.container}>
      {pointParam && <PointContextBar pointId={pointParam} from={fromParam} />}

      <PageHeader
        eyebrow="施工影响多大、该怎么处理"
        title="分析诊断"
        description={activeInfo?.desc}
        meta={
          <span className="ds-chip ds-chip--accent">
            {activeInfo?.label ?? '分析'}
          </span>
        }
        actions={
          <button type="button" className="ds-btn" onClick={() => navigate('/overview')}>
            回到总览
          </button>
        }
      />

      {/* 按决策顺序分组；所有能力都可见，不再藏在“更多”下拉里 */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 20px',
        borderBottom: '1px solid var(--ds-divider)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--ds-text-muted)', whiteSpace: 'nowrap' }}>主流程</span>
          {PRIMARY_TABS.map(renderTab)}
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--ds-text-muted)', fontSize: 11 }}>不确定从哪看？按 ①② 从左到右即可</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--ds-text-muted)', whiteSpace: 'nowrap' }}>专题视图</span>
          {TOPIC_TABS.map(renderTab)}
          <span style={{ width: 12 }} />
          <span style={{ fontSize: 11, color: 'var(--ds-text-muted)', whiteSpace: 'nowrap' }}>实验与资料</span>
          {LAB_TABS.map(renderTab)}
        </div>
      </div>

      {activeTab === 'joint' && (
        <div style={styles.headerSub}>
          <span style={styles.subLabel}>指标</span>
          <select
            value={jointMetric}
            onChange={e => setJointMetric(e.target.value as JointMetric)}
            style={styles.subSelect}
          >
            <option value="settlement">沉降</option>
            <option value="crack">裂缝宽度</option>
            <option value="correlation">相关性/联动</option>
          </select>
          <span style={styles.subHint}>切换到"相关性/联动"可查看相关性摘要与联动结果</span>
        </div>
      )}

      <div style={styles.content}>
        {activeTab === 'recommendation' && <RecommendationTab />}
        {activeTab === 'deeplearning' && <DeepLearningTab />}
        {activeTab === 'correlation' && <CorrelationTab />}
        {activeTab === 'explainability' && <ExplainabilityTab />}
        {activeTab === 'knowledgegraph' && <KnowledgeGraphTab />}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'joint' && <JointTab metric={jointMetric} />}
        {activeTab === 'events' && <EventsTab />}
      </div>
    </div>
  );
};

// Recommendation Tab
const RecommendationTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <RecommendationDashboard />
    </div>
  );
};

// Deep Learning Tab
const DeepLearningTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <DeepLearningDashboard />
    </div>
  );
};

// Correlation Tab
const CorrelationTab: React.FC = () => {
  // 全部25个监测点位
  const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

  return (
    <div style={styles.tabContent}>
      <CorrelationDashboard pointIds={pointIds} />
    </div>
  );
};

// Explainability Tab
const ExplainabilityTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <ExplainabilityDashboard />
    </div>
  );
};

// Knowledge Graph Tab
const KnowledgeGraphTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <KnowledgeGraphDashboard />
    </div>
  );
};

// Profile Tab
const ProfileTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const { dates, loading: datesLoading, error: datesError } = useAvailableDates();
  const { data, loading: dataLoading, error: profileError } = useProfileData(selectedDate);
  const { statistics } = useProfileStatistics();

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handlePlayToggle = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  return (
    <div style={styles.tabContent}>
      <div style={styles.profileContainer}>
        <div style={styles.chartSection}>
          {dataLoading ? (
            <div style={styles.loading}>正在加载剖面数据…</div>
          ) : profileError ? (
            <div style={styles.emptyContainer}>
              <div style={styles.emptyIcon}>
                <i className="fas fa-exclamation-triangle" />
              </div>
              <div style={styles.emptyTitle}>剖面数据加载失败</div>
              <div style={{ ...styles.emptyHint, color: 'var(--ds-danger-text)' }}>{profileError}</div>
            </div>
          ) : data && data.profile && data.profile.length > 0 ? (
            <ProfileChart
              profile={data.profile}
              layers={data.layers}
              date={data.date}
            />
          ) : (
            <div style={styles.emptyContainer}>
              <div style={styles.emptyIcon}>
                <i className="fas fa-chart-line" />
              </div>
              <div style={styles.emptyTitle}>这一天没有沉降测次</div>
              <div style={styles.emptyHint}>
                沉降原始数据到 2021-12-24 为止，换一个更早的日期看看
              </div>
            </div>
          )}
        </div>

        <div style={styles.sliderSection}>
          {datesLoading ? (
            <div style={styles.loading}>正在加载日期...</div>
          ) : datesError ? (
            <div style={styles.loading}>日期加载失败：{datesError}</div>
          ) : (
            <TimeSlider
              dates={dates}
              currentDate={selectedDate || dates[dates.length - 1] || null}
              onDateChange={handleDateChange}
              isPlaying={isPlaying}
              onPlayToggle={handlePlayToggle}
              playInterval={500}
            />
          )}
        </div>

        {data && (
          <div className="ds-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <KpiCard
              compact
              label="点位总数"
              value={(statistics?.total_points ?? data.profile.length).toString()}
              unit="个"
              tone="info"
            />
            <KpiCard compact label="日期" value={data.date || '-'} />
            <KpiCard
              compact
              label="最大沉降"
              value={
                statistics?.max_settlement_point?.total_change !== null && statistics?.max_settlement_point?.total_change !== undefined
                  ? statistics.max_settlement_point.total_change.toFixed(2)
                  : data.profile.length > 0
                  ? (() => {
                      const minValue = Math.min(...data.profile.map(p => p.cumulative_change ?? 0));
                      return isFinite(minValue) ? minValue.toFixed(2) : '-';
                    })()
                  : '-'
              }
              unit="mm"
              tone="danger"
            />
            <KpiCard
              compact
              label="最大沉降点"
              value={statistics?.max_settlement_point?.point_id || '-'}
            />
            <KpiCard
              compact
              label="预警点位"
              value={
                statistics?.points
                  ? statistics.points.filter(p => p.level === 'warning' || p.level === 'alert').length.toString()
                  : '-'
              }
              unit="个"
              tone="warn"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Joint Tab
const JointTab: React.FC<{ metric: JointMetric }> = ({ metric }) => {
  return (
    <div style={styles.tabContent}>
      <JointDashboard metric={metric} />
    </div>
  );
};

// Events Tab
const EventsTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <EventManager />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--ds-bg-deep)',
    color: 'var(--ds-text)',
    fontFamily: 'var(--ds-font)',
  },
  pointBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 24px',
    flexShrink: 0,
    background: 'rgba(6, 30, 60, 0.95)',
    borderBottom: '1px solid rgba(0, 229, 255, 0.35)',
  },
  pointBarLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  pointBarId: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#00e5ff',
  },
  pointBarMeta: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.65)',
  },
  pointBarError: {
    fontSize: '12px',
    color: '#f87171',
  },
  pointBarButton: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid rgba(0,229,255,0.35)',
    background: 'transparent',
    color: '#00e5ff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pointBarPrimary: {
    background: 'rgba(0,229,255,0.18)',
    color: '#fff',
    fontWeight: 600,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSub: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: 'var(--ds-surface)',
    borderRadius: 'var(--ds-radius-sm)',
    border: '1px solid var(--ds-border)',
  },
  subLabel: {
    fontSize: '12px',
    color: '#888',
    whiteSpace: 'nowrap',
  },
  subSelect: {
    padding: '6px 10px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    outline: 'none',
  },
  subHint: {
    fontSize: '12px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    background: 'linear-gradient(90deg, #4a9eff, #00d4ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  selectorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  selectorLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#888',
    whiteSpace: 'nowrap',
  },
  selector: {
    padding: '10px 16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '200px',
    transition: 'all 0.2s',
  },
  activeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
    borderRadius: '20px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
  },
  activeIcon: {
    fontSize: '14px',
    color: '#4a9eff',
  },
  activeText: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#4a9eff',
  },
  activeGroup: {
    fontSize: '12px',
    color: '#888',
  },
  descBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.08)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.15)',
  },
  descIcon: {
    fontSize: '14px',
    color: '#4a9eff',
    flexShrink: 0,
  },
  descText: {
    fontSize: '13px',
    color: '#fff',
    lineHeight: '1.5',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '20px',
  },
  tabContent: {
    height: '100%',
  },
  profileContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
  },
  chartSection: {
    flex: 1,
    minHeight: '400px',
    backgroundColor: 'rgba(20, 20, 40, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    overflow: 'hidden',
  },
  sliderSection: {
    flexShrink: 0,
  },
  statsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '16px',
    flexShrink: 0,
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  statCardHighlight: {
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  statIcon: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderRadius: '8px',
    color: '#4a9eff',
    fontSize: '16px',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    marginTop: '2px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '48px',
    color: 'rgba(74, 158, 255, 0.3)',
  },
  emptyTitle: {
    fontSize: '18px',
    color: '#888',
  },
  emptyHint: {
    fontSize: '12px',
    color: '#555',
  },
};

export default AdvancedAnalysis;
