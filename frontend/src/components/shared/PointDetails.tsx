import React from 'react';
import type { CardComponentProps } from '../../types/layout';
import type { PointAnalysisData } from '../../types/api';

interface PointDetailsProps extends CardComponentProps {
  pointId: string | null;
  data: PointAnalysisData | null;
  loading?: boolean;
}

const ALERT_COLORS: Record<string, string> = {
  'normal': '#00e676',
  'warning': '#ff9e0d',
  'danger': '#ff3e5f',
  'critical': '#ff0040',
};

const TREND_LABELS: Record<string, string> = {
  '[XZ]': '显著下沉',
  '[QX]': '轻微下沉',
  '[WD]': '稳定',
  '[QL]': '轻微上升',
  '[XL]': '显著上升',
};

export const PointDetails: React.FC<PointDetailsProps> = ({
  pointId,
  data,
  loading = false,
}) => {
  if (!pointId) {
    return (
      <div className="point-details point-details--empty">
        <i className="fas fa-hand-pointer" />
        <span>选择监测点以查看详情</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="point-details point-details--loading">
        <div className="dashboard-card__loading-spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="point-details point-details--empty">
        <i className="fas fa-exclamation-circle" />
        <span>{pointId} 暂无数据</span>
      </div>
    );
  }

  const alertColor = ALERT_COLORS[data.alert_level] || ALERT_COLORS.normal;
  const trendLabel = TREND_LABELS[data.trend_type] || data.trend_type;

  return (
    <div className="point-details">
      <div className="point-details__header">
        <h4 className="point-details__title">
          <i className="fas fa-map-marker-alt" />
          {pointId}
        </h4>
        <span
          className="point-details__badge"
          style={{ backgroundColor: alertColor }}
        >
          {data.alert_level}
        </span>
      </div>

      <div className="point-details__grid">
        <div className="point-details__item">
          <span className="point-details__label">趋势类型</span>
          <span className="point-details__value">{trendLabel}</span>
        </div>
        <div className="point-details__item">
          <span className="point-details__label">平均值</span>
          <span className="point-details__value">{data.avg_value?.toFixed(4)} mm</span>
        </div>
        <div className="point-details__item">
          <span className="point-details__label">总变化</span>
          <span className="point-details__value" style={{
            color: data.total_change < 0 ? '#ff3e5f' : data.total_change > 0 ? '#00e676' : 'inherit'
          }}>
            {data.total_change >= 0 ? '+' : ''}{data.total_change?.toFixed(4)} mm
          </span>
        </div>
        <div className="point-details__item">
          <span className="point-details__label">日均速率</span>
          <span className="point-details__value">{data.avg_daily_rate?.toFixed(6)} mm/天</span>
        </div>
      </div>

      <style>{`
        .point-details {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .point-details--empty,
        .point-details--loading {
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          gap: 8px;
        }

        .point-details--empty i {
          font-size: 24px;
          opacity: 0.5;
        }

        .point-details__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0, 229, 255, 0.15);
        }

        .point-details__title {
          color: var(--primary-color);
          font-size: 16px;
          font-weight: 500;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .point-details__badge {
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: white;
        }

        .point-details__grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .point-details__item {
          background: rgba(0, 20, 40, 0.5);
          border: 1px solid rgba(0, 229, 255, 0.1);
          border-radius: 4px;
          padding: 10px;
        }

        .point-details__label {
          display: block;
          font-size: 10px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .point-details__value {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-color);
          font-family: 'Consolas', monospace;
        }
      `}</style>
    </div>
  );
};

export default PointDetails;
