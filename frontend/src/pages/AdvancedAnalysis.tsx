import React, { useState, useCallback } from 'react';
import { ProfileChart, TimeSlider, JointDashboard, EventManager } from '../components/advanced';
import { AnomalyDashboard, RecommendationDashboard, PredictionDashboard, CorrelationDashboard, DeepLearningDashboard, ExplainabilityDashboard, KnowledgeGraphDashboard } from '../components/analysis';
import { MockModeIndicator } from '../components/common/MockModeIndicator';
import { useProfileData, useAvailableDates, useProfileStatistics } from '../hooks/useAdvancedAnalysis';

import '../styles/variables.css';

type TabType = 'anomaly' | 'recommendation' | 'prediction' | 'deeplearning' | 'correlation' | 'explainability' | 'knowledgegraph' | 'profile' | 'joint' | 'events';
type JointMetric = 'settlement' | 'crack' | 'correlation';

interface TabItem {
  id: TabType;
  label: string;
  icon: string;
  desc: string;
  hint?: string;
}

interface AnalysisGroup {
  label: string;
  icon: string;
  items: TabItem[];
}

// 分析模块分组 —— 按项目经理决策流程: 看现状 → 防风险 → 查原因 → 查数据
const analysisGroups: AnalysisGroup[] = [
  {
    label: '当前状况',
    icon: 'clipboard-check',
    items: [
      { id: 'anomaly', label: '安全排查', icon: 'search', desc: '自动扫描全部 25 个监测点,列出有问题的点位和严重程度' },
      { id: 'recommendation', label: '处置方案', icon: 'clipboard-list', desc: '针对发现的问题,给出具体的处置措施和紧急程度' },
    ],
  },
  {
    label: '风险预警',
    icon: 'exclamation-circle',
    items: [
      {
        id: 'prediction',
        label: '沉降预警',
        icon: 'chart-area',
        desc: '预测未来 30 天各点位的沉降变化,提前发现可能超限的点位',
        hint: '本页提供快速预测。如需更全面的预测(温度/振动/裂缝/盾构),请查看「综合预测」',
      },
      {
        id: 'deeplearning',
        label: '综合预测',
        icon: 'brain',
        desc: '汇总全部 8 个预测模型,覆盖沉降、温度、振动、裂缝、盾构 5 类监测数据',
        hint: '本页展示所有预测模型的汇总结果。如需专门查看沉降预测,请回到「沉降预警」',
      },
    ],
  },
  {
    label: '原因分析',
    icon: 'project-diagram',
    items: [
      {
        id: 'correlation',
        label: '施工影响',
        icon: 'hard-hat',
        desc: '评估施工活动(如开挖、降水)对周边沉降的实际影响程度',
        hint: '本页回答「施工导致了多少沉降」。如需找出主要影响因素,请查看「因素排查」',
      },
      {
        id: 'explainability',
        label: '因素排查',
        icon: 'list-ol',
        desc: '排查各项因素对沉降的影响程度,找出主要原因和相互关联的点位',
        hint: '本页回答「什么因素影响最大」。如需评估施工的具体影响,请查看「施工影响」',
      },
    ],
  },
  {
    label: '工程数据',
    icon: 'database',
    items: [
      { id: 'profile', label: '全线剖面', icon: 'chart-line', desc: '沿隧道线路方向展示所有监测点的沉降剖面,支持按日期回放' },
      { id: 'joint', label: '关联分析', icon: 'link', desc: '同时查看沉降和裂缝数据,判断两者是否有关联' },
      { id: 'events', label: '施工记录', icon: 'calendar-alt', desc: '记录和管理施工事件(如爆破、开挖),为原因分析提供依据' },
      { id: 'knowledgegraph', label: '工程知识库', icon: 'book', desc: '上传工程文献和技术笔记,系统自动整理为可检索的知识库' },
    ],
  },
];

const AdvancedAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('anomaly');
  const [jointMetric, setJointMetric] = useState<JointMetric>('settlement');

  // 获取当前激活的标签信息
  const getActiveTabInfo = (): { group: string; item: TabItem } | null => {
    for (const group of analysisGroups) {
      const item = group.items.find(i => i.id === activeTab);
      if (item) return { group: group.label, item };
    }
    return null;
  };

  const activeInfo = getActiveTabInfo();

  return (
    <div style={styles.container}>
      <MockModeIndicator />
      <div style={styles.body}>
        {/* ── 左侧边栏导航 ── */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <i className="fas fa-cogs" style={styles.sidebarHeaderIcon} />
            <span style={styles.sidebarHeaderText}>安全分析</span>
          </div>
          <nav style={styles.nav}>
            {analysisGroups.map(group => (
              <div key={group.label} style={styles.navGroup}>
                <div style={styles.navGroupHeader}>
                  <i className={`fas fa-${group.icon}`} style={styles.navGroupIcon} />
                  <span style={styles.navGroupLabel}>{group.label}</span>
                </div>
                {group.items.map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      style={{
                        ...styles.navCard,
                        ...(isActive ? styles.navCardActive : {}),
                      }}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <i className={`fas fa-${item.icon}`} style={{ ...styles.navCardIcon, ...(isActive ? styles.navCardIconActive : {}) }} />
                      <span style={{ ...styles.navCardLabel, ...(isActive ? styles.navCardLabelActive : {}) }}>
                        {item.label}
                      </span>
                      {isActive && <i className="fas fa-chevron-right" style={styles.navCardArrow} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── 右侧内容区 ── */}
        <main style={styles.main}>
          {/* 当前模块描述栏 */}
          {activeInfo && (
            <div style={styles.descBar}>
              <div style={styles.descBarLeft}>
                <i className={`fas fa-${activeInfo.item.icon}`} style={styles.descIcon} />
                <div style={styles.descContent}>
                  <div style={styles.descTitleRow}>
                    <span style={styles.descTitle}>{activeInfo.item.label}</span>
                    <span style={styles.descGroup}>{activeInfo.group}</span>
                  </div>
                  <span style={styles.descText}>{activeInfo.item.desc}</span>
                </div>
              </div>
              {activeTab === 'joint' && (
                <div style={styles.jointSelector}>
                  <span style={styles.jointLabel}>指标</span>
                  <select
                    value={jointMetric}
                    onChange={e => setJointMetric(e.target.value as JointMetric)}
                    style={styles.jointSelect}
                  >
                    <option value="settlement">沉降</option>
                    <option value="crack">裂缝宽度</option>
                    <option value="correlation">相关性/联动</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 交叉引用提示 —— 消除"重复"困惑 */}
          {activeInfo?.item.hint && (
            <div style={styles.hintBar}>
              <i className="fas fa-lightbulb" style={styles.hintIcon} />
              <span style={styles.hintText}>{activeInfo.item.hint}</span>
            </div>
          )}

          {/* 内容区 */}
          <div style={styles.content}>
            {activeTab === 'anomaly' && <AnomalyTab />}
            {activeTab === 'recommendation' && <RecommendationTab />}
            {activeTab === 'prediction' && <PredictionTab />}
            {activeTab === 'deeplearning' && <DeepLearningTab />}
            {activeTab === 'correlation' && <CorrelationTab />}
            {activeTab === 'explainability' && <ExplainabilityTab />}
            {activeTab === 'knowledgegraph' && <KnowledgeGraphTab />}
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'joint' && <JointTab metric={jointMetric} />}
            {activeTab === 'events' && <EventsTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

// Anomaly Tab
const AnomalyTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <AnomalyDashboard />
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

// Prediction Tab
const PredictionTab: React.FC = () => {
  // 全部25个训练好的监测点位
  const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

  return (
    <div style={styles.tabContent}>
      <PredictionDashboard pointIds={pointIds} threshold={-30} />
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
  const { dates, loading: datesLoading } = useAvailableDates();
  const { data, loading: dataLoading } = useProfileData(selectedDate);
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
            <div style={styles.loading}>正在加载纵断面数据...</div>
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
              <div style={styles.emptyTitle}>暂无纵断面数据</div>
              <div style={styles.emptyHint}>
                暂无沉降数据,请联系技术团队确认数据采集
              </div>
            </div>
          )}
        </div>

        <div style={styles.sliderSection}>
          {datesLoading ? (
            <div style={styles.loading}>正在加载日期...</div>
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
          <div style={styles.statsSection}>
            <StatCard
              label="点位总数"
              value={(statistics?.total_points ?? data.profile.length).toString()}
              icon="map-marker-alt"
            />
            <StatCard
              label="日期"
              value={data.date || '-'}
              icon="calendar"
            />
            <StatCard
              label="最大沉降"
              value={
                statistics?.max_settlement_point?.total_change !== null && statistics?.max_settlement_point?.total_change !== undefined
                  ? `${statistics.max_settlement_point.total_change.toFixed(2)} mm`
                  : data.profile.length > 0
                  ? (() => {
                      const minValue = Math.min(...data.profile.map(p => p.cumulative_change ?? 0));
                      return isFinite(minValue) ? `${minValue.toFixed(2)} mm` : '-';
                    })()
                  : '-'
              }
              icon="arrow-down"
              highlight
            />
            <StatCard
              label="最大沉降点"
              value={statistics?.max_settlement_point?.point_id || '-'}
              icon="crosshairs"
            />
            <StatCard
              label="预警点位"
              value={
                statistics?.points
                  ? statistics.points.filter(p => p.alert_level && p.alert_level !== 'normal').length.toString()
                  : '-'
              }
              icon="exclamation-triangle"
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

// Stat Card Component
const StatCard: React.FC<{
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}> = ({ label, value, icon, highlight }) => (
  <div style={{ ...styles.statCard, ...(highlight ? styles.statCardHighlight : {}) }}>
    <div style={styles.statIcon}>
      <i className={`fas fa-${icon}`} />
    </div>
    <div style={styles.statContent}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0a0a1a',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  // ── 主体布局: 左侧边栏 + 右侧内容 ──
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  // ── 侧边栏 ──
  sidebar: {
    width: '220px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 15, 30, 0.95)',
    borderRight: '1px solid rgba(74, 158, 255, 0.15)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.15)',
  },
  sidebarHeaderIcon: {
    fontSize: '18px',
    color: '#4a9eff',
  },
  sidebarHeaderText: {
    fontSize: '16px',
    fontWeight: 'bold',
    background: 'linear-gradient(90deg, #4a9eff, #00d4ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
  },
  navGroup: {
    marginBottom: '16px',
  },
  navGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px 8px',
  },
  navGroupIcon: {
    fontSize: '11px',
    color: 'rgba(74, 158, 255, 0.5)',
  },
  navGroupLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(74, 158, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  navCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '8px',
    color: '#ccc',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
    marginBottom: '2px',
  },
  navCardActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.12)',
    border: '1px solid rgba(74, 158, 255, 0.4)',
    color: '#4a9eff',
  },
  navCardIcon: {
    fontSize: '14px',
    color: 'rgba(170, 170, 190, 0.6)',
    width: '18px',
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  navCardIconActive: {
    color: '#4a9eff',
  },
  navCardLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  navCardLabelActive: {
    color: '#4a9eff',
    fontWeight: 600,
  },
  navCardArrow: {
    fontSize: '10px',
    color: '#4a9eff',
    flexShrink: 0,
  },
  // ── 右侧主内容区 ──
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  // ── 描述栏 ──
  descBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 20px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    borderBottom: '1px solid rgba(74, 158, 255, 0.15)',
    flexShrink: 0,
  },
  descBarLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    flex: 1,
    minWidth: 0,
  },
  descIcon: {
    fontSize: '20px',
    color: '#4a9eff',
    flexShrink: 0,
    marginTop: '2px',
  },
  descContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  descTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  descTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  descGroup: {
    fontSize: '11px',
    color: 'rgba(74, 158, 255, 0.6)',
    padding: '2px 8px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '10px',
    flexShrink: 0,
  },
  descText: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.5,
  },
  // ── 交叉引用提示栏 ──
  hintBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    backgroundColor: 'rgba(255, 169, 64, 0.08)',
    borderBottom: '1px solid rgba(255, 169, 64, 0.15)',
    flexShrink: 0,
  },
  hintIcon: {
    fontSize: '14px',
    color: '#ffa940',
    flexShrink: 0,
  },
  hintText: {
    fontSize: '12px',
    color: 'rgba(255, 169, 64, 0.85)',
    lineHeight: 1.5,
  },
  // ── joint 子选择器 ──
  jointSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  jointLabel: {
    fontSize: '12px',
    color: '#888',
    whiteSpace: 'nowrap' as const,
  },
  jointSelect: {
    padding: '6px 10px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    outline: 'none',
  },
  // ── 内容区 ──
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
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
