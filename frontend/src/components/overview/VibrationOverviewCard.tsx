import React from 'react';
import type { CardComponentProps } from '../../types/layout';
import { useOverview } from '../../contexts/OverviewContext';

export const VibrationOverviewCard: React.FC<CardComponentProps> = () => {
  const { summary, loading, error } = useOverview();

  if (error) return <div className="dashboard-card__error">{error}</div>;
  if (loading) return <div style={{ padding: 12, color: '#8ba0b6' }}>加载中...</div>;

  return (
    <div className="stats-panel">
      <div className="stat-item">
        <div className="stat-item__label">数据集</div>
        <div className="stat-item__value">{summary?.vibration?.total_datasets ?? 0}</div>
      </div>
      <div className="stat-item">
        <div className="stat-item__label">状态</div>
        <div className={`stat-item__value ${summary?.vibration?.status === 'normal' ? 'stat-item__value--success' : 'stat-item__value--warning'}`}>
          {summary?.vibration?.status === 'normal' ? '正常' : '异常'}
        </div>
      </div>
    </div>
  );
};

export default VibrationOverviewCard;

