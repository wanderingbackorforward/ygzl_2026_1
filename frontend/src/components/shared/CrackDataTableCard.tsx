import React from 'react';
import type { CardComponentProps } from '../../types/layout';
import { useCracks } from '../../contexts/CracksContext';

export const CrackDataTableCard: React.FC<CardComponentProps> = () => {
  const { trendData } = useCracks();
  return (
    <div className="crack-table-card">
      <div className="crack-table-card__container">
        <table className="crack-table-card__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Daily Change</th>
              <th>Cumulative Change</th>
            </tr>
          </thead>
          <tbody>
            {(trendData || []).slice(0, 50).map((row, idx) => (
              <tr key={idx}>
                <td>{row.measurement_date}</td>
                <td>{row.value?.toFixed(4)}</td>
                <td>{row.daily_change?.toFixed(6)}</td>
                <td>{row.cumulative_change?.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .crack-table-card {
          height: 100%;
          overflow: auto;
        }
        .crack-table-card__container {
          width: 100%;
        }
        .crack-table-card__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .crack-table-card__table th, .crack-table-card__table td {
          border: 1px solid rgba(0, 229, 255, 0.1);
          padding: 6px 8px;
          color: var(--text-color);
        }
        .crack-table-card__table th {
          background: rgba(0, 229, 255, 0.05);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};

export default CrackDataTableCard;
