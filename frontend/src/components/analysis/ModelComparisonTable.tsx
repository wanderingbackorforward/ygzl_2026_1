import React from 'react';

interface ModelMetrics {
  model_name: string;
  mae: number;
  rmse: number;
  mape: number;
  aic?: number;
  bic?: number;
}

interface ModelComparisonTableProps {
  models: ModelMetrics[];
  selectedModel?: string;
}

export const ModelComparisonTable: React.FC<ModelComparisonTableProps> = ({
  models,
  selectedModel,
}) => {
  if (models.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyMessage}>暂无模型对比数据</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>模型性能对比</h3>
        <div style={styles.subtitle}>
          数值越小表示模型性能越好
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.th}>模型</th>
              <th style={styles.th}>MAE</th>
              <th style={styles.th}>RMSE</th>
              <th style={styles.th}>MAPE (%)</th>
              <th style={styles.th}>AIC</th>
              <th style={styles.th}>BIC</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model, index) => {
              const isSelected = model.model_name === selectedModel;
              return (
                <tr
                  key={index}
                  style={{
                    ...styles.row,
                    backgroundColor: isSelected
                      ? 'rgba(74, 158, 255, 0.15)'
                      : index % 2 === 0
                      ? 'rgba(30, 30, 50, 0.4)'
                      : 'rgba(30, 30, 50, 0.6)',
                  }}
                >
                  <td style={styles.td}>
                    <div style={styles.modelCell}>
                      <span style={styles.modelName}>
                        {modelNameMap[model.model_name] || model.model_name}
                      </span>
                      {isSelected && (
                        <span style={styles.selectedBadge}>已选择</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.metricValue}>
                      {model.mae.toFixed(3)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.metricValue}>
                      {model.rmse.toFixed(3)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.metricValue}>
                      {model.mape.toFixed(2)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.metricValue}>
                      {model.aic ? model.aic.toFixed(2) : '-'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.metricValue}>
                      {model.bic ? model.bic.toFixed(2) : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.footer}>
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={styles.legendLabel}>MAE:</span>
            <span style={styles.legendText}>平均绝对误差</span>
          </div>
          <div style={styles.legendItem}>
            <span style={styles.legendLabel}>RMSE:</span>
            <span style={styles.legendText}>均方根误差</span>
          </div>
          <div style={styles.legendItem}>
            <span style={styles.legendLabel}>MAPE:</span>
            <span style={styles.legendText}>平均绝对百分比误差</span>
          </div>
          <div style={styles.legendItem}>
            <span style={styles.legendLabel}>AIC/BIC:</span>
            <span style={styles.legendText}>信息准则（越小越好）</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const modelNameMap: Record<string, string> = {
  arima: 'ARIMA',
  sarima: 'SARIMA',
  prophet: 'Prophet',
  lstm: 'LSTM',
  linear: '线性回归',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: '13px',
    color: '#888',
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headerRow: {
    borderBottom: '2px solid rgba(74, 158, 255, 0.3)',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#4a9eff',
    textTransform: 'uppercase',
  },
  row: {
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#fff',
    borderBottom: '1px solid rgba(74, 158, 255, 0.1)',
  },
  modelCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modelName: {
    fontWeight: '500',
    color: '#fff',
  },
  selectedBadge: {
    padding: '2px 8px',
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#4a9eff',
  },
  metricValue: {
    fontFamily: 'monospace',
    color: '#fff',
  },
  footer: {
    padding: '12px 16px',
    backgroundColor: 'rgba(30, 30, 50, 0.4)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.1)',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#4a9eff',
  },
  legendText: {
    fontSize: '12px',
    color: '#888',
  },
  emptyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#888',
  },
};
