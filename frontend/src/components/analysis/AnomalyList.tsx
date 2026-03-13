import React, { useState, useMemo } from 'react';
import type { Anomaly, AnomalySortBy, SortOrder } from '../../types/analysis';
import { AnomalyCard } from './AnomalyCard';
import { sortAnomalies, filterAnomalies, severityText, anomalyTypeText } from '../../utils/analysis';

interface AnomalyListProps {
  anomalies: Anomaly[];
  onAnomalyClick?: (anomaly: Anomaly) => void;
}

export const AnomalyList: React.FC<AnomalyListProps> = ({ anomalies, onAnomalyClick }) => {
  const [sortBy, setSortBy] = useState<AnomalySortBy>('severity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterSeverity, setFilterSeverity] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');

  // 筛选和排序
  const filteredAndSorted = useMemo(() => {
    let result = anomalies;

    // 筛选
    result = filterAnomalies(result, {
      severity: filterSeverity.length > 0 ? filterSeverity : undefined,
      anomaly_type: filterType.length > 0 ? filterType : undefined,
    });

    // 搜索
    if (searchText) {
      result = result.filter(a =>
        a.point_id.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 排序
    result = sortAnomalies(result, sortBy, sortOrder);

    return result;
  }, [anomalies, sortBy, sortOrder, filterSeverity, filterType, searchText]);

  const handleSortChange = (newSortBy: AnomalySortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const toggleSeverityFilter = (severity: string) => {
    setFilterSeverity(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  const toggleTypeFilter = (type: string) => {
    setFilterType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div style={styles.container}>
      {/* 工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <input
            type="text"
            placeholder="搜索监测点..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={styles.searchInput}
          />
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>严重程度:</span>
            {['critical', 'high', 'medium', 'low'].map(severity => (
              <button
                key={severity}
                style={{
                  ...styles.filterButton,
                  ...(filterSeverity.includes(severity) ? styles.filterButtonActive : {}),
                }}
                onClick={() => toggleSeverityFilter(severity)}
              >
                {severityText[severity]}
              </button>
            ))}
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>异常类型:</span>
            {['spike', 'acceleration', 'fluctuation', 'trend'].map(type => (
              <button
                key={type}
                style={{
                  ...styles.filterButton,
                  ...(filterType.includes(type) ? styles.filterButtonActive : {}),
                }}
                onClick={() => toggleTypeFilter(type)}
              >
                {anomalyTypeText[type]}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.toolbarRight}>
          <span style={styles.sortLabel}>排序:</span>
          <select
            value={sortBy}
            onChange={e => handleSortChange(e.target.value as AnomalySortBy)}
            style={styles.sortSelect}
          >
            <option value="severity">严重程度</option>
            <option value="date">日期</option>
            <option value="score">异常分数</option>
            <option value="point_id">监测点</option>
          </select>
          <button
            style={styles.sortOrderButton}
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`} />
          </button>
        </div>
      </div>

      {/* 结果统计 */}
      <div style={styles.resultInfo}>
        显示 {filteredAndSorted.length} / {anomalies.length} 个异常
      </div>

      {/* 异常列表 */}
      <div style={styles.list}>
        {filteredAndSorted.length === 0 ? (
          <div style={styles.empty}>
            <i className="fas fa-search" style={styles.emptyIcon} />
            <div style={styles.emptyText}>没有找到符合条件的异常</div>
          </div>
        ) : (
          filteredAndSorted.map((anomaly, index) => (
            <AnomalyCard
              key={`${anomaly.point_id}-${anomaly.date}-${index}`}
              anomaly={anomaly}
              onClick={() => onAnomalyClick?.(anomaly)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: '100%',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    flexWrap: 'wrap',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    flexWrap: 'wrap',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  searchInput: {
    padding: '8px 12px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    minWidth: '200px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '12px',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  filterButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  sortLabel: {
    fontSize: '12px',
    color: '#fff',
  },
  sortSelect: {
    padding: '6px 10px',
    backgroundColor: 'rgba(20, 20, 40, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    outline: 'none',
  },
  sortOrderButton: {
    padding: '6px 10px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    color: '#4a9eff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  resultInfo: {
    fontSize: '13px',
    color: '#fff',
    padding: '0 4px',
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
    flex: 1,
    overflowY: 'auto',
    padding: '4px',
  },
  empty: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '48px',
    color: 'rgba(74, 158, 255, 0.3)',
  },
  emptyText: {
    fontSize: '16px',
    color: '#fff',
  },
};
