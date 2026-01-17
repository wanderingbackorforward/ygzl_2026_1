import React from 'react';
import type { CardComponentProps } from '../../types/layout';
import type { TemperatureSummary } from '../../types/api';

interface SensorDetailsProps extends CardComponentProps {
  sensorId: string | null;
  summary: TemperatureSummary | null;
  loading?: boolean;
}

export const SensorDetails: React.FC<SensorDetailsProps> = ({
  sensorId,
  summary,
  loading = false,
}) => {
  if (!sensorId) {
    return (
      <div className="sensor-details sensor-details--empty">
        <i className="fas fa-thermometer-half" />
        <span>选择传感器以查看详情</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sensor-details sensor-details--loading">
        <div className="dashboard-card__loading-spinner" />
      </div>
    );
  }

  return (
    <div className="sensor-details">
      <div className="sensor-details__header">
        <h4 className="sensor-details__title">
          <i className="fas fa-thermometer-half" />
          {sensorId}
        </h4>
      </div>
      <div className="sensor-details__grid">
        <div className="sensor-details__item">
          <span className="sensor-details__label">平均温度</span>
          <span className="sensor-details__value">{summary?.avg_temp?.toFixed(2)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">最低温度</span>
          <span className="sensor-details__value">{summary?.min_temp?.toFixed(2)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">最高温度</span>
          <span className="sensor-details__value">{summary?.max_temp?.toFixed(2)} °C</span>
        </div>
      </div>
      <style>{`
        .sensor-details {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .sensor-details--empty,
        .sensor-details--loading {
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          gap: 8px;
        }
        .sensor-details__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0, 229, 255, 0.15);
        }
        .sensor-details__title {
          color: var(--primary-color);
          font-size: 16px;
          font-weight: 500;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sensor-details__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .sensor-details__item {
          background: rgba(0, 20, 40, 0.5);
          border: 1px solid rgba(0, 229, 255, 0.1);
          border-radius: 4px;
          padding: 10px;
        }
        .sensor-details__label {
          display: block;
          font-size: 10px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .sensor-details__value {
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

export default SensorDetails;
