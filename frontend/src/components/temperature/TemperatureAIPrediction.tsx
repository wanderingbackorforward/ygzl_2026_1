import React, { useState, useEffect } from 'react';
import { useTemperature } from '../../contexts/TemperatureContext';
import { fetchTemperaturePrediction, fetchPredictionHistory, fetchDLStatus } from '../../utils/apiClient';

interface ForecastPoint {
  date: string;
  value: number;
  lower_bound?: number;
  upper_bound?: number;
}

interface PredictionResult {
  success: boolean;
  sid?: number;
  forecast?: {
    dates: string[];
    values: number[];
    lower_bound: number[];
    upper_bound: number[];
  };
  historical?: { date: string; value: number }[];
  model_info?: any;
  message?: string;
}

const TemperatureAIPrediction: React.FC<{ cardId: string }> = () => {
  const { selectedSensorId } = useTemperature();
  const [steps, setSteps] = useState(2);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchDLStatus().then((s: any) => setDlStatus(s));
  }, []);

  const run = async () => {
    if (!selectedSensorId) return;
    setLoading(true);
    try {
      const sidNum = Number(selectedSensorId);
      const r = await fetchTemperaturePrediction(sidNum, steps);
      setResult(r as PredictionResult);
      if (r.success) {
        const h = await fetchPredictionHistory('temperature', selectedSensorId, 5);
        setHistory(h.predictions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const tempReady = dlStatus?.models?.temperature?.weights_loaded;
  const tempMae = dlStatus?.models?.temperature?.metrics?.MAE;

  return (
    <div style={{
      padding: 16, background: 'rgba(0, 20, 40, 0.4)',
      border: '1px solid rgba(0, 255, 255, 0.25)', borderRadius: 8, color: '#e6f7ff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
            <i className="fas fa-microchip" style={{ color: '#00ffe1', marginRight: 8 }} />
            AI 温度预测
            <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
              MultiTask Informer (251 传感器共享)
            </span>
          </h3>
        </div>
        {tempReady && tempMae != null && (
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'rgba(82, 196, 26, 0.15)', border: '1px solid rgba(82, 196, 26, 0.4)', color: '#95de64',
          }}>
            <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
            MAE = {tempMae.toFixed(4)}°C
          </div>
        )}
      </div>

      {!tempReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 12 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          温度模型未在 Supabase 注册。请先运行 <code>train_temperature.py</code> + <code>upload_to_supabase.py</code>。
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12 }}>
          传感器: <strong style={{ color: '#00ffe1' }}>{selectedSensorId || '未选择'}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>预测天数:</span>
          <select value={steps} onChange={e => setSteps(Number(e.target.value))} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            <option value={1}>1 天</option>
            <option value={2}>2 天</option>
            <option value={3}>3 天</option>
            <option value={5}>5 天</option>
            <option value={7}>7 天</option>
          </select>
        </div>
        <button type="button" onClick={run} disabled={loading || !selectedSensorId || !tempReady} style={{
          padding: '6px 16px', background: loading ? 'rgba(0,255,255,0.2)' : 'rgba(0,255,255,0.15)',
          border: '1px solid rgba(0,255,255,0.5)', color: '#00ffe1', borderRadius: 4,
          cursor: loading || !selectedSensorId ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 'bold',
        }}>
          {loading ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />预测中...</> : <><i className="fas fa-play" style={{ marginRight: 6 }} />运行预测</>}
        </button>
      </div>

      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          预测失败: {result.message}
        </div>
      )}

      {result && result.success && result.forecast && (
        <div>
          {/* 历史数据 (最近 8 个点) */}
          {result.historical && result.historical.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.7)', marginBottom: 4 }}>最近历史 ({result.historical.length} 天)</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {result.historical.slice(-8).map((h, i) => (
                  <div key={i} style={{
                    fontSize: 11, padding: '2px 6px', background: 'rgba(0,255,255,0.05)',
                    border: '1px solid rgba(0,255,255,0.15)', borderRadius: 3,
                  }}>
                    {h.date.slice(5)}: <strong>{h.value.toFixed(2)}°C</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 预测结果 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(82, 196, 26, 0.9)', marginBottom: 4 }}>
              <i className="fas fa-arrow-right" style={{ marginRight: 4 }} />
              AI 预测未来 {result.forecast.values.length} 天
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {result.forecast.dates.map((d, i) => (
                <div key={i} style={{
                  padding: '6px 10px', background: 'rgba(82, 196, 26, 0.1)',
                  border: '1px solid rgba(82, 196, 26, 0.3)', borderRadius: 4, minWidth: 80,
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.7)' }}>{d}</div>
                  <div style={{ fontSize: 14, color: '#95de64', fontWeight: 'bold' }}>
                    {result.forecast!.values[i].toFixed(2)}°C
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(230,247,255,0.5)' }}>
                    [{result.forecast!.lower_bound[i].toFixed(2)}, {result.forecast!.upper_bound[i].toFixed(2)}]
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setShowHistory(s => !s)} style={{
            fontSize: 11, padding: '3px 8px', background: 'transparent',
            border: '1px solid rgba(0,255,255,0.3)', color: '#00ffe1', borderRadius: 3, cursor: 'pointer',
          }}>
            {showHistory ? '隐藏' : '查看'} Supabase 预测历史 ({history.length})
          </button>
          {showHistory && history.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11 }}>
              {history.map((h, i) => (
                <div key={i} style={{ padding: 4, borderBottom: '1px solid rgba(0,255,255,0.1)' }}>
                  <span style={{ color: 'rgba(230,247,255,0.7)' }}>{h.prediction_date}</span>: {' '}
                  {(h.forecast_values as number[]).map(v => v.toFixed(2)).join(', ')} °C
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemperatureAIPrediction;
