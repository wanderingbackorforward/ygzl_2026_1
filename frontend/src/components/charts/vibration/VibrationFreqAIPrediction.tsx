import React, { useState, useEffect } from 'react';
import { useVibration } from '../../contexts/VibrationContext';
import { fetchVibrationFreqPrediction, fetchDLStatus } from '../../utils/apiClient';

interface PredictionResult {
  success: boolean;
  channel_id?: string;
  model_info?: any;
  prediction?: {
    predicted_channel: string;
    confidence: number;
    anomaly_score: number;
    is_anomaly: boolean;
    all_probabilities: Record<string, number>;
  };
  spectrum_stats?: {
    n_points: number;
    freq_min: number;
    freq_max: number;
    amp_min: number;
    amp_max: number;
    amp_mean: number;
    amp_std: number;
  };
  spectrum_data?: { frequency: number; amplitude: number }[];
  message?: string;
}

const VibrationFreqAIPrediction: React.FC<{ cardId?: string }> = () => {
  const { selectedChannel, setSelectedChannel } = useVibration();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);

  useEffect(() => {
    fetchDLStatus().then((s: any) => setDlStatus(s));
  }, []);

  const channelId = selectedChannel || '1';

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r: any = await fetchVibrationFreqPrediction(channelId);
      setResult(r as PredictionResult);
    } finally {
      setLoading(false);
    }
  };

  const freqReady = dlStatus?.models?.vibration_freq?.weights_loaded;
  const freqAcc = dlStatus?.models?.vibration_freq?.metrics?.val_accuracy;

  // 频谱 SVG 图
  const renderSpectrum = () => {
    if (!result?.spectrum_data || result.spectrum_data.length === 0) return null;
    const data = result.spectrum_data;
    const W = 680, H = 200, PL = 50, PR = 16, PT = 14, PB = 28;
    const iw = W - PL - PR, ih = H - PT - PB;
    const freqs = data.map(d => d.frequency);
    const amps = data.map(d => d.amplitude);
    const minF = Math.min(...freqs), maxF = Math.max(...freqs);
    const maxA = Math.max(...amps);
    const xScale = (f: number) => PL + ((f - minF) / (maxF - minF || 1)) * iw;
    const yScale = (a: number) => PT + ih - (a / (maxA || 1)) * ih;

    // 面积路径
    const areaPath = [
      `M ${xScale(freqs[0]).toFixed(2)} ${(H - PB).toFixed(2)}`,
      ...freqs.map((f, i) => `L ${xScale(f).toFixed(2)} ${yScale(amps[i]).toFixed(2)}`),
      `L ${xScale(freqs[freqs.length - 1]).toFixed(2)} ${(H - PB).toFixed(2)}`,
      'Z',
    ].join(' ');
    const linePath = freqs.map((f, i) => `${i === 0 ? 'M' : 'L'} ${xScale(f).toFixed(2)} ${yScale(amps[i]).toFixed(2)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200, display: 'block' }}>
        {/* Y 轴刻度 */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = yScale(maxA * t);
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(0,255,255,0.06)" strokeDasharray="2 3" />
              <text x={PL - 4} y={y + 3} fontSize="8" fill="rgba(230,247,255,0.5)" textAnchor="end">{(maxA * t).toFixed(4)}</text>
            </g>
          );
        })}
        {/* 面积 */}
        <path d={areaPath} fill="rgba(0, 255, 255, 0.12)" stroke="none" />
        {/* 线 */}
        <path d={linePath} fill="none" stroke="rgba(0, 255, 255, 0.9)" strokeWidth="1.2" />
        {/* X 轴 */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const f = minF + (maxF - minF) * t;
          return (
            <text key={t} x={PL + t * iw} y={H - 10} fontSize="8" fill="rgba(230,247,255,0.5)" textAnchor="middle">{f.toFixed(0)} Hz</text>
          );
        })}
        <text x={W / 2} y={H - 1} fontSize="9" fill="rgba(230,247,255,0.4)" textAnchor="middle">频率</text>
        <text x={12} y={H / 2} fontSize="9" fill="rgba(230,247,255,0.4)" textAnchor="middle" transform={`rotate(-90, 12, ${H / 2})`}>幅值</text>
      </svg>
    );
  };

  // 8 通道概率柱状图
  const renderProbBars = () => {
    if (!result?.prediction?.all_probabilities) return null;
    const probs = result.prediction.all_probabilities;
    const entries = Object.entries(probs).sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxProb = Math.max(...entries.map(([, v]) => v), 0.01);
    const predCh = result.prediction.predicted_channel;

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0 4px' }}>
        {entries.map(([ch, prob]) => {
          const isPred = ch === predCh;
          const h = (prob / maxProb) * 100;
          return (
            <div key={ch} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 8, color: isPred ? '#95de64' : 'rgba(230,247,255,0.5)' }}>
                {(prob * 100).toFixed(0)}%
              </div>
              <div style={{
                width: '100%', height: `${h}%`, minHeight: 2,
                background: isPred ? 'rgba(82, 196, 26, 0.7)' : 'rgba(0, 255, 255, 0.3)',
                border: isPred ? '1px solid #52c41a' : '1px solid rgba(0,255,255,0.2)',
                borderRadius: '2px 2px 0 0',
              }} />
              <div style={{ fontSize: 9, color: isPred ? '#95de64' : 'rgba(230,247,255,0.6)', fontWeight: isPred ? 'bold' : 'normal' }}>
                {ch}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{
      padding: 14,
      background: 'rgba(0, 20, 40, 0.4)',
      border: '1px solid rgba(0, 255, 255, 0.25)',
      borderRadius: 8,
      color: '#e6f7ff',
      height: '100%',
      overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-microchip" style={{ color: '#00ffe1', marginRight: 8 }} />
          AI 振动诊断
          <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
            自动识别振动频谱模式,检测异常信号
          </span>
        </h3>
        {freqReady && freqAcc != null && (
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'rgba(82, 196, 26, 0.15)', border: '1px solid rgba(82, 196, 26, 0.4)', color: '#95de64',
          }}>
            <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
            Val Acc = {(freqAcc * 100).toFixed(1)}%
          </div>
        )}
      </div>

      {!freqReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 10 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          频域模型未在 Supabase 注册。
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>通道:</span>
          <select value={channelId} onChange={e => setSelectedChannel?.(e.target.value)} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            {['1', '2', '3', '4', '5', '6', '7', '8'].map(ch => <option key={ch} value={ch}>通道 {ch}</option>)}
          </select>
        </div>
        <button type="button" onClick={run} disabled={loading || !freqReady} style={{
          padding: '6px 16px',
          background: loading ? 'rgba(0,255,255,0.2)' : 'rgba(0,255,255,0.15)',
          border: '1px solid rgba(0,255,255,0.5)', color: '#00ffe1', borderRadius: 4,
          cursor: loading || !freqReady ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 'bold',
        }}>
          {loading
            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />分析中...</>
            : <><i className="fas fa-play" style={{ marginRight: 6 }} />频域分析</>}
        </button>
      </div>

      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          分析失败: {result.message}
        </div>
      )}

      {result && result.success && (
        <div>
          {/* 异常检测结果 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10,
          }}>
            <div style={{
              padding: 8, borderRadius: 4, textAlign: 'center',
              background: result.prediction?.is_anomaly ? 'rgba(255, 122, 122, 0.15)' : 'rgba(82, 196, 26, 0.15)',
              border: `1px solid ${result.prediction?.is_anomaly ? 'rgba(255, 122, 122, 0.4)' : 'rgba(82, 196, 26, 0.4)'}`,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.6)' }}>状态</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: result.prediction?.is_anomaly ? '#ff7a7a' : '#95de64' }}>
                {result.prediction?.is_anomaly ? '⚠ 异常' : '✓ 正常'}
              </div>
            </div>
            <div style={{
              padding: 8, borderRadius: 4, textAlign: 'center',
              background: 'rgba(0, 255, 255, 0.08)', border: '1px solid rgba(0, 255, 255, 0.2)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.6)' }}>置信度</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#00ffe1' }}>
                {((result.prediction?.confidence || 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{
              padding: 8, borderRadius: 4, textAlign: 'center',
              background: 'rgba(250, 173, 20, 0.08)', border: '1px solid rgba(250, 173, 20, 0.2)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.6)' }}>异常分数</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#faad14' }}>
                {result.prediction?.anomaly_score?.toFixed(4)}
              </div>
            </div>
          </div>

          {/* 频谱图 */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, padding: 4, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(0, 255, 255, 0.7)', marginBottom: 2, padding: '0 4px' }}>
              <i className="fas fa-chart-area" style={{ marginRight: 4 }} />
              频谱图 ({result.spectrum_stats?.n_points} 点, {result.spectrum_stats?.freq_min}~{result.spectrum_stats?.freq_max} Hz)
            </div>
            {renderSpectrum()}
          </div>

          {/* 8 通道概率分布 */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, padding: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(0, 255, 255, 0.7)', marginBottom: 4 }}>
              <i className="fas fa-chart-bar" style={{ marginRight: 4 }} />
              8 通道分类概率 (预测: 通道 {result.prediction?.predicted_channel})
            </div>
            {renderProbBars()}
          </div>

          {/* 频谱统计 */}
          {result.spectrum_stats && (
            <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              <div>最大幅值: <strong style={{ color: '#00ffe1' }}>{result.spectrum_stats.amp_max.toFixed(6)}</strong></div>
              <div>平均幅值: <strong style={{ color: '#00ffe1' }}>{result.spectrum_stats.amp_mean.toFixed(6)}</strong></div>
              <div>标准差: <strong style={{ color: '#00ffe1' }}>{result.spectrum_stats.amp_std.toFixed(6)}</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VibrationFreqAIPrediction;
