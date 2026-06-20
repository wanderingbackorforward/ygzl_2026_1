import React, { useState, useEffect } from 'react';
import { useVibration } from '../../../contexts/VibrationContext';
import { fetchVibrationFreqPrediction, fetchDLStatus } from '../../../utils/apiClient';
import type { CardComponentProps } from '../../../types/layout';

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

type SafetyLevel = 'safe' | 'attention' | 'warning' | 'danger';

const LEVEL_CONFIG: Record<SafetyLevel, {
  color: string;
  bg: string;
  border: string;
  icon: string;
  label: string;
  conclusion: string;
  advice: string;
}> = {
  safe: {
    color: '#52c41a',
    bg: 'rgba(82, 196, 26, 0.12)',
    border: 'rgba(82, 196, 26, 0.45)',
    icon: 'fa-check-circle',
    label: '安全',
    conclusion: '振动信号正常,未检测到异常模式',
    advice: '设备运行正常,按常规计划维护即可。',
  },
  attention: {
    color: '#faad14',
    bg: 'rgba(250, 173, 20, 0.12)',
    border: 'rgba(250, 173, 20, 0.45)',
    icon: 'fa-eye',
    label: '关注',
    conclusion: '振动信号基本正常,存在轻微异常迹象',
    advice: '振动略有波动,建议持续监控并记录变化趋势。',
  },
  warning: {
    color: '#fa8c16',
    bg: 'rgba(250, 140, 22, 0.12)',
    border: 'rgba(250, 140, 22, 0.45)',
    icon: 'fa-exclamation-triangle',
    label: '预警',
    conclusion: '检测到异常振动信号,建议排查设备状态',
    advice: '检测到异常振动,建议排查振动源,检查设备安装与平衡状态。',
  },
  danger: {
    color: '#ff4d4f',
    bg: 'rgba(255, 77, 79, 0.12)',
    border: 'rgba(255, 77, 79, 0.45)',
    icon: 'fa-times-circle',
    label: '危险',
    conclusion: '检测到严重异常振动,建议立即停机检查',
    advice: '振动严重异常,建议立即停机检查,避免设备损坏。',
  },
};

const getSafetyLevel = (isAnomaly: boolean, anomalyScore: number): SafetyLevel => {
  if (!isAnomaly && anomalyScore < 0.3) return 'safe';
  if (!isAnomaly && anomalyScore >= 0.3) return 'attention';
  if (isAnomaly && anomalyScore < 0.7) return 'warning';
  return 'danger';
};

const getAnomalyLevel = (score: number): string => {
  if (score < 0.3) return '低';
  if (score < 0.7) return '中';
  return '高';
};

const getConfidenceLevel = (confidence: number): string => {
  if (confidence > 0.8) return '高';
  if (confidence >= 0.6) return '中';
  return '低';
};

const VibrationFreqAIPrediction: React.FC<CardComponentProps> = () => {
  const { selectedChannelId, selectChannel } = useVibration();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  useEffect(() => {
    fetchDLStatus().then((s: any) => setDlStatus(s));
  }, []);

  const channelId = selectedChannelId || '1';

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

  const prediction = result?.prediction;
  const level = prediction
    ? getSafetyLevel(prediction.is_anomaly, prediction.anomaly_score)
    : 'safe';
  const config = LEVEL_CONFIG[level];

  // 简化频谱图
  const renderSpectrum = () => {
    if (!result?.spectrum_data || result.spectrum_data.length === 0) return null;
    const data = result.spectrum_data;
    const W = 680, H = 180, PL = 40, PR = 16, PT = 12, PB = 24;
    const iw = W - PL - PR, ih = H - PT - PB;
    const freqs = data.map(d => d.frequency);
    const amps = data.map(d => d.amplitude);
    const minF = Math.min(...freqs), maxF = Math.max(...freqs);
    const maxA = Math.max(...amps);
    const xScale = (f: number) => PL + ((f - minF) / (maxF - minF || 1)) * iw;
    const yScale = (a: number) => PT + ih - (a / (maxA || 1)) * ih;

    const areaPath = [
      `M ${xScale(freqs[0]).toFixed(2)} ${(H - PB).toFixed(2)}`,
      ...freqs.map((f, i) => `L ${xScale(f).toFixed(2)} ${yScale(amps[i]).toFixed(2)}`),
      `L ${xScale(freqs[freqs.length - 1]).toFixed(2)} ${(H - PB).toFixed(2)}`,
      'Z',
    ].join(' ');
    const linePath = freqs.map((f, i) => `${i === 0 ? 'M' : 'L'} ${xScale(f).toFixed(2)} ${yScale(amps[i]).toFixed(2)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, display: 'block' }}>
        {[0, 0.5, 1].map(t => {
          const y = yScale(maxA * t);
          return (
            <line key={t} x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" />
          );
        })}
        <path d={areaPath} fill={`${config.color}22`} stroke="none" />
        <path d={linePath} fill="none" stroke={config.color} strokeWidth="1.5" />
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const f = minF + (maxF - minF) * t;
          return (
            <text key={t} x={PL + t * iw} y={H - 8} fontSize="9" fill="rgba(230,247,255,0.5)" textAnchor="middle">{f.toFixed(0)} Hz</text>
          );
        })}
        <text x={W / 2} y={H - 1} fontSize="9" fill="rgba(230,247,255,0.4)" textAnchor="middle">频率</text>
      </svg>
    );
  };

  // 8 传感器概率柱状图 (技术详情)
  const renderProbBars = () => {
    if (!prediction?.all_probabilities) return null;
    const probs = prediction.all_probabilities;
    const entries = Object.entries(probs).sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxProb = Math.max(...entries.map(([, v]) => v), 0.01);
    const predCh = prediction.predicted_channel;

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
      {/* 标题与控制区 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-wave-square" style={{ color: '#00ffe1', marginRight: 8 }} />
          振动诊断
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={channelId} onChange={e => selectChannel?.(e.target.value)} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            {['1', '2', '3', '4', '5', '6', '7', '8'].map(ch => <option key={ch} value={ch}>传感器 {ch}</option>)}
          </select>
          <button type="button" onClick={run} disabled={loading || !freqReady} style={{
            padding: '6px 16px',
            background: loading ? 'rgba(0,255,255,0.2)' : 'rgba(0,255,255,0.15)',
            border: '1px solid rgba(0,255,255,0.5)', color: '#00ffe1', borderRadius: 4,
            cursor: loading || !freqReady ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 'bold',
          }}>
            {loading
              ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />分析中...</>
              : <><i className="fas fa-play" style={{ marginRight: 6 }} />开始诊断</>}
          </button>
        </div>
      </div>

      {!freqReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 10, padding: 8, background: 'rgba(250, 173, 20, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
          诊断功能尚未启用,请联系技术团队。
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(0, 255, 255, 0.6)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 22, marginBottom: 8, display: 'block' }} />
          <div style={{ fontSize: 12 }}>正在分析振动信号...</div>
        </div>
      )}

      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          分析失败: {result.message}
        </div>
      )}

      {result && result.success && prediction && (
        <div>
          {/* 1. 状态结论卡 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 12, marginBottom: 10,
            background: config.bg, border: `1px solid ${config.border}`, borderRadius: 8,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: config.bg, border: `2px solid ${config.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: config.color,
            }}>
              <i className={`fas ${config.icon}`} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginBottom: 2 }}>
                诊断结论 <span style={{ color: config.color, fontWeight: 'bold' }}>· {config.label}</span>
              </div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 'bold', lineHeight: 1.4 }}>
                {config.conclusion}
              </div>
            </div>
          </div>

          {/* 2. 三个关键指标卡 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <MetricCard
              label="诊断结果"
              value={prediction.is_anomaly ? '异常' : '正常'}
              color={prediction.is_anomaly ? '#ff7a7a' : '#95de64'}
            />
            <MetricCard
              label="异常程度"
              value={getAnomalyLevel(prediction.anomaly_score)}
              color={prediction.anomaly_score < 0.3 ? '#95de64' : prediction.anomaly_score < 0.7 ? '#faad14' : '#ff7a7a'}
            />
            <MetricCard
              label="识别可信度"
              value={getConfidenceLevel(prediction.confidence)}
              color={prediction.confidence > 0.8 ? '#95de64' : prediction.confidence >= 0.6 ? '#faad14' : '#ff7a7a'}
            />
          </div>

          {/* 3. 简化图表: 正常/异常指示器 + 频谱图 */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, padding: 8, marginBottom: 10 }}>
            {/* 正常/异常指示器 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', marginBottom: 8, borderRadius: 4,
              background: config.bg, border: `1px solid ${config.border}`,
            }}>
              <span style={{ fontSize: 12, color: 'rgba(230,247,255,0.7)' }}>振动信号状态</span>
              <span style={{
                fontSize: 15, fontWeight: 'bold', color: config.color,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <i className={`fas ${config.icon}`} />
                {prediction.is_anomaly ? '异常' : '正常'}
              </span>
            </div>
            {/* 频谱图 */}
            <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.5)', marginBottom: 2, padding: '0 4px' }}>
              频谱图
            </div>
            {renderSpectrum()}
          </div>

          {/* 4. 处置建议 */}
          <div style={{
            padding: 10, marginBottom: 10, borderRadius: 4,
            background: 'rgba(0, 255, 255, 0.06)', border: '1px solid rgba(0, 255, 255, 0.2)',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(0, 255, 255, 0.7)', marginBottom: 4 }}>
              <i className="fas fa-lightbulb" style={{ marginRight: 4 }} />
              处置建议
            </div>
            <div style={{ fontSize: 12, color: '#e6f7ff', lineHeight: 1.5 }}>
              {config.advice}
            </div>
          </div>

          {/* 5. 技术详情 (可折叠) */}
          <div style={{ marginBottom: 8, border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowTechDetails(!showTechDetails)}
              style={{
                width: '100%', padding: '8px 10px', textAlign: 'left',
                background: 'rgba(0,0,0,0.3)', border: 'none', color: 'rgba(0, 255, 255, 0.7)',
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className={`fas fa-chevron-${showTechDetails ? 'down' : 'right'}`} style={{ fontSize: 10 }} />
              技术详情
            </button>
            {showTechDetails && (
              <div style={{ padding: 10 }}>
                {/* 模型验证信息 */}
                {freqAcc != null && (
                  <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginBottom: 8 }}>
                    模型验证准确率: <strong style={{ color: '#00ffe1' }}>{(freqAcc * 100).toFixed(1)}%</strong>
                  </div>
                )}
                {/* 8 传感器概率分布 */}
                <div style={{ fontSize: 11, color: 'rgba(0, 255, 255, 0.7)', marginBottom: 4 }}>
                  8 传感器分类概率 (预测: 传感器 {prediction.predicted_channel})
                </div>
                {renderProbBars()}
                {/* 频谱统计 */}
                {result.spectrum_stats && (
                  <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 10 }}>
                    <div>最大幅值: <strong style={{ color: '#00ffe1' }}>{result.spectrum_stats.amp_max.toFixed(6)}</strong></div>
                    <div>平均幅值: <strong style={{ color: '#00ffe1' }}>{result.spectrum_stats.amp_mean.toFixed(6)}</strong></div>
                    <div>标准差: <strong style={{ color: '#00ffe1' }}>{result.spectrum_stats.amp_std.toFixed(6)}</strong></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. 原始数据 (可折叠) */}
          <div style={{ border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowRawData(!showRawData)}
              style={{
                width: '100%', padding: '8px 10px', textAlign: 'left',
                background: 'rgba(0,0,0,0.3)', border: 'none', color: 'rgba(0, 255, 255, 0.7)',
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className={`fas fa-chevron-${showRawData ? 'down' : 'right'}`} style={{ fontSize: 10 }} />
              原始数据
            </button>
            {showRawData && result.spectrum_data && (
              <div style={{ padding: 10, maxHeight: 220, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: 'rgba(230,247,255,0.5)', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.5)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid rgba(0,255,255,0.1)' }}>频率 (Hz)</th>
                      <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid rgba(0,255,255,0.1)' }}>幅值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.spectrum_data.slice(0, 200).map((d, i) => (
                      <tr key={i}>
                        <td style={{ padding: '2px 6px', color: 'rgba(230,247,255,0.7)' }}>{d.frequency.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '2px 6px', color: '#00ffe1' }}>{d.amplitude.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.spectrum_data.length > 200 && (
                  <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.4)', textAlign: 'center', padding: 4 }}>
                    (仅显示前 200 条,共 {result.spectrum_data.length} 条)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !loading && freqReady && (
        <div style={{ color: 'rgba(230,247,255,0.4)', textAlign: 'center', padding: 24, fontSize: 12 }}>
          选择传感器并点击"开始诊断"进行振动分析
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: 8, borderRadius: 4, textAlign: 'center',
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.15)',
  }}>
    <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.6)', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 'bold', color }}>{value}</div>
  </div>
);

export default VibrationFreqAIPrediction;
