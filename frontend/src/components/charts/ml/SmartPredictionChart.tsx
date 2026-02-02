import React, { useState, useEffect } from 'react';
import { CardBase } from '../../cards/CardBase';
import { EChartsWrapper } from '../EChartsWrapper';
import { mlAutoPredict, type MLPredictionResult } from '../../../lib/mlApi';
import type { EChartsOption } from 'echarts';

interface SmartPredictionChartProps {
  cardId: string;
  pointId: string | null;
  steps?: number;
}

export const SmartPredictionChart: React.FC<SmartPredictionChartProps> = ({
  cardId,
  pointId,
  steps = 30
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MLPredictionResult | null>(null);
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
        const result = await mlAutoPredict(pointId, steps);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pointId, steps]);

  const chartOption: EChartsOption | null = data ? {
    title: {
      text: `智能预测 - ${data.selected_model.toUpperCase()}模型`,
      subtext: `MAE: ${data.model_selection_info.best_score.toFixed(3)}mm`,
      left: 'center',
      textStyle: { color: '#fff', fontSize: 16 },
      subtextStyle: { color: '#00ffff', fontSize: 12 }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#00ffff',
      textStyle: { color: '#fff' },
      formatter: (params: any) => {
        const date = params[0].axisValue;
        let html = `<div style="padding: 8px;"><strong>${date}</strong><br/>`;
        params.forEach((item: any) => {
          html += `${item.marker} ${item.seriesName}: ${item.value?.toFixed(2) || '-'} mm<br/>`;
        });
        html += '</div>';
        return html;
      }
    },
    legend: {
      data: ['预测值', '置信区间上界', '置信区间下界'],
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
      data: data.forecast.dates,
      axisLine: { lineStyle: { color: '#00ffff' } },
      axisLabel: { color: '#fff', rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '沉降 (mm)',
      nameTextStyle: { color: '#fff' },
      axisLine: { lineStyle: { color: '#00ffff' } },
      axisLabel: { color: '#fff' },
      splitLine: { lineStyle: { color: 'rgba(0, 255, 255, 0.1)' } }
    },
    series: [
      {
        name: '预测值',
        type: 'line',
        data: data.forecast.values,
        lineStyle: { color: '#00ff00', width: 2 },
        itemStyle: { color: '#00ff00' },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: '置信区间上界',
        type: 'line',
        data: data.forecast.upper_bound,
        lineStyle: { color: '#ffaa00', width: 1, type: 'dashed' },
        itemStyle: { color: '#ffaa00' },
        symbol: 'none'
      },
      {
        name: '置信区间下界',
        type: 'line',
        data: data.forecast.lower_bound,
        lineStyle: { color: '#ffaa00', width: 1, type: 'dashed' },
        itemStyle: { color: '#ffaa00' },
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 170, 0, 0.3)' },
              { offset: 1, color: 'rgba(255, 170, 0, 0.1)' }
            ]
          }
        }
      }
    ]
  } : null;

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

    if (!data || !chartOption) {
      return null;
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 模型信息卡片 */}
        <div style={{
          padding: '12px',
          background: 'rgba(0, 255, 255, 0.05)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(0, 255, 255, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
              选择的模型: {data.selected_model.toUpperCase()}
            </span>
            <span style={{ color: '#00ff00' }}>
              精度(MAE): {data.model_selection_info.best_score.toFixed(3)}mm
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' }}>
            <div>
              <span style={{ color: '#888' }}>数据量: </span>
              <span style={{ color: '#fff' }}>{data.model_selection_info.data_characteristics.data_size}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>趋势强度: </span>
              <span style={{ color: '#fff' }}>{data.model_selection_info.data_characteristics.trend_strength.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>波动性: </span>
              <span style={{ color: '#fff' }}>{data.model_selection_info.data_characteristics.volatility.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>季节性: </span>
              <span style={{ color: '#fff' }}>{data.model_selection_info.data_characteristics.seasonality_strength.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 图表 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <EChartsWrapper option={chartOption} />
        </div>
      </div>
    );
  };

  return (
    <CardBase
      cardId={cardId}
      title="🤖 智能预测（AI自动选择最优模型）"
      loading={loading}
    >
      {renderContent()}
    </CardBase>
  );
};
