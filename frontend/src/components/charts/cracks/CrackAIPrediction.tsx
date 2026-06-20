import React, { useState, useEffect } from 'react';
import { useCracks } from '../../contexts/CracksContext';
import { fetchCrackPrediction, fetchPredictionHistory, fetchDLStatus } from '../../utils/apiClient';

interface ForecastPoint {
  date: string;
  value: number;
  lower_bound?: number;
  upper_bound?: number;
}

interface PredictionResult {
  success: boolean;
  point_id?: string;
  model_info?: any;
  meta?: {
    location?: string;
    description?: string;
    trend_type?: string;
    trend_slope?: number;
    r_value?: number;
    initial_value?: number;
    last_value?: number;
    total_change?: number;
    change_type?: string;
    status?: string;
  };
  historical?: { date: string; value: number }[];
  forecast?: {
    dates: string[];
    values: number[];
    lower_bound: number[];
    upper_bound: number[];
  };
  message?: string;
}

const CrackAIPrediction: React.FC<{ cardId?: string }> = () => {
  const { points, selectedPointId, selectPoint } = useCracks();
  const [predLen, setPredLen] = useState(10);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    fetchDLStatus().then((s: any) => setDlStatus(s));
  }, []);

  const run = async () => {
    if (!selectedPointId) return;
    setLoading(true);
    setResult(null);
    try {
      const r: any = await fetchCrackPrediction(selectedPointId, predLen);
      setResult(r as PredictionResult);
      if (r.success) {
        const h: any = await fetchPredictionHistory('crack', selectedPointId, 5);
        setHistory(h.predictions || []);
      } else {
        setHistory([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const crackReady = dlStatus?.models?.crack?.weights_loaded;
  const crackMae = dlStatus?.models?.crack?.metrics?.val_mae_real;

  // 拼接历史 + 预测曲线
  const allSeries = (() => {
    if (!result?.success || !result.historical || !result.forecast) return null;
    const histDates = result.historical.map(h => h.date);
    const histVals = result.historical.map(h => h.value);
    // 拼接点: 第一个预测 = 历史最后一点 (避免断线)
    const fcastDates = result.forecast.dates;
    const fcastVals = result.forecast.values;
    const lb = result.forecast.lower_bound;
    const ub = result.forecast.upper_bound;
    const startV = histVals.length > 0 ? histVals[histVals.length - 1] : null;
    return {
      hist: { dates: histDates, values: histVals },
      fc: {
        dates: startV != null ? [histDates[histDates.length - 1], ...fcastDates] : fcastDates,
        values: startV != null ? [startV, ...fcastVals] : fcastVals,
        lower: startV != null ? [startV, ...lb] : lb,
        upper: startV != null ? [startV, ...ub] : ub,
      },
    };
  })();

  // 简单 SVG 折线图
  const renderChart = () => {
    if (!allSeries) return null;
    const W = 720, H = 240, PL = 50, PR = 20, PT = 18, PB = 32;
    const iw = W - PL - PR, ih = H - PT - PB;
    const { hist, fc } = allSeries;
    const allVals = [...hist.values, ...fc.values, ...fc.lower, ...fc.upper];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1e-6;
    const pad = range * 0.15;
    const yMin = minV - pad, yMax = maxV + pad;
    const yScale = (v: number) => PT + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const n = hist.dates.length + fc.dates.length - 1; // 共享点
    const xScale = (i: number) => PL + (n === 0 ? 0 : (i / n) * iw);

    const toLine = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yScale(v).toFixed(2)}`).join(' ');
    const histLine = toLine(hist.values);
    const fcLine = toLine(fc.values);
    const lbLine = toLine(fc.lower);
    const ubLine = toLine(fc.upper);
    // CI 区域
    const ciArea = [...fc.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yScale(fc.upper[i]).toFixed(2)}`),
                     ...fc.values.map((v, i) => `${fc.values.length - 1 - i === 0 ? 'M' : 'L'} ${xScale(fc.values.length - 1 - i).toFixed(2)} ${yScale(fc.lower[fc.values.length - 1 - i]).toFixed(2)}`).reverse()]
      .join(' ');

    // X 轴刻度: 头/中/尾
    const xTicks = [0, Math.floor(n / 2), n].map(i => {
      const date = i < hist.dates.length ? hist.dates[i] : fc.dates[i - hist.dates.length + 1];
      return { x: xScale(i), label: date ? date.slice(5, 16).replace('T', ' ') : '' };
    });
    // Y 轴 4 刻度
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: yScale(yMin + (yMax - yMin) * t), label: (yMin + (yMax - yMin) * t).toFixed(4) }));

    const splitX = xScale(hist.values.length - 1);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 240, display: 'block' }}>
        {/* 网格 */}
        {yTicks.map((t, i) => (
          <g key={`g${i}`}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(0,255,255,0.08)" strokeDasharray="2 3" />
            <text x={PL - 6} y={t.y + 3} fontSize="9" fill="rgba(230,247,255,0.55)" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {/* 历史/预测分界 */}
        <line x1={splitX} y1={PT} x2={splitX} y2={H - PB} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
        <text x={splitX} y={PT - 4} fontSize="9" fill="rgba(255,255,255,0.55)" textAnchor="middle">↑ 预测起点</text>
        {/* CI 区域 */}
        <path d={ciArea} fill="rgba(82, 196, 26, 0.18)" stroke="none" />
        {/* CI 边界 */}
        <path d={lbLine} fill="none" stroke="rgba(82, 196, 26, 0.5)" strokeDasharray="2 2" strokeWidth="1" />
        <path d={ubLine} fill="none" stroke="rgba(82, 196, 26, 0.5)" strokeDasharray="2 2" strokeWidth="1" />
        {/* 历史线 */}
        <path d={histLine} fill="none" stroke="rgba(0, 255, 255, 0.9)" strokeWidth="1.5" />
        {/* 预测线 */}
        <path d={fcLine} fill="none" stroke="rgba(82, 196, 26, 1)" strokeWidth="2" />
        {/* 数据点 */}
        {hist.values.map((v, i) => (
          <circle key={`h${i}`} cx={xScale(i)} cy={yScale(v)} r="2" fill="rgba(0,255,255,0.9)" />
        ))}
        {fc.values.map((v, i) => (
          <circle key={`f${i}`} cx={xScale(hist.values.length - 1 + i)} cy={yScale(v)} r="2.5" fill="rgba(82, 196, 26, 1)" />
        ))}
        {/* X 轴 */}
        {xTicks.map((t, i) => (
          <text key={`x${i}`} x={t.x} y={H - 12} fontSize="9" fill="rgba(230,247,255,0.6)" textAnchor="middle">{t.label}</text>
        ))}
        {/* 图例 */}
        <g transform={`translate(${PL}, ${H - 4})`}>
          <rect x="0" y="-8" width="10" height="2" fill="rgba(0,255,255,0.9)" />
          <text x="14" y="-5" fontSize="9" fill="rgba(230,247,255,0.7)">历史</text>
          <rect x="60" y="-8" width="10" height="2" fill="rgba(82, 196, 26, 1)" />
          <text x="74" y="-5" fontSize="9" fill="rgba(230,247,255,0.7)">预测</text>
          <rect x="120" y="-8" width="10" height="6" fill="rgba(82, 196, 26, 0.18)" />
          <text x="134" y="-5" fontSize="9" fill="rgba(230,247,255,0.7)">95% CI</text>
        </g>
      </svg>
    );
  };

  // 柱状图
  const renderBarChart = () => {
    if (!result?.success || !result.forecast) return null;
    const { values, lower_bound, upper_bound, dates } = result.forecast;
    const W = 720, H = 220, PL = 50, PR = 20, PT = 18, PB = 36;
    const iw = W - PL - PR, ih = H - PT - PB;
    const allVals = [...values, ...lower_bound, ...upper_bound];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1e-6;
    const pad = range * 0.15;
    const yMin = minV - pad, yMax = maxV + pad;
    const yScale = (v: number) => PT + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const bw = iw / values.length * 0.7;
    const stepX = iw / values.length;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = yScale(yMin + (yMax - yMin) * t);
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(0,255,255,0.08)" strokeDasharray="2 3" />
              <text x={PL - 6} y={y + 3} fontSize="9" fill="rgba(230,247,255,0.55)" textAnchor="end">{(yMin + (yMax - yMin) * t).toFixed(4)}</text>
            </g>
          );
        })}
        {/* CI 误差棒 */}
        {values.map((v, i) => {
          const cx = PL + stepX * (i + 0.5);
          return (
            <line key={`e${i}`} x1={cx} y1={yScale(upper_bound[i])} x2={cx} y2={yScale(lower_bound[i])}
                  stroke="rgba(82, 196, 26, 0.7)" strokeWidth="1" />
          );
        })}
        {/* 柱 */}
        {values.map((v, i) => {
          const cx = PL + stepX * (i + 0.5);
          const top = yScale(v);
          const bottom = yScale(yMin);
          return (
            <g key={`b${i}`}>
              <rect x={cx - bw / 2} y={top} width={bw} height={bottom - top}
                    fill="rgba(82, 196, 26, 0.55)" stroke="rgba(82, 196, 26, 0.9)" strokeWidth="0.5" />
              <text x={cx} y={H - 18} fontSize="8" fill="rgba(230,247,255,0.6)" textAnchor="middle">
                {dates[i] ? dates[i].slice(5, 11) : ''}
              </text>
              <text x={cx} y={top - 4} fontSize="9" fill="#95de64" textAnchor="middle" fontWeight="bold">
                {v.toFixed(3)}
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={H - 2} fontSize="9" fill="rgba(230,247,255,0.5)" textAnchor="middle">预测时刻 (mm)</text>
      </svg>
    );
  };

  return (
    <div style={{
      padding: 16,
      background: 'rgba(0, 20, 40, 0.4)',
      border: '1px solid rgba(0, 255, 255, 0.25)',
      borderRadius: 8,
      color: '#e6f7ff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
            <i className="fas fa-microchip" style={{ color: '#00ffe1', marginRight: 8 }} />
            AI 裂缝预测
            <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
              基于 31 个监测点的历史趋势,预测未来 2.5 天的裂缝变化
            </span>
          </h3>
        </div>
        {crackReady && crackMae != null && (
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'rgba(82, 196, 26, 0.15)', border: '1px solid rgba(82, 196, 26, 0.4)', color: '#95de64',
          }}>
            <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
            Val MAE = {crackMae.toFixed(4)} mm
          </div>
        )}
      </div>

      {!crackReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 12 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          裂缝模型未在 Supabase 注册。请先运行 <code>train_crack.py</code> + <code>upload_crack.py</code>。
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>监测点:</span>
          <select value={selectedPointId || ''} onChange={e => selectPoint(e.target.value || null)} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12, maxWidth: 100,
          }}>
            {points && points.length > 0 ? (
              points.map(p => <option key={p} value={p}>{p}</option>)
            ) : (
              <option value="">无监测点</option>
            )}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>预测步数:</span>
          <select value={predLen} onChange={e => setPredLen(Number(e.target.value))} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            <option value={5}>5 步 (1.25 天)</option>
            <option value={10}>10 步 (2.5 天)</option>
            <option value={20}>20 步 (5 天)</option>
            <option value={30}>30 步 (7.5 天)</option>
          </select>
        </div>
        <button type="button" onClick={run} disabled={loading || !selectedPointId || !crackReady} style={{
          padding: '6px 16px',
          background: loading ? 'rgba(0,255,255,0.2)' : 'rgba(0,255,255,0.15)',
          border: '1px solid rgba(0,255,255,0.5)', color: '#00ffe1', borderRadius: 4,
          cursor: loading || !selectedPointId || !crackReady ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 'bold',
        }}>
          {loading
            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />预测中...</>
            : <><i className="fas fa-play" style={{ marginRight: 6 }} />运行预测</>}
        </button>
        {result?.success && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => setChartMode('line')} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
              background: chartMode === 'line' ? 'rgba(0,255,255,0.25)' : 'transparent',
              border: '1px solid rgba(0,255,255,0.3)', color: '#00ffe1',
            }}>折线</button>
            <button type="button" onClick={() => setChartMode('bar')} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
              background: chartMode === 'bar' ? 'rgba(0,255,255,0.25)' : 'transparent',
              border: '1px solid rgba(0,255,255,0.3)', color: '#00ffe1',
            }}>柱状</button>
          </div>
        )}
      </div>

      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          预测失败: {result.message}
        </div>
      )}

      {result && result.success && (
        <div>
          {/* 元信息卡 */}
          {result.meta && Object.keys(result.meta).length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 8, marginBottom: 10, padding: 8,
              background: 'rgba(0, 255, 255, 0.04)',
              border: '1px solid rgba(0, 255, 255, 0.1)',
              borderRadius: 4,
            }}>
              {result.meta.trend_type && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(230,247,255,0.5)' }}>趋势类型:</span>{' '}
                  <strong style={{ color: '#95de64' }}>{result.meta.trend_type}</strong>
                </div>
              )}
              {result.meta.trend_slope != null && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(230,247,255,0.5)' }}>斜率:</span>{' '}
                  <strong style={{ color: '#95de64' }}>{Number(result.meta.trend_slope).toFixed(6)}</strong>
                </div>
              )}
              {result.meta.r_value != null && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(230,247,255,0.5)' }}>R 值:</span>{' '}
                  <strong style={{ color: '#95de64' }}>{Number(result.meta.r_value).toFixed(4)}</strong>
                </div>
              )}
              {result.meta.total_change != null && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(230,247,255,0.5)' }}>累计变化:</span>{' '}
                  <strong style={{ color: '#95de64' }}>{Number(result.meta.total_change).toFixed(4)} mm</strong>
                </div>
              )}
              {result.meta.location && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(230,247,255,0.5)' }}>位置:</span>{' '}
                  <strong style={{ color: '#95de64' }}>{result.meta.location}</strong>
                </div>
              )}
              {result.meta.status && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(230,247,255,0.5)' }}>状态:</span>{' '}
                  <strong style={{ color: '#95de64' }}>{result.meta.status}</strong>
                </div>
              )}
            </div>
          )}

          {/* 图表 */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, padding: 4, marginBottom: 10 }}>
            {chartMode === 'line' ? renderChart() : renderBarChart()}
          </div>

          {/* 预测数据卡 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(82, 196, 26, 0.9)', marginBottom: 4 }}>
              <i className="fas fa-arrow-right" style={{ marginRight: 4 }} />
              AI 预测未来 {result.forecast.values.length} 个 6h 步 ({(result.forecast.values.length * 6 / 24).toFixed(1)} 天)
            </div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
              {result.forecast.dates.map((d, i) => (
                <div key={i} style={{
                  padding: '4px 6px',
                  background: 'rgba(82, 196, 26, 0.1)',
                  border: '1px solid rgba(82, 196, 26, 0.3)',
                  borderRadius: 3,
                  minWidth: 78,
                  flex: '0 0 auto',
                }}>
                  <div style={{ fontSize: 9, color: 'rgba(230,247,255,0.6)' }}>{d.slice(5, 16).replace('T', ' ')}</div>
                  <div style={{ fontSize: 13, color: '#95de64', fontWeight: 'bold' }}>
                    {result.forecast.values[i].toFixed(3)}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(230,247,255,0.5)' }}>
                    [{Number(result.forecast.lower_bound[i]).toFixed(3)}, {Number(result.forecast.upper_bound[i]).toFixed(3)}]
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 历史 */}
          {result.historical && result.historical.length > 0 && (
            <details style={{ fontSize: 11, color: 'rgba(230,247,255,0.7)' }}>
              <summary style={{ cursor: 'pointer', color: '#00ffe1' }}>
                <i className="fas fa-database" style={{ marginRight: 4 }} />
                历史观测 ({result.historical.length} 条)
              </summary>
              <div style={{ marginTop: 4, maxHeight: 120, overflowY: 'auto' }}>
                {result.historical.slice(-10).map((h, i) => (
                  <div key={i} style={{ padding: 2, borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                    <span style={{ color: 'rgba(230,247,255,0.5)' }}>{h.date}</span>: {h.value.toFixed(4)} mm
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Supabase 历史 */}
          {history.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => setShowHistory(s => !s)} style={{
                fontSize: 11, padding: '3px 8px', background: 'transparent',
                border: '1px solid rgba(0,255,255,0.3)', color: '#00ffe1', borderRadius: 3, cursor: 'pointer',
              }}>
                {showHistory ? '隐藏' : '查看'} Supabase 预测历史 ({history.length})
              </button>
              {showHistory && (
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  {history.map((h, i) => (
                    <div key={i} style={{ padding: 3, borderBottom: '1px solid rgba(0,255,255,0.1)' }}>
                      <span style={{ color: 'rgba(230,247,255,0.6)' }}>{h.prediction_date}</span>:{' '}
                      {(h.forecast_values as number[]).slice(0, 3).map(v => v.toFixed(3)).join(', ')}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrackAIPrediction;
