import React from 'react';
import type { CardComponentProps } from '../../types/layout';
import type { TemperatureAnalysisData } from '../../types/api';

interface SensorDetailsProps extends CardComponentProps {
  sensorId: string | null;
  analysis: TemperatureAnalysisData | null;
  loading?: boolean;
}

export const SensorDetails: React.FC<SensorDetailsProps> = ({
  sensorId,
  analysis,
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

  const formatNum = (num: unknown, digits = 2) => (typeof num === 'number' ? num.toFixed(digits) : '-');
  const formatSlope = (num: unknown) => (typeof num === 'number' ? num.toFixed(4) : '-');
  const formatPValue = (num: unknown) => {
    if (typeof num !== 'number') return '-';
    return num < 0.001 ? '< 0.001' : num.toFixed(4);
  };

  return (
    <div className="sensor-details">
      <div className="sensor-details__header">
        <h4 className="sensor-details__title">
          <i className="fas fa-thermometer-half" />
          {analysis?.sensor_name || analysis?.sensor_id || sensorId}
        </h4>
      </div>
      <div className="sensor-details__grid sensor-details__grid--metrics">
        <div className="sensor-details__item">
          <span className="sensor-details__label">平均温度</span>
          <span className="sensor-details__value">{formatNum(analysis?.avg_temperature)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">最低温度</span>
          <span className="sensor-details__value">{formatNum(analysis?.min_temperature)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">最高温度</span>
          <span className="sensor-details__value">{formatNum(analysis?.max_temperature)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">温度标准差</span>
          <span className="sensor-details__value">{formatNum(analysis?.std_deviation)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">平均日温差</span>
          <span className="sensor-details__value">{formatNum(analysis?.avg_daily_range)} °C</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">数据点数量</span>
          <span className="sensor-details__value">{typeof analysis?.data_count === 'number' ? String(analysis.data_count) : '-'}</span>
        </div>
      </div>
      <div className="sensor-details__grid sensor-details__grid--analysis">
        <div className="sensor-details__item">
          <span className="sensor-details__label">温度趋势</span>
          <span className="sensor-details__value">{analysis?.trend_type || '-'}</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">趋势斜率</span>
          <span className="sensor-details__value">{formatSlope(analysis?.trend_slope)} °C/天</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">R² 值</span>
          <span className="sensor-details__value">{formatSlope(analysis?.r_squared)}</span>
        </div>
        <div className="sensor-details__item">
          <span className="sensor-details__label">P 值</span>
          <span className="sensor-details__value">{formatPValue(analysis?.p_value)}</span>
        </div>
        <div className="sensor-details__item sensor-details__item--wide">
          <span className="sensor-details__label">告警等级</span>
          <span className="sensor-details__value">{analysis?.alert_level || '-'}</span>
        </div>
        <div className="sensor-details__item sensor-details__item--wide">
          <span className="sensor-details__label">最后更新</span>
          <span className="sensor-details__value">{analysis?.last_updated || '-'}</span>
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
          gap: 10px;
          margin-bottom: 10px;
        }
        .sensor-details__grid--metrics {
          grid-template-columns: repeat(3, 1fr);
        }
        .sensor-details__grid--analysis {
          grid-template-columns: repeat(4, 1fr);
          margin-bottom: 0;
        }
        .sensor-details__item {
          background: rgba(0, 20, 40, 0.5);
          border: 1px solid rgba(0, 229, 255, 0.1);
          border-radius: 4px;
          padding: 10px;
        }
        .sensor-details__item--wide {
          grid-column: span 2;
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
