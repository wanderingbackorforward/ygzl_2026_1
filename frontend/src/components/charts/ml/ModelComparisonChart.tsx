import React, { useState, useEffect } from 'react';
import { CardBase } from '../cards/CardBase';
import { EChartsWrapper } from './EChartsWrapper';
import { mlCompareModels, type MLModelComparisonResult } from '../../lib/mlApi';
import type { EChartsOption } from 'echarts';

interface ModelComparisonChartProps {
  cardId: string;
  pointId: string | null;
}

export const ModelComparisonChart: React.FC<ModelComparisonChartProps> = ({
  cardId,
  pointId
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MLModelComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pointId) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await mlCompareModels(pointId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pointId]);

  const chartOption: EChartsOption | null = data ? (() => {
    const models = Object.keys(data.model_evaluation).filter(
      key => data.model_evaluation[key].status === 'success'
    );
    const maeData = models.map(m => data.model_evaluation[m].mae);
    const rmseData = models.map(m => data.model_evaluation[m].rmse);

    return {
      title: {
        text: '模型性能对比',
        subtext: '数值越小表示精度越高',
        left: 'center',
        textStyle: { color: '#fff', fontSize: 16 },
        subtextStyle: { color: '#888', fontSize: 12 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 20, 40, 0.9)',
        borderColor: '#00ffff',
        textStyle: { color: '#fff' },
        axisPointer: { type: 'shadow' }
      },
      legend: {
        data: ['MAE (平均绝对误差)', 'RMSE (均方根误差)'],
        top: 40,
        textStyle: { color: '#fff' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 100,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: models.map(m => m.toUpperCase()),
        axisLine: { lineStyle: { color: '#00ffff' } },
        axisLabel: { color: '#fff' }
      },
      yAxis: {
        type: 'value',
        name: '误差 (mm)',
        nameTextStyle: { color: '#fff' },
        axisLine: { lineStyle: { color: '#00ffff' } },
        axisLabel: { color: '#fff' },
        splitLine: { lineStyle: { color: 'rgba(0, 255, 255, 0.1)' } }
      },
      series: [
        {
          name: 'MAE (平均绝对误差)',
          type: 'bar',
          data: maeData,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#00ff00' },
                { offset: 1, color: '#00aa00' }
              ]
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            color: '#fff'
          }
        },
        {
          name: 'RMSE (均方根误差)',
          type: 'bar',
          data: rmseData,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#00aaff' },
                { offset: 1, color: '#0066aa' }
              ]
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            color: '#fff'
          }
        }
      ]
    };
  })() : null;

  const renderContent = () => {
    if (!pointId) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888'
        }}>
          请选择监测点
        </div>
      );
    }

    if (error) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ff4444'
        }}>
          {error}
        </div>
      );
    }

    if (!data) {
      return null;
    }

    const successModels = Object.keys(data.model_evaluation).filter(
      key => data.model_evaluation[key].status === 'success'
    );

    const bestModel = successModels.reduce((best, current) => {
      const bestMAE = data.model_evaluation[best].mae;
      const currentMAE = data.model_evaluation[current].mae;
      return currentMAE < bestMAE ? current : best;
    }, successModels[0]);

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 数据特征 */}
        <div style={{
          padding: '12px',
          background: 'rgba(0, 170, 255, 0.1)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(0, 170, 255, 0.3)'
        }}>
          <div style={{ color: '#00aaff', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
            数据特征分析
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px' }}>
            <div>
              <span style={{ color: '#888' }}>数据量: </span>
              <span style={{ color: '#fff' }}>{data.data_characteristics.data_size}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>趋势强度: </span>
              <span style={{ color: '#fff' }}>{data.data_characteristics.trend_strength.toFixed(3)}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>波动性: </span>
              <span style={{ color: '#fff' }}>{data.data_characteristics.volatility.toFixed(3)}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>季节性: </span>
              <span style={{ color: '#fff' }}>{data.data_characteristics.seasonality_strength.toFixed(3)}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>平稳性: </span>
              <span style={{ color: '#fff' }}>{data.data_characteristics.stationarity.toFixed(3)}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>异常值比例: </span>
              <span style={{ color: '#fff' }}>{(data.data_characteristics.outlier_ratio * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* 最佳模型提示 */}
        <div style={{
          padding: '8px 12px',
          background: 'rgba(0, 255, 0, 0.1)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(0, 255, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>🏆</span>
          <div>
            <div style={{ color: '#00ff00', fontSize: '12px', fontWeight: 'bold' }}>
              最佳模型: {bestModel.toUpperCase()}
            </div>
            <div style={{ color: '#888', fontSize: '11px' }}>
              MAE: {data.model_evaluation[bestModel].mae.toFixed(3)}mm |
              RMSE: {data.model_evaluation[bestModel].rmse.toFixed(3)}mm
            </div>
          </div>
        </div>

        {/* 图表 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {chartOption && <EChartsWrapper option={chartOption} />}
        </div>

        {/* 模型详情表格 */}
        <div style={{
          marginTop: '12px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '8px',
          fontSize: '11px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0, 255, 255, 0.3)' }}>
                <th style={{ padding: '6px', textAlign: 'left', color: '#00ffff' }}>模型</th>
                <th style={{ padding: '6px', textAlign: 'right', color: '#00ffff' }}>MAE</th>
                <th style={{ padding: '6px', textAlign: 'right', color: '#00ffff' }}>RMSE</th>
                <th style={{ padding: '6px', textAlign: 'right', color: '#00ffff' }}>MAPE</th>
                <th style={{ padding: '6px', textAlign: 'center', color: '#00ffff' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(data.model_evaluation).map((model, idx) => {
                const eval_data = data.model_evaluation[model];
                const isBest = model === bestModel;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      background: isBest ? 'rgba(0, 255, 0, 0.1)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '6px', color: isBest ? '#00ff00' : '#fff', fontWeight: isBest ? 'bold' : 'normal' }}>
                      {isBest && '🏆 '}{model.toUpperCase()}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>
                      {eval_data.status === 'success' ? eval_data.mae.toFixed(3) : '-'}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>
                      {eval_data.status === 'success' ? eval_data.rmse.toFixed(3) : '-'}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#fff' }}>
                      {eval_data.status === 'success' && eval_data.mape ? eval_data.mape.toFixed(2) + '%' : '-'}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      {eval_data.status === 'success' ? (
                        <span style={{ color: '#00ff00' }}>✓</span>
                      ) : (
                        <span style={{ color: '#ff4444' }} title={eval_data.error}>✗</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <CardBase
      cardId={cardId}
      title="📊 模型性能对比"
      loading={loading}
    >
      {renderContent()}
    </CardBase>
  );
};
