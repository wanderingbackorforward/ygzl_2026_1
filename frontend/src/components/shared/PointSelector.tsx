import React from 'react';
import type { CardComponentProps } from '../../types/layout';

interface PointSelectorProps extends CardComponentProps {
  points: string[];
  selectedPoint: string | null;
  onSelectPoint: (pointId: string) => void;
  loading?: boolean;
  problemPointIds?: string[];
  itemStatusMap?: Record<string, {
    status?: 'normal' | 'watch' | 'warning' | 'critical';
    score?: number;
    subtitle?: string;
  }>;
}

export const PointSelector: React.FC<PointSelectorProps> = ({
  points,
  selectedPoint,
  onSelectPoint,
  loading = false,
  problemPointIds,
  itemStatusMap,
}) => {
  if (loading) {
    return (
      <div className="point-selector point-selector--loading">
        <div className="dashboard-card__loading-spinner" />
      </div>
    );
  }

  const items = Array.from(new Set(points.filter(id => id && id !== 'null' && id !== 'undefined')));
  const problemSet = new Set(problemPointIds || []);
  const statusMap = itemStatusMap || {};
  return (
    <div className="point-selector">
      <div className="point-selector__header">
        <span className="point-selector__label">监测点</span>
        <span className="point-selector__count">{items.length} 个点</span>
      </div>

      <div className="point-selector__list">
        {items.length === 0 ? (
          <div className="point-selector__empty">暂无数据</div>
        ) : items.map((pointId, index) => {
          const itemStatus = statusMap[pointId];
          const riskClass = itemStatus?.status ? `point-selector__item--risk-${itemStatus.status}` : '';
          return (
          <button
            key={pointId || `sensor-${index}`}
            className={`point-selector__item ${selectedPoint === pointId ? 'point-selector__item--active' : ''} ${problemSet.has(pointId) ? 'point-selector__item--problem' : ''} ${riskClass}`}
            onClick={() => onSelectPoint(pointId)}
          >
            <i className="fas fa-map-marker-alt" />
            <span>{pointId || '未知传感器'}</span>
            {itemStatus && (
              <div className="point-selector__meta">
                <span className={`point-selector__badge point-selector__badge--${itemStatus.status || 'normal'}`}>
                  {itemStatus.status === 'critical' ? '高危' : itemStatus.status === 'warning' ? '预警' : itemStatus.status === 'watch' ? '观察' : '正常'}
                </span>
                {typeof itemStatus.score === 'number' && (
                  <span className="point-selector__score">{Math.round(itemStatus.score)}</span>
                )}
              </div>
            )}
          </button>
        )})}
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
        .point-selector__empty {
          color: var(--text-secondary);
          font-size: 12px;
          padding: 8px;
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

        .point-selector__meta {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }

        .point-selector__badge {
          padding: 1px 5px;
          border-radius: 999px;
          font-size: 10px;
          line-height: 1.4;
          font-weight: 600;
        }

        .point-selector__badge--normal {
          background: rgba(34, 197, 94, 0.18);
          color: rgba(187, 247, 208, 0.95);
        }

        .point-selector__badge--watch {
          background: rgba(245, 158, 11, 0.18);
          color: rgba(253, 230, 138, 0.95);
        }

        .point-selector__badge--warning {
          background: rgba(249, 115, 22, 0.18);
          color: rgba(254, 215, 170, 0.98);
        }

        .point-selector__badge--critical {
          background: rgba(239, 68, 68, 0.18);
          color: rgba(254, 202, 202, 0.98);
        }

        .point-selector__score {
          color: rgba(148, 163, 184, 0.95);
          font-size: 10px;
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

        .point-selector__item--problem {
          border-color: rgba(255, 62, 95, 0.45);
          color: rgba(255, 210, 218, 0.95);
        }

        .point-selector__item--problem i {
          color: rgba(255, 62, 95, 0.75);
        }

        .point-selector__item--problem:hover {
          background: rgba(255, 62, 95, 0.12);
          border-color: rgba(255, 62, 95, 0.7);
          color: var(--text-color);
        }

        .point-selector__item--problem:hover i {
          color: rgba(255, 62, 95, 0.95);
        }

        .point-selector__item--problem.point-selector__item--active {
          background: rgba(255, 62, 95, 0.18);
          border-color: rgba(255, 62, 95, 0.95);
          box-shadow: 0 0 10px rgba(255, 62, 95, 0.22);
          color: var(--text-color);
        }

        .point-selector__item--problem.point-selector__item--active i {
          color: rgba(255, 62, 95, 0.95);
        }

        .point-selector__item--risk-watch {
          border-color: rgba(245, 158, 11, 0.35);
        }

        .point-selector__item--risk-warning {
          border-color: rgba(249, 115, 22, 0.45);
        }

        .point-selector__item--risk-critical {
          border-color: rgba(239, 68, 68, 0.6);
          background: rgba(127, 29, 29, 0.2);
        }
      `}</style>
    </div>
  );
};

export default PointSelector;
