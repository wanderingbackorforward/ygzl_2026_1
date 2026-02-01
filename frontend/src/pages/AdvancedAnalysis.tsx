import React, { useState, useCallback } from 'react';
import { ProfileChart, TimeSlider, JointDashboard, EventManager } from '../components/advanced';
import { useProfileData, useAvailableDates } from '../hooks/useAdvancedAnalysis';

import '../styles/variables.css';

type TabType = 'profile' | 'joint' | 'events';

const AdvancedAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Advanced Analysis</h1>
        <div style={styles.tabs}>
          <TabButton
            active={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            icon="chart-line"
          >
            Tunnel Profile
          </TabButton>
          <TabButton
            active={activeTab === 'joint'}
            onClick={() => setActiveTab('joint')}
            icon="link"
          >
            Settlement + Crack
          </TabButton>
          <TabButton
            active={activeTab === 'events'}
            onClick={() => setActiveTab('events')}
            icon="calendar-alt"
          >
            Construction Events
          </TabButton>
        </div>
      </div>

      {/* Content */}
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
        {/* Main Chart */}
        <div style={styles.chartSection}>
          {dataLoading ? (
            <div style={styles.loading}>Loading profile data...</div>
          ) : data ? (
            <ProfileChart
              profile={data.profile}
              layers={data.layers}
              date={data.date}
            />
          ) : (
            <div style={styles.empty}>No profile data available</div>
          )}
        </div>

        {/* Time Slider */}
        <div style={styles.sliderSection}>
          {datesLoading ? (
            <div style={styles.loading}>Loading dates...</div>
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

        {/* Statistics */}
        {data && (
          <div style={styles.statsSection}>
            <StatCard
              label="Total Points"
              value={data.profile.length.toString()}
              icon="map-marker-alt"
            />
            <StatCard
              label="Date"
              value={data.date || '-'}
              icon="calendar"
            />
            <StatCard
              label="Max Settlement"
              value={
                data.profile.length > 0
                  ? `${Math.min(...data.profile.map(p => p.cumulative_change ?? 0)).toFixed(2)} mm`
                  : '-'
              }
              icon="arrow-down"
              highlight
            />
            <StatCard
              label="Geological Layers"
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
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
};

export default AdvancedAnalysis;
