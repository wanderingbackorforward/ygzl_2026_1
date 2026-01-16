import React from 'react';
import type { CardComponentProps } from '../../types/layout';

interface PointSelectorProps extends CardComponentProps {
  points: string[];
  selectedPoint: string | null;
  onSelectPoint: (pointId: string) => void;
  loading?: boolean;
}

export const PointSelector: React.FC<PointSelectorProps> = ({
  points,
  selectedPoint,
  onSelectPoint,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="point-selector point-selector--loading">
        <div className="dashboard-card__loading-spinner" />
      </div>
    );
  }

  return (
    <div className="point-selector">
      <div className="point-selector__header">
        <span className="point-selector__label">Monitoring Point</span>
        <span className="point-selector__count">{points.length} points</span>
      </div>

      <div className="point-selector__list">
        {points.map(pointId => (
          <button
            key={pointId}
            className={`point-selector__item ${selectedPoint === pointId ? 'point-selector__item--active' : ''}`}
            onClick={() => onSelectPoint(pointId)}
          >
            <i className="fas fa-map-marker-alt" />
            <span>{pointId}</span>
          </button>
        ))}
      </div>

      <style>{`
        .point-selector {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .point-selector--loading {
          align-items: center;
          justify-content: center;
        }

        .point-selector__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0, 229, 255, 0.15);
        }

        .point-selector__label {
          color: var(--text-secondary);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .point-selector__count {
          color: var(--primary-color);
          font-size: 11px;
          background: rgba(0, 229, 255, 0.1);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .point-selector__list {
          flex: 1;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 6px;
          padding-right: 4px;
        }

        .point-selector__item {
          background: rgba(0, 20, 40, 0.5);
          border: 1px solid rgba(0, 229, 255, 0.15);
          border-radius: 4px;
          padding: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .point-selector__item i {
          font-size: 14px;
          color: rgba(0, 229, 255, 0.5);
        }

        .point-selector__item:hover {
          background: rgba(0, 229, 255, 0.1);
          border-color: rgba(0, 229, 255, 0.3);
          color: var(--text-color);
        }

        .point-selector__item:hover i {
          color: var(--primary-color);
        }

        .point-selector__item--active {
          background: rgba(0, 229, 255, 0.2);
          border-color: var(--primary-color);
          color: var(--text-color);
          box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
        }

        .point-selector__item--active i {
          color: var(--primary-color);
        }
      `}</style>
    </div>
  );
};

export default PointSelector;
