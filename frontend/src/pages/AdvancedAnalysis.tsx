import React, { useState, useCallback } from 'react';
import { ProfileChart, TimeSlider, JointDashboard, EventManager } from '../components/advanced';
import { useProfileData, useAvailableDates } from '../hooks/useAdvancedAnalysis';

import '../styles/variables.css';

type TabType = 'profile' | 'joint' | 'events';
type JointMetric = 'settlement' | 'crack' | 'correlation';

const AdvancedAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [jointMetric, setJointMetric] = useState<JointMetric>('settlement');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>高级分析</h1>
          <div style={styles.tabs}>
            <TabButton
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
              icon="chart-line"
            >
              纵断面
            </TabButton>
            <TabButton
              active={activeTab === 'joint'}
              onClick={() => setActiveTab('joint')}
              icon="link"
            >
              沉降 + 裂缝
            </TabButton>
            <TabButton
              active={activeTab === 'events'}
              onClick={() => setActiveTab('events')}
              icon="calendar-alt"
            >
              施工事件
            </TabButton>
          </div>
        </div>
        {activeTab === 'joint' && (
          <div style={styles.headerSub}>
            <span style={styles.subLabel}>指标（预留）</span>
            <select
              value={jointMetric}
              onChange={e => setJointMetric(e.target.value as JointMetric)}
              style={styles.subSelect}
            >
              <option value="settlement">沉降</option>
              <option value="crack">裂缝宽度</option>
              <option value="correlation">相关性/联动</option>
            </select>
            <span style={styles.subHint}>后续可在此扩展“沉降/裂缝/联动”等筛选</span>
          </div>
        )}
      </div>

      <div style={styles.content}>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'joint' && <JointTab />}
        {activeTab === 'events' && <EventsTab />}
      </div>
    </div>
  );
};

// Tab Button Component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    style={{
      ...styles.tabButton,
      ...(active ? styles.tabButtonActive : {}),
    }}
    onClick={onClick}
  >
    <i className={`fas fa-${icon}`} style={styles.tabIcon} />
    {children}
  </button>
);

// Profile Tab
const ProfileTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const { dates, loading: datesLoading } = useAvailableDates();
  const { data, loading: dataLoading } = useProfileData(selectedDate);

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
              value={data.profile.length.toString()}
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
                data.profile.length > 0
                  ? `${Math.min(...data.profile.map(p => p.cumulative_change ?? 0)).toFixed(2)} mm`
                  : '-'
              }
              icon="arrow-down"
              highlight
            />
            <StatCard
              label="地层数"
              value={data.layers.length.toString()}
              icon="layer-group"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Joint Tab
const JointTab: React.FC = () => {
  return (
    <div style={styles.tabContent}>
      <JointDashboard />
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
  tabs: {
    display: 'flex',
    gap: '8px',
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  tabIcon: {
    fontSize: '14px',
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
    gridTemplateColumns: 'repeat(4, 1fr)',
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
