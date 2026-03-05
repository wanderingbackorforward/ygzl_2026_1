import React, { useState, useCallback } from 'react';
import { ProfileChart, TimeSlider, JointDashboard, EventManager } from '../components/advanced';
import { AnomalyDashboard, RecommendationDashboard, PredictionDashboard, CorrelationDashboard } from '../components/analysis';
import { MockModeIndicator } from '../components/common/MockModeIndicator';
import { useProfileData, useAvailableDates, useProfileStatistics } from '../hooks/useAdvancedAnalysis';

import '../styles/variables.css';

type TabType = 'anomaly' | 'recommendation' | 'prediction' | 'correlation' | 'profile' | 'joint' | 'events';
type JointMetric = 'settlement' | 'crack' | 'correlation';

// 分析模块分组
const analysisGroups = [
  {
    label: '第一阶段：智能诊断',
    items: [
      { id: 'anomaly' as TabType, label: '异常检测', icon: 'exclamation-triangle' },
      { id: 'recommendation' as TabType, label: '处置建议', icon: 'clipboard-list' },
    ],
  },
  {
    label: '第二阶段：趋势预测',
    items: [
      { id: 'prediction' as TabType, label: '预测分析', icon: 'chart-area' },
    ],
  },
  {
    label: '第三阶段：关联分析',
    items: [
      { id: 'correlation' as TabType, label: '因果与空间', icon: 'project-diagram' },
    ],
  },
  {
    label: '额外功能',
    items: [
      { id: 'profile' as TabType, label: '纵断面', icon: 'chart-line' },
      { id: 'joint' as TabType, label: '沉降+裂缝', icon: 'link' },
      { id: 'events' as TabType, label: '施工事件', icon: 'calendar-alt' },
    ],
  },
];

const AdvancedAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('anomaly');
  const [jointMetric, setJointMetric] = useState<JointMetric>('settlement');

  // 获取当前激活的标签信息
  const getActiveTabInfo = () => {
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
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>高级分析</h1>

          {/* 下拉选择器 */}
          <div style={styles.selectorContainer}>
            <label style={styles.selectorLabel}>分析模块:</label>
            <select
              value={activeTab}
              onChange={e => setActiveTab(e.target.value as TabType)}
              style={styles.selector}
            >
              {analysisGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* 当前选中的模块信息 */}
            {activeInfo && (
              <div style={styles.activeInfo}>
                <i className={`fas fa-${activeInfo.item.icon}`} style={styles.activeIcon} />
                <span style={styles.activeText}>{activeInfo.item.label}</span>
                <span style={styles.activeGroup}>({activeInfo.group})</span>
              </div>
            )}
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
      </div>

      <div style={styles.content}>
        {activeTab === 'anomaly' && <AnomalyTab />}
        {activeTab === 'recommendation' && <RecommendationTab />}
        {activeTab === 'prediction' && <PredictionTab />}
        {activeTab === 'correlation' && <CorrelationTab />}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'joint' && <JointTab metric={jointMetric} />}
        {activeTab === 'events' && <EventsTab />}
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
  // 获取所有监测点位ID，这里使用示例数据，实际应该从API获取
  const pointIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

  return (
    <div style={styles.tabContent}>
      <PredictionDashboard pointIds={pointIds} threshold={-30} />
    </div>
  );
};

// Correlation Tab
const CorrelationTab: React.FC = () => {
  // 获取所有监测点位ID
  const pointIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

  return (
    <div style={styles.tabContent}>
      <CorrelationDashboard pointIds={pointIds} />
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
                请确保 processed_settlement_data 表中有沉降数据
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
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.18)',
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
  content: {
    flex: 1,
    overflow: 'hidden',
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
