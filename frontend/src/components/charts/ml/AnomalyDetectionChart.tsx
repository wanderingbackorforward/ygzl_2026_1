import React, { useState, useEffect } from 'react';
import { CardBase } from '../cards/CardBase';
import { EChartsWrapper } from './EChartsWrapper';
import { mlDetectAnomalies, type MLAnomalyResult } from '../../lib/mlApi';
import type { EChartsOption } from 'echarts';

interface AnomalyDetectionChartProps {
  cardId: string;
  pointId: string | null;
}

export const AnomalyDetectionChart: React.FC<AnomalyDetectionChartProps> = ({
  cardId,
  pointId
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MLAnomalyResult | null>(null);
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
        const result = await mlDetectAnomalies(pointId);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffaa00';
      case 'low': return '#ffff00';
      default: return '#888';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return '严重';
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '未知';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'spike': return '突变';
      case 'acceleration': return '加速';
      case 'volatility': return '波动';
      case 'trend': return '趋势异常';
      default: return '未知';
    }
  };

  const chartOption: EChartsOption | null = data && data.anomalies.length > 0 ? {
    title: {
      text: '异常检测结果',
      subtext: `检测到 ${data.anomaly_count} 个异常点 (${data.anomaly_rate.toFixed(1)}%)`,
      left: 'center',
      textStyle: { color: '#fff', fontSize: 16 },
      subtextStyle: { color: '#ff6600', fontSize: 12 }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#00ffff',
      textStyle: { color: '#fff' },
      formatter: (params: any) => {
        const item = params.data;
        return `
          <div style="padding: 8px;">
            <strong>${item.date}</strong><br/>
            沉降: ${item.settlement.toFixed(2)} mm<br/>
            异常分数: ${item.anomaly_score.toFixed(3)}<br/>
            严重程度: <span style="color: ${getSeverityColor(item.severity)}">${getSeverityLabel(item.severity)}</span><br/>
            异常类型: ${getTypeLabel(item.anomaly_type)}
          </div>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 80,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.anomalies.map(a => a.date),
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
        name: '异常点',
        type: 'scatter',
        data: data.anomalies.map(a => ({
          value: a.settlement,
          date: a.date,
          settlement: a.settlement,
          anomaly_score: a.anomaly_score,
          severity: a.severity,
          anomaly_type: a.anomaly_type
        })),
        symbolSize: (val: any, params: any) => {
          const severity = params.data.severity;
          switch (severity) {
            case 'critical': return 20;
            case 'high': return 16;
            case 'medium': return 12;
            case 'low': return 8;
            default: return 10;
          }
        },
        itemStyle: {
          color: (params: any) => getSeverityColor(params.data.severity)
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

    if (!data) {
      return null;
    }

    if (data.anomaly_count === 0) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <div style={{ color: '#00ff00', fontSize: '18px', marginBottom: '8px' }}>
            未检测到异常
          </div>
          <div style={{ color: '#888', fontSize: '14px' }}>
            共分析 {data.total_points} 个数据点
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 统计信息 */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 102, 0, 0.1)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(255, 102, 0, 0.3)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: '12px' }}>总数据点</div>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                {data.total_points}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: '12px' }}>异常点数</div>
              <div style={{ color: '#ff6600', fontSize: '20px', fontWeight: 'bold' }}>
                {data.anomaly_count}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: '12px' }}>异常率</div>
              <div style={{ color: '#ff6600', fontSize: '20px', fontWeight: 'bold' }}>
                {data.anomaly_rate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* 图表 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {chartOption && <EChartsWrapper option={chartOption} />}
        </div>

        {/* 异常列表 */}
        <div style={{
          marginTop: '12px',
          maxHeight: '150px',
          overflowY: 'auto',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '8px'
        }}>
          <div style={{ color: '#00ffff', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
            异常详情 (前10个)
          </div>
          {data.anomalies.slice(0, 10).map((anomaly, idx) => (
            <div
              key={idx}
              style={{
                padding: '6px',
                marginBottom: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px',
                borderLeft: `3px solid ${getSeverityColor(anomaly.severity)}`,
                fontSize: '11px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff' }}>{anomaly.date}</span>
                <span style={{ color: getSeverityColor(anomaly.severity) }}>
                  {getSeverityLabel(anomaly.severity)}
                </span>
              </div>
              <div style={{ color: '#888', marginTop: '2px' }}>
                沉降: {anomaly.settlement.toFixed(2)}mm | 类型: {getTypeLabel(anomaly.anomaly_type)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <CardBase
      cardId={cardId}
      title="🔍 智能异常检测"
      loading={loading}
    >
      {renderContent()}
    </CardBase>
  );
};
