import React from 'react';

interface AnomalyStatCardsProps {
  stats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export const AnomalyStatCards: React.FC<AnomalyStatCardsProps> = ({ stats }) => {
  return (
    <div style={styles.container}>
      <StatCard
        label="异常总数"
        value={stats.total}
        icon="exclamation-circle"
        color="#4a9eff"
      />
      <StatCard
        label="严重"
        value={stats.critical}
        icon="exclamation-triangle"
        color="#ff4d4f"
        highlight={stats.critical > 0}
      />
      <StatCard
        label="高"
        value={stats.high}
        icon="exclamation"
        color="#ff7a45"
      />
      <StatCard
        label="中"
        value={stats.medium}
        icon="info-circle"
        color="#ffa940"
      />
      <StatCard
        label="低"
        value={stats.low}
        icon="check-circle"
        color="#ffc53d"
      />
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, highlight }) => {
  return (
    <div
      style={{
        ...styles.card,
        ...(highlight ? styles.cardHighlight : {}),
      }}
    >
      <div style={{ ...styles.iconContainer, backgroundColor: `${color}20` }}>
        <i className={`fas fa-${icon}`} style={{ ...styles.icon, color }} />
      </div>
      <div style={styles.content}>
        <div style={styles.value}>{value}</div>
        <div style={styles.label}>{label}</div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    transition: 'all 0.2s',
  },
  cardHighlight: {
    borderColor: '#ff4d4f',
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    animation: 'pulse 2s infinite',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  icon: {
    fontSize: '20px',
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 1.2,
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginTop: '2px',
  },
};
