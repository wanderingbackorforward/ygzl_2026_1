import React, { useState, useEffect } from 'react';
import { fetchTBMPrediction, fetchDLStatus } from '../../utils/apiClient';

interface PredictionResult {
  success: boolean;
  tbm_id?: string;
  model_info?: any;
  historical?: { date: string; values: Record<string, number> }[];
  forecast?: {
    dates: string[];
    targets: string[];
    values: Record<string, number>[];
    lower_bound: Record<string, number>[];
    upper_bound: Record<string, number>[];
  };
  message?: string;
}

const TBM_IDS = [
  'TBM001',
  'TBM20251009001750',
  'TBM20251009003110',
  'TBM20251009005713',
  'TBM20251009163016',
];

const TARGET_LABELS: Record<string, string> = {
  tail_vertical_deviation: '尾部垂直偏差',
  tail_horizontal_deviation: '尾部水平偏差',
  head_vertical_deviation: '头部垂直偏差',
  head_horizontal_deviation: '头部水平偏差',
};

const TARGET_COLORS: Record<string, string> = {
  tail_vertical_deviation: '#00ffe1',
  tail_horizontal_deviation: '#52c41a',
  head_vertical_deviation: '#faad14',
  head_horizontal_deviation: '#ff7a45',
};

const TBMAIPrediction: React.FC = () => {
  const [tbmId, setTbmId] = useState(TBM_IDS[0]);
  const [predLen, setPredLen] = useState(4);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);

  useEffect(() => {
    fetchDLStatus().then((s: any) => setDlStatus(s));
  }, []);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r: any = await fetchTBMPrediction(tbmId, predLen);
      setResult(r as PredictionResult);
    } finally {
      setLoading(false);
    }
  };

  const tbmReady = dlStatus?.models?.tbm?.weights_loaded;
  const tbmMae = dlStatus?.models?.tbm?.metrics?.val_mae_real;

  // 渲染单个目标的 SVG 图
  const renderTargetChart = (target: string) => {
    if (!result?.success || !result.historical || !result.forecast) return null;
    const label = TARGET_LABELS[target] || target;
    const color = TARGET_COLORS[target] || '#00ffe1';

    const hist = result.historical.map(h => ({ date: h.date, value: h.values[target] || 0 }));
    const fc = result.forecast.dates.map((d, i) => ({
      date: d,
      value: result.forecast!.values[i][target] || 0,
      lower: result.forecast!.lower_bound[i][target] || 0,
      upper: result.forecast!.upper_bound[i][target] || 0,
    }));

    // 拼接: 历史 + 预测(预测第一个点 = 历史最后一个点,避免断线)
    const startV = hist.length > 0 ? hist[hist.length - 1].value : 0;
    const fcDates = hist.length > 0 ? [hist[hist.length - 1].date, ...fc.map(f => f.date)] : fc.map(f => f.date);
    const fcVals = hist.length > 0 ? [startV, ...fc.map(f => f.value)] : fc.map(f => f.value);
    const fcLower = hist.length > 0 ? [startV, ...fc.map(f => f.lower)] : fc.map(f => f.lower);
    const fcUpper = hist.length > 0 ? [startV, ...fc.map(f => f.upper)] : fc.map(f => f.upper);

    const W = 340, H = 160, PL = 40, PR = 12, PT = 14, PB = 26;
    const iw = W - PL - PR, ih = H - PT - PB;
    const allVals = [...hist.map(h => h.value), ...fcVals, ...fcLower, ...fcUpper];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1e-6;
    const pad = range * 0.15;
    const yMin = minV - pad, yMax = maxV + pad;
    const yScale = (v: number) => PT + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const n = hist.length + fcVals.length - 1;
    const xScale = (i: number) => PL + (n === 0 ? 0 : (i / n) * iw);

    const toLine = (arr: number[], offset: number) =>
      arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i + offset).toFixed(2)} ${yScale(v).toFixed(2)}`).join(' ');
    const histLine = toLine(hist.map(h => h.value), 0);
    const fcLine = toLine(fcVals, hist.length - 1);
    const lbLine = toLine(fcLower, hist.length - 1);
    const ubLine = toLine(fcUpper, hist.length - 1);

    // CI 区域
    const ciPath = [
      ...fcVals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(hist.length - 1 + i).toFixed(2)} ${yScale(fcUpper[i]).toFixed(2)}`),
      ...fcVals.map((v, i) => `L ${xScale(hist.length - 1 + fcVals.length - 1 - i).toFixed(2)} ${yScale(fcLower[fcVals.length - 1 - i]).toFixed(2)}`),
    ].join(' ');

    const splitX = xScale(hist.length - 1);
    const yTicks = [0, 0.5, 1].map(t => ({ y: yScale(yMin + (yMax - yMin) * t), label: (yMin + (yMax - yMin) * t).toFixed(2) }));

    return (
      <div key={target} style={{
        background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}40`, borderRadius: 4, padding: 6,
      }}>
        <div style={{ fontSize: 11, color, marginBottom: 2, fontWeight: 'bold' }}>{label}</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140, display: 'block' }}>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" />
              <text x={PL - 4} y={t.y + 3} fontSize="8" fill="rgba(230,247,255,0.5)" textAnchor="end">{t.label}</text>
            </g>
          ))}
          <line x1={splitX} y1={PT} x2={splitX} y2={H - PB} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
          <path d={ciPath} fill={`${color}20`} stroke="none" />
          <path d={lbLine} fill="none" stroke={`${color}60`} strokeDasharray="2 2" strokeWidth="0.8" />
          <path d={ubLine} fill="none" stroke={`${color}60`} strokeDasharray="2 2" strokeWidth="0.8" />
          <path d={histLine} fill="none" stroke={`${color}90`} strokeWidth="1.2" />
          <path d={fcLine} fill="none" stroke={color} strokeWidth="1.8" />
          {hist.map((h, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(h.value)} r="1.5" fill={`${color}90`} />
          ))}
          {fcVals.map((v, i) => (
            <circle key={i} cx={xScale(hist.length - 1 + i)} cy={yScale(v)} r="2" fill={color} />
          ))}
        </svg>
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
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-microchip" style={{ color: '#00ffe1', marginRight: 8 }} />
          盾构姿态预测
          <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
            基于掘进参数(推力/扭矩/转速),预测未来 20 分钟的姿态偏差
          </span>
        </h3>
        {tbmReady && tbmMae != null && (
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'rgba(82, 196, 26, 0.15)', border: '1px solid rgba(82, 196, 26, 0.4)', color: '#95de64',
          }}>
            <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
            预测可信度: {tbmMae < 0.5 ? '高' : tbmMae < 1.0 ? '中' : '低'}
          </div>
        )}
      </div>

      {!tbmReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 10 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          预测功能尚未启用,请联系技术团队。
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>盾构机:</span>
          <select value={tbmId} onChange={e => setTbmId(e.target.value)} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            {TBM_IDS.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>预测步数:</span>
          <select value={predLen} onChange={e => setPredLen(Number(e.target.value))} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            <option value={4}>4 步 (20 min)</option>
            <option value={8}>8 步 (40 min)</option>
          </select>
        </div>
        <button type="button" onClick={run} disabled={loading || !tbmReady} style={{
          padding: '6px 16px',
          background: loading ? 'rgba(0,255,255,0.2)' : 'rgba(0,255,255,0.15)',
          border: '1px solid rgba(0,255,255,0.5)', color: '#00ffe1', borderRadius: 4,
          cursor: loading || !tbmReady ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 'bold',
        }}>
          {loading
            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />预测中...</>
            : <><i className="fas fa-play" style={{ marginRight: 6 }} />运行预测</>}
        </button>
      </div>

      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          预测失败: {result.message}
        </div>
      )}

      {result && result.success && (
        <div>
          {/* 4 个目标 2x2 网格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
            {result.forecast?.targets.map(t => renderTargetChart(t))}
          </div>

          {/* 预测数据表 */}
          <div style={{ fontSize: 11, color: 'rgba(82, 196, 26, 0.9)', marginBottom: 4 }}>
            <i className="fas fa-arrow-right" style={{ marginRight: 4 }} />
            AI 预测未来 {result.forecast?.dates.length || 0} 个 5min 步
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,255,255,0.2)' }}>
                  <th style={{ padding: '4px 8px', textAlign: 'left', color: 'rgba(230,247,255,0.6)' }}>时刻</th>
                  {result.forecast?.targets.map(t => (
                    <th key={t} style={{ padding: '4px 8px', textAlign: 'right', color: TARGET_COLORS[t] || '#00ffe1' }}>
                      {TARGET_LABELS[t] || t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.forecast?.dates.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                    <td style={{ padding: '4px 8px', color: 'rgba(230,247,255,0.6)' }}>{d.slice(5, 16)}</td>
                    {result.forecast?.targets.map(t => (
                      <td key={t} style={{ padding: '4px 8px', textAlign: 'right', color: '#95de64', fontWeight: 'bold' }}>
                        {result.forecast!.values[i][t]?.toFixed(3)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TBMAIPrediction;
