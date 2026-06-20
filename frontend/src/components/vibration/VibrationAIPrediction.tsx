import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useVibration } from '../../contexts/VibrationContext';
import { fetchVibrationPrediction } from '../../utils/apiClient';
import type { CardComponentProps } from '../../types/layout';

type Props = CardComponentProps;

const CHANNEL_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];

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
    conclusion: '振动波形预测正常,有效值在安全范围内',
    advice: '设备运行正常,按常规计划维护即可。',
  },
  attention: {
    color: '#faad14',
    bg: 'rgba(250, 173, 20, 0.12)',
    border: 'rgba(250, 173, 20, 0.45)',
    icon: 'fa-eye',
    label: '关注',
    conclusion: '预测振动强度偏高,建议关注设备运行状态',
    advice: '振动略有波动,建议持续监控并记录变化趋势。',
  },
  warning: {
    color: '#fa8c16',
    bg: 'rgba(250, 140, 22, 0.12)',
    border: 'rgba(250, 140, 22, 0.45)',
    icon: 'fa-exclamation-triangle',
    label: '预警',
    conclusion: '预测振动强度明显增大,建议排查设备状态',
    advice: '预测振动增大,建议排查振动源,检查设备安装与平衡状态。',
  },
  danger: {
    color: '#ff4d4f',
    bg: 'rgba(255, 77, 79, 0.12)',
    border: 'rgba(255, 77, 79, 0.45)',
    icon: 'fa-times-circle',
    label: '危险',
    conclusion: '预测振动强度严重超标,建议立即停机检查',
    advice: '预测振动严重超标,建议立即停机检查,避免设备损坏。',
  },
};

const getSafetyLevel = (rms: number): SafetyLevel => {
  if (rms < 1) return 'safe';
  if (rms < 3) return 'attention';
  if (rms < 5) return 'warning';
  return 'danger';
};

const calcRMS = (arr: number[]): number =>
  Math.sqrt(arr.reduce((a, b) => a + b * b, 0) / (arr.length || 1));

const VibrationAIPrediction: React.FC<Props> = ({ cardId }) => {
  const { selectedChannelId } = useVibration();
  const [channelId, setChannelId] = useState<string>(String(selectedChannelId || '1'));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  // 同步振动页的当前选中传感器
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

  // 计算有效值
  const predictedRMS = forecast ? calcRMS(forecast.amplitude) : 0;
  const realRMS = fullWave ? calcRMS(fullWave.amplitude_real) : 0;
  const level = getSafetyLevel(predictedRMS);
  const config = LEVEL_CONFIG[level];

  // 趋势判断
  const getTrend = (): string => {
    if (realRMS === 0) return '—';
    if (predictedRMS > realRMS * 1.1) return '上升';
    if (predictedRMS < realRMS * 0.9) return '下降';
    return '平稳';
  };

  // 超限预计
  const overLimit = predictedRMS >= 5;

  // 16 维特征对比
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
      {/* 标题与控制区 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-chart-line" style={{ color: '#06b6d4', marginRight: 8 }} />
          振动波形预测
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}
          >
            {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>传感器 {c}</option>)}
          </select>
          <button
            onClick={() => runPredict()}
            disabled={loading}
            style={{
              background: loading ? '#475569' : '#0891b2', color: '#fff', border: 'none',
              padding: '5px 14px', borderRadius: 4, cursor: loading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 'bold',
            }}
          >
            {loading ? '预测中…' : '开始预测'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#67e8f9' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 22, marginBottom: 8, display: 'block' }} />
          <div style={{ fontSize: 12 }}>正在预测振动波形...</div>
        </div>
      )}

      {result && !error && forecast && (
        <>
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
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                预测结论 <span style={{ color: config.color, fontWeight: 'bold' }}>· {config.label}</span>
              </div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 'bold', lineHeight: 1.4 }}>
                {config.conclusion}
              </div>
            </div>
          </div>

          {/* 2. 三个关键指标卡 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <MetricCard
              label="当前强度"
              value={realRMS > 0 ? realRMS.toFixed(2) : '—'}
              color={realRMS < 1 ? '#52c41a' : realRMS < 3 ? '#faad14' : realRMS < 5 ? '#fa8c16' : '#ff4d4f'}
            />
            <MetricCard
              label="强度趋势"
              value={getTrend()}
              color={getTrend() === '上升' ? '#fa8c16' : getTrend() === '下降' ? '#52c41a' : '#94a3b8'}
            />
            <MetricCard
              label="超限预计"
              value={overLimit ? '是' : '否'}
              color={overLimit ? '#ff4d4f' : '#52c41a'}
            />
          </div>

          {/* 3. 简化图表: 波形对比 */}
          {fullWave && (
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6, marginBottom: 10 }}>
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, display: 'flex', gap: 16 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 2, background: '#22c55e' }} />
                  实测波形
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 2, background: config.color, borderTop: '2px dashed' }} />
                  预测波形
                </span>
              </div>
              <WaveformChart
                time={fullWave.time_s}
                real={fullWave.amplitude_real}
                pred={fullWave.amplitude_predicted}
                levelColor={config.color}
              />
            </div>
          )}

          {/* 4. 处置建议 */}
          <div style={{
            padding: 10, marginBottom: 10, borderRadius: 6,
            background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)',
          }}>
            <div style={{ fontSize: 11, color: '#67e8f9', marginBottom: 4 }}>
              <i className="fas fa-lightbulb" style={{ marginRight: 4 }} />
              处置建议
            </div>
            <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>
              {config.advice}
            </div>
          </div>

          {/* 5. 技术详情 (可折叠) */}
          <div style={{ marginBottom: 8, border: '1px solid #1e293b', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowTechDetails(!showTechDetails)}
              style={{
                width: '100%', padding: '8px 10px', textAlign: 'left',
                background: '#0f172a', border: 'none', color: '#67e8f9',
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className={`fas fa-chevron-${showTechDetails ? 'down' : 'right'}`} style={{ fontSize: 10 }} />
              技术详情
            </button>
            {showTechDetails && (
              <div style={{ padding: 10 }}>
                {/* 预测摘要 */}
                {forecast && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                      预测摘要
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 11 }}>
                      <Metric label="峰值" value={Math.max(...forecast.amplitude).toFixed(3)} />
                      <Metric label="谷值" value={Math.min(...forecast.amplitude).toFixed(3)} />
                      <Metric label="均值" value={(forecast.amplitude.reduce((a: number, b: number) => a + b, 0) / forecast.amplitude.length).toFixed(3)} />
                      <Metric label="有效值" value={predictedRMS.toFixed(3)} />
                    </div>
                  </div>
                )}
                {/* 16 维特征对比表 */}
                {featDelta && (
                  <div style={{ overflow: 'auto' }}>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                      特征对比 (真实 / 预测 / 偏差)
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
              </div>
            )}
          </div>

          {/* 6. 原始数据 (可折叠) */}
          {forecast && (
            <div style={{ border: '1px solid #1e293b', borderRadius: 6, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowRawData(!showRawData)}
                style={{
                  width: '100%', padding: '8px 10px', textAlign: 'left',
                  background: '#0f172a', border: 'none', color: '#67e8f9',
                  fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className={`fas fa-chevron-${showRawData ? 'down' : 'right'}`} style={{ fontSize: 10 }} />
                原始数据
              </button>
              {showRawData && (
                <div style={{ padding: 10, maxHeight: 220, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ color: '#64748b', position: 'sticky', top: 0, background: '#0f172a' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #1e293b' }}>时间 (s)</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid #1e293b' }}>预测幅值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.time_s.map((t: number, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '2px 6px', color: '#94a3b8' }}>{t.toFixed(4)}</td>
                          <td style={{ textAlign: 'right', padding: '2px 6px', color: '#67e8f9' }}>{forecast.amplitude[i].toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {result && !error && !forecast && !loading && (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 24, fontSize: 12 }}>
          未获取到预测数据
        </div>
      )}

      {!result && !error && !loading && (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 24, fontSize: 12 }}>
          选择传感器并点击"开始预测"进行振动波形预测
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: 8, borderRadius: 4, textAlign: 'center',
    background: '#0f172a', border: '1px solid #1e293b',
  }}>
    <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>{label}</div>
    <div style={{ color, fontSize: 16, fontWeight: 'bold' }}>{value}</div>
  </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: '#020617', padding: '6px 10px', borderRadius: 4 }}>
    <div style={{ color: '#64748b', fontSize: 10 }}>{label}</div>
    <div style={{ color: '#e2e8f0', fontSize: 13, marginTop: 2 }}>{value}</div>
  </div>
);

const WaveformChart: React.FC<{ time: number[]; real: number[]; pred: number[]; levelColor: string }> = ({ time, real, pred, levelColor }) => {
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
      {/* 实测 (前 50) */}
      <path d={buildPath(real.slice(0, 50))} fill="none" stroke="#22c55e" strokeWidth={1.5} />
      {/* 实测 (全部, 浅) */}
      <path d={buildPath(real)} fill="none" stroke="#1e3a3a" strokeWidth={0.6} />
      {/* 预测 (后 50, 高亮) */}
      <path d={buildPath(pred)} fill="none" stroke={levelColor} strokeWidth={1.5} strokeDasharray="3,2" />
      {/* 分隔线 */}
      <line x1={pad + 50 * xStep} x2={pad + 50 * xStep} y1={pad} y2={h - pad} stroke="#475569" strokeDasharray="2,2" />
      <text x={pad + 2} y={h - 2} fontSize="9" fill="#94a3b8">实测</text>
      <text x={pad + 50 * xStep + 4} y={pad + 10} fontSize="9" fill={levelColor}>预测</text>
    </svg>
  );
};

export default VibrationAIPrediction;
