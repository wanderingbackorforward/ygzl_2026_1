import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useVibration } from '../contexts/VibrationContext';
import { fetchVibrationPrediction } from '../utils/apiClient';

interface Props {
  cardId?: string;
}

const CHANNEL_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const VibrationAIPrediction: React.FC<Props> = ({ cardId }) => {
  const { selectedChannelId } = useVibration();
  const [channelId, setChannelId] = useState<string>(String(selectedChannelId || '1'));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 同步振动页的当前选中通道
  useEffect(() => {
    if (selectedChannelId) setChannelId(String(selectedChannelId));
  }, [selectedChannelId]);

  const runPredict = useCallback(async (cid?: string) => {
    const target = cid || channelId;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r: any = await fetchVibrationPrediction(target);
      if (!r || r.success === false) {
        setError(r?.message || '后端未返回数据');
      } else {
        setResult(r);
      }
    } catch (e: any) {
      setError(e?.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // 进入卡片自动跑一次
  useEffect(() => {
    if (channelId) runPredict(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const forecast = result?.forecast;
  const fullWave = result?.full_waveform;
  const feats = result?.features;

  // 真实 vs 预测特征 偏差
  const featDelta = useMemo(() => {
    if (!feats?.real || !feats?.predicted) return null;
    return feats.names.map((n: string, i: number) => ({
      name: n,
      real: feats.real[i],
      pred: feats.predicted[i],
      delta: feats.predicted[i] - feats.real[i],
    }));
  }, [feats]);

  return (
    <div style={{ padding: 12, color: '#cbd5e1', fontSize: 13, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ background: '#0e7490', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
          1D-CNN 双输出头
        </span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>
          权重: Supabase ml-models/vibration
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          ID: {cardId || 'vibration-ai'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ color: '#94a3b8' }}>通道:</label>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', padding: '4px 8px', borderRadius: 4 }}
        >
          {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>通道 {c}</option>)}
        </select>
        <button
          onClick={() => runPredict()}
          disabled={loading}
          style={{
            background: loading ? '#475569' : '#0891b2', color: '#fff', border: 'none',
            padding: '5px 14px', borderRadius: 4, cursor: loading ? 'wait' : 'pointer', fontSize: 12
          }}
        >
          {loading ? '预测中…' : '运行预测'}
        </button>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          显示 Supabase 持久化记录
        </label>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 12 }}>
          <strong>错误:</strong> {error}
        </div>
      )}

      {result && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <Metric label="模型" value={result.model_info?.model_type || '—'} />
            <Metric label="采样率" value={`${result.model_info?.sampling_rate_hz || 1000} Hz`} />
            <Metric label="设备" value={result.model_info?.device || 'cpu'} />
          </div>

          {/* 波形预测对比 */}
          {fullWave && (
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6, marginBottom: 12 }}>
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                波形预测 (前 50 点真实, 后 50 点 AI 预测)
              </div>
              <WaveformChart
                time={fullWave.time_s}
                real={fullWave.amplitude_real}
                pred={fullWave.amplitude_predicted}
              />
            </div>
          )}

          {/* 16 维特征对比表 */}
          {featDelta && (
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6, marginBottom: 12, overflow: 'auto' }}>
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                16 维统计特征对比 (真实 / 预测 / 偏差)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: '#64748b' }}>
                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>特征</th>
                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>真实</th>
                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>预测</th>
                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {featDelta.map((f: any) => (
                    <tr key={f.name} style={{ borderTop: '1px solid #1e293b' }}>
                      <td style={{ padding: '3px 6px', color: '#94a3b8' }}>{f.name}</td>
                      <td style={{ textAlign: 'right', padding: '3px 6px', color: '#cbd5e1' }}>{f.real.toFixed(4)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 6px', color: '#67e8f9' }}>{f.pred.toFixed(4)}</td>
                      <td style={{
                        textAlign: 'right', padding: '3px 6px',
                        color: Math.abs(f.delta) < Math.abs(f.real) * 0.05 ? '#22c55e' : '#f59e0b'
                      }}>
                        {f.delta >= 0 ? '+' : ''}{f.delta.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 预测后 50 点摘要 */}
          {forecast && (
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6 }}>
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                预测后 50 点摘要 (时间 {forecast.time_s[0]}s ~ {forecast.time_s[forecast.time_s.length - 1]}s)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 11 }}>
                <Metric label="峰值" value={`${Math.max(...forecast.amplitude).toFixed(3)}`} />
                <Metric label="谷值" value={`${Math.min(...forecast.amplitude).toFixed(3)}`} />
                <Metric label="均值" value={`${(forecast.amplitude.reduce((a: number, b: number) => a + b, 0) / forecast.amplitude.length).toFixed(3)}`} />
                <Metric label="RMS" value={`${Math.sqrt(forecast.amplitude.reduce((a: number, b: number) => a + b * b, 0) / forecast.amplitude.length).toFixed(3)}`} />
              </div>
            </div>
          )}

          {showHistory && (
            <div style={{ background: '#082f49', padding: 10, borderRadius: 6, marginTop: 12, fontSize: 11, color: '#bae6fd' }}>
              预测已写入 Supabase <code>ml_predictions</code> 表 (model_name='vibration', target_id='{channelId}')。
              可通过 <code>GET /api/ml/dl/history/vibration/{channelId}</code> 查询历史。
            </div>
          )}
        </>
      )}

      {!result && !error && !loading && (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 24, fontSize: 12 }}>
          选择通道并点击 "运行预测" 启动 AI 推理
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: '#0f172a', padding: '6px 10px', borderRadius: 4 }}>
    <div style={{ color: '#64748b', fontSize: 10 }}>{label}</div>
    <div style={{ color: '#e2e8f0', fontSize: 13, marginTop: 2 }}>{value}</div>
  </div>
);

const WaveformChart: React.FC<{ time: number[]; real: number[]; pred: number[] }> = ({ time, real, pred }) => {
  const w = 560, h = 140, pad = 8;
  const all = [...real, ...pred];
  const min = Math.min(...all), max = Math.max(...all);
  const range = max - min || 1;
  const n = time.length;
  const xStep = (w - 2 * pad) / Math.max(n - 1, 1);
  const y = (v: number) => pad + (h - 2 * pad) * (1 - (v - min) / range);

  const buildPath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${(pad + i * xStep).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140, background: '#020617', borderRadius: 4 }}>
      {/* 真实 (前 50) */}
      <path d={buildPath(real.slice(0, 50))} fill="none" stroke="#22c55e" strokeWidth={1.5} />
      {/* 真实 (全部, 浅) */}
      <path d={buildPath(real)} fill="none" stroke="#1e3a3a" strokeWidth={0.6} />
      {/* 预测 (后 50, 高亮) */}
      <path d={buildPath(pred)} fill="none" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="3,2" />
      {/* 分隔线 */}
      <line x1={pad + 50 * xStep} x2={pad + 50 * xStep} y1={pad} y2={h - pad} stroke="#475569" strokeDasharray="2,2" />
      <text x={pad + 2} y={h - 2} fontSize="9" fill="#94a3b8">真实 (前 50)</text>
      <text x={pad + 50 * xStep + 4} y={pad + 10} fontSize="9" fill="#67e8f9">AI 预测 (后 50)</text>
    </svg>
  );
};

export default VibrationAIPrediction;
