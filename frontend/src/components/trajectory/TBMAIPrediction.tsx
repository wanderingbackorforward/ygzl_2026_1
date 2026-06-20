import React, { useState, useEffect } from 'react';
import { fetchTBMPrediction, fetchDLStatus } from '../../utils/apiClient';

// ===== 类型定义 =====
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

// ===== 常量 =====
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

const STEP_MINUTES = 5;          // 每步 5 分钟
const WATCH_DEV = 40;             // 关注阈值 (mm)
const WARN_DEV = 50;              // 预警阈值 (mm)
const DANGER_DEV = 100;           // 危险阈值 (mm)

// ===== 安全等级配置 =====
type SafetyLevel = 'safe' | 'watch' | 'warn' | 'danger';

const LEVEL_CONFIG: Record<SafetyLevel, {
  color: string;
  bg: string;
  icon: string;
  label: string;
  advice: string;
}> = {
  safe: {
    color: '#52c41a',
    bg: 'rgba(82, 196, 26, 0.12)',
    icon: 'fa-check-circle',
    label: '安全',
    advice: '姿态正常,可正常掘进。',
  },
  watch: {
    color: '#faad14',
    bg: 'rgba(250, 173, 20, 0.12)',
    icon: 'fa-eye',
    label: '关注',
    advice: '偏差接近预警值,建议持续监控。',
  },
  warn: {
    color: '#ff7a45',
    bg: 'rgba(255, 122, 69, 0.12)',
    icon: 'fa-exclamation-triangle',
    label: '预警',
    advice: '偏差超过预警值,建议调整掘进参数。',
  },
  danger: {
    color: '#ff4d4f',
    bg: 'rgba(255, 77, 79, 0.12)',
    icon: 'fa-times-circle',
    label: '危险',
    advice: '偏差超过危险值,建议立即停机检查。',
  },
};

// ===== 辅助函数 =====
// 取一组偏差值中的最大绝对值 (mm)
function maxAbsValue(values: Record<string, number>): number {
  return Math.max(...Object.values(values).map(v => Math.abs(v)));
}

function getSafetyLevel(maxDev: number): SafetyLevel {
  if (maxDev >= DANGER_DEV) return 'danger';
  if (maxDev >= WARN_DEV) return 'warn';
  if (maxDev >= WATCH_DEV) return 'watch';
  return 'safe';
}

// 趋势: 比较预测序列中最大偏差的首末变化
function getTrend(maxDevs: number[]): { direction: 'up' | 'down' | 'stable'; change: number } {
  if (maxDevs.length < 2) return { direction: 'stable', change: 0 };
  const change = maxDevs[maxDevs.length - 1] - maxDevs[0];
  if (change > 0.5) return { direction: 'up', change };
  if (change < -0.5) return { direction: 'down', change };
  return { direction: 'stable', change };
}

function getExceedanceEstimate(
  forecastValues: Record<string, number>[],
  currentMaxDev: number,
  maxForecastDev: number,
): { text: string; level: 'none' | 'warn' | 'danger' } {
  // 优先报告危险阈值
  if (maxForecastDev >= DANGER_DEV) {
    if (currentMaxDev >= DANGER_DEV) {
      return { text: '已超过危险值', level: 'danger' };
    }
    for (let i = 0; i < forecastValues.length; i++) {
      if (maxAbsValue(forecastValues[i]) >= DANGER_DEV) {
        return { text: `预计 ${(i + 1) * STEP_MINUTES} 分钟后达到危险值`, level: 'danger' };
      }
    }
  }
  // 其次报告预警阈值
  if (maxForecastDev >= WARN_DEV) {
    if (currentMaxDev >= WARN_DEV) {
      return { text: '已超过预警值', level: 'warn' };
    }
    for (let i = 0; i < forecastValues.length; i++) {
      if (maxAbsValue(forecastValues[i]) >= WARN_DEV) {
        return { text: `预计 ${(i + 1) * STEP_MINUTES} 分钟后达到预警值`, level: 'warn' };
      }
    }
  }
  return { text: '暂无超限风险', level: 'none' };
}

function buildConclusion(
  level: SafetyLevel,
  trend: { direction: string },
  exceedance: { text: string; level: string },
): string {
  const trendText =
    trend.direction === 'up' ? '呈扩大趋势' :
    trend.direction === 'down' ? '呈缩小趋势' : '保持稳定';
  switch (level) {
    case 'safe':
      return '姿态偏差在控制范围内';
    case 'watch':
      return `姿态偏差${trendText},接近预警值`;
    case 'warn':
    case 'danger':
      return `姿态偏差${trendText},${exceedance.text}`;
  }
}

// ===== 组件 =====
const TBMAIPrediction: React.FC = () => {
  const [tbmId, setTbmId] = useState(TBM_IDS[0]);
  const [predLen, setPredLen] = useState(4);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

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

  // ===== 分析预测结果 =====
  let analysis: {
    level: SafetyLevel;
    conclusion: string;
    currentMaxDev: number;
    trend: { direction: 'up' | 'down' | 'stable'; change: number };
    exceedance: { text: string; level: 'none' | 'warn' | 'danger' };
    maxForecastDev: number;
    worstTarget: string;
  } | null = null;

  if (result?.success && result.forecast && result.forecast.values.length > 0 && result.historical) {
    const fcValues = result.forecast.values;
    // 每个预测步的最大偏差序列
    const maxDevs = fcValues.map(maxAbsValue);
    const maxForecastDev = Math.max(...maxDevs);
    const level = getSafetyLevel(maxForecastDev);
    const trend = getTrend(maxDevs);
    // 当前最大偏差 (最后一个历史点)
    const lastHist = result.historical[result.historical.length - 1];
    const currentMaxDev = maxAbsValue(lastHist.values);
    const exceedance = getExceedanceEstimate(fcValues, currentMaxDev, maxForecastDev);
    const conclusion = buildConclusion(level, trend, exceedance);
    // 找出偏差最大的目标
    const lastFc = fcValues[fcValues.length - 1];
    let worstTarget = '';
    let worstVal = 0;
    for (const [t, v] of Object.entries(lastFc)) {
      if (Math.abs(v) > worstVal) {
        worstVal = Math.abs(v);
        worstTarget = t;
      }
    }
    analysis = { level, conclusion, currentMaxDev, trend, exceedance, maxForecastDev, worstTarget };
  }

  // ===== 渲染单个目标的简化趋势图 =====
  const renderTargetChart = (target: string) => {
    if (!result?.success || !result.historical || !result.forecast) return null;
    const label = TARGET_LABELS[target] || target;
    const color = TARGET_COLORS[target] || '#00ffe1';

    // 使用绝对值,让阈值线始终有意义
    const hist = result.historical.map(h => ({ date: h.date, value: Math.abs(h.values[target] || 0) }));
    const fc = result.forecast.dates.map((d, i) => ({
      date: d,
      value: Math.abs(result.forecast!.values[i][target] || 0),
    }));

    // 预测线与历史线连接
    const startV = hist.length > 0 ? hist[hist.length - 1].value : 0;
    const fcVals = hist.length > 0 ? [startV, ...fc.map(f => f.value)] : fc.map(f => f.value);

    const W = 340, H = 150, PL = 38, PR = 10, PT = 12, PB = 24;
    const iw = W - PL - PR, ih = H - PT - PB;

    // Y 轴范围: 包含数据 + 阈值线
    const allVals = [...hist.map(h => h.value), ...fcVals, WARN_DEV, DANGER_DEV];
    const minV = 0; // 绝对值从 0 开始
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;
    const pad = range * 0.1;
    const yMin = minV;
    const yMax = maxV + pad;

    const yScale = (v: number) => PT + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const n = hist.length + fcVals.length - 1;
    const xScale = (i: number) => PL + (n <= 0 ? 0 : (i / n) * iw);

    const toLine = (arr: number[], offset: number) =>
      arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i + offset).toFixed(2)} ${yScale(v).toFixed(2)}`).join(' ');

    const histLine = toLine(hist.map(h => h.value), 0);
    const fcLine = toLine(fcVals, hist.length - 1);
    const splitX = xScale(hist.length - 1);

    // Y 轴刻度
    const yTicks = [0, 0.5, 1].map(t => ({
      y: yScale(yMin + (yMax - yMin) * t),
      label: (yMin + (yMax - yMin) * t).toFixed(1),
    }));

    return (
      <div key={target} style={{
        background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}40`, borderRadius: 4, padding: 6,
      }}>
        <div style={{ fontSize: 11, color, marginBottom: 2, fontWeight: 'bold' }}>{label}</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 130, display: 'block' }}>
          {/* Y 轴网格 */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
              <text x={PL - 4} y={t.y + 3} fontSize="8" fill="rgba(230,247,255,0.4)" textAnchor="end">{t.label}</text>
            </g>
          ))}
          {/* 阈值线 - 预警 */}
          <line x1={PL} y1={yScale(WARN_DEV)} x2={W - PR} y2={yScale(WARN_DEV)} stroke="#ff7a45" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.5" />
          {/* 阈值线 - 危险 */}
          <line x1={PL} y1={yScale(DANGER_DEV)} x2={W - PR} y2={yScale(DANGER_DEV)} stroke="#ff4d4f" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.5" />
          {/* 分割线 */}
          <line x1={splitX} y1={PT} x2={splitX} y2={H - PB} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
          {/* 实测线 */}
          <path d={histLine} fill="none" stroke={`${color}80`} strokeWidth="1.2" />
          {/* 预测线 */}
          <path d={fcLine} fill="none" stroke={color} strokeWidth="1.8" />
          {/* 实测点 */}
          {hist.map((h, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(h.value)} r="1.5" fill={`${color}80`} />
          ))}
          {/* 预测点 */}
          {fcVals.map((v, i) => (
            <circle key={i} cx={xScale(hist.length - 1 + i)} cy={yScale(v)} r="2" fill={color} />
          ))}
        </svg>
      </div>
    );
  };

  const levelCfg = analysis ? LEVEL_CONFIG[analysis.level] : null;

  return (
    <div style={{
      padding: 14,
      background: 'rgba(0, 20, 40, 0.4)',
      border: '1px solid rgba(0, 255, 255, 0.25)',
      borderRadius: 8,
      color: '#e6f7ff',
    }}>
      {/* ===== 标题栏 ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-compass" style={{ color: '#00ffe1', marginRight: 8 }} />
          盾构姿态预测
          <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
            基于掘进参数,预测未来姿态偏差
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

      {/* ===== 未就绪提示 ===== */}
      {!tbmReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 10 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          预测功能尚未启用,请联系技术团队。
        </div>
      )}

      {/* ===== 控制面板 ===== */}
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
          <span style={{ fontSize: 12 }}>预测时长:</span>
          <select value={predLen} onChange={e => setPredLen(Number(e.target.value))} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            <option value={4}>20 分钟</option>
            <option value={8}>40 分钟</option>
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
            : <><i className="fas fa-play" style={{ marginRight: 6 }} />开始预测</>}
        </button>
      </div>

      {/* ===== 预测失败 ===== */}
      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          预测失败: {result.message}
        </div>
      )}

      {/* ===== 预测结果 ===== */}
      {analysis && levelCfg && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 1. 状态结论卡 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
            background: levelCfg.bg, border: `1px solid ${levelCfg.color}50`, borderRadius: 8,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: `${levelCfg.color}25`, border: `2px solid ${levelCfg.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`fas ${levelCfg.icon}`} style={{ color: levelCfg.color, fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: levelCfg.color, fontWeight: 'bold', marginBottom: 2 }}>
                {levelCfg.label}
              </div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>
                {analysis.conclusion}
              </div>
            </div>
          </div>

          {/* 2. 三个关键指标卡 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {/* 当前最大偏差 */}
            <div style={{
              padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(0,255,255,0.15)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>当前最大偏差</div>
              <div style={{ fontSize: 20, color: '#00ffe1', fontWeight: 'bold' }}>
                {analysis.currentMaxDev.toFixed(1)}<span style={{ fontSize: 12, marginLeft: 2 }}>mm</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(230,247,255,0.4)', marginTop: 2 }}>
                {TARGET_LABELS[analysis.worstTarget] || '-'}
              </div>
            </div>
            {/* 偏差趋势 */}
            <div style={{
              padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(0,255,255,0.15)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>偏差趋势</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                {analysis.trend.direction === 'up' && (
                  <span style={{ color: '#ff7a45' }}>
                    <i className="fas fa-arrow-trend-up" /> 扩大
                  </span>
                )}
                {analysis.trend.direction === 'down' && (
                  <span style={{ color: '#52c41a' }}>
                    <i className="fas fa-arrow-trend-down" /> 缩小
                  </span>
                )}
                {analysis.trend.direction === 'stable' && (
                  <span style={{ color: '#faad14' }}>
                    <i className="fas fa-minus" /> 稳定
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.4)', marginTop: 2 }}>
                {analysis.trend.change > 0 ? '+' : ''}{analysis.trend.change.toFixed(1)}mm
              </div>
            </div>
            {/* 超限预计 */}
            <div style={{
              padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(0,255,255,0.15)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>超限预计</div>
              <div style={{
                fontSize: 13, fontWeight: 'bold',
                color: analysis.exceedance.level === 'danger' ? '#ff4d4f' :
                       analysis.exceedance.level === 'warn' ? '#ff7a45' : '#52c41a',
              }}>
                {analysis.exceedance.text}
              </div>
            </div>
          </div>

          {/* 3. 简化趋势图 (4 个偏差 2x2 网格) */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>
              <i className="fas fa-chart-line" style={{ marginRight: 4 }} />
              各偏差趋势 (绝对值)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {result.forecast?.targets.map(t => renderTargetChart(t))}
            </div>
            {/* 图例 */}
            <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'rgba(230,247,255,0.4)', marginTop: 4, justifyContent: 'center' }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'rgba(0,255,225,0.5)', marginRight: 4, verticalAlign: 'middle' }} />实测</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 2, background: '#00ffe1', marginRight: 4, verticalAlign: 'middle' }} />预测</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 0, borderTop: '1px dashed #ff7a45', marginRight: 4, verticalAlign: 'middle' }} />预警 {WARN_DEV}mm</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 0, borderTop: '1px dashed #ff4d4f', marginRight: 4, verticalAlign: 'middle' }} />危险 {DANGER_DEV}mm</span>
            </div>
          </div>

          {/* 4. 处置建议 */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
            background: levelCfg.bg, border: `1px solid ${levelCfg.color}40`, borderRadius: 6,
          }}>
            <i className="fas fa-lightbulb" style={{ color: levelCfg.color, fontSize: 14, marginTop: 1 }} />
            <div>
              <span style={{ fontSize: 11, color: levelCfg.color, fontWeight: 'bold' }}>处置建议: </span>
              <span style={{ fontSize: 12, color: '#e6f7ff' }}>{levelCfg.advice}</span>
            </div>
          </div>

          {/* 5. 技术详情 (可折叠) */}
          <div>
            <button type="button" onClick={() => setShowTechDetails(s => !s)} style={{
              fontSize: 12, padding: '5px 12px', background: 'transparent',
              border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(230,247,255,0.6)',
              borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className={`fas fa-chevron-${showTechDetails ? 'down' : 'right'}`} style={{ fontSize: 10 }} />
              技术详情
            </button>
            {showTechDetails && (
              <div style={{
                marginTop: 6, padding: 10, background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, fontSize: 11,
              }}>
                {/* 模型信息 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>模型类型: </span>{result?.model_info?.model_type || '-'}</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>盾构机数量: </span>{result?.model_info?.n_tbms || '-'}</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>预测步长: </span>{STEP_MINUTES} 分钟</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>平均误差: </span>{tbmMae != null ? `${tbmMae.toFixed(4)} mm` : '-'}</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>预测最大偏差: </span>{analysis.maxForecastDev.toFixed(2)} mm</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>关注阈值: </span>{WATCH_DEV} mm / 预警 {WARN_DEV} mm / 危险 {DANGER_DEV} mm</div>
                </div>
                {/* 4 个偏差的具体数值 */}
                <div style={{ borderTop: '1px solid rgba(0,255,255,0.1)', paddingTop: 8, marginTop: 4 }}>
                  <div style={{ color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>4 个偏差当前值与预测最大值:</div>
                  {result?.forecast?.targets.map(t => {
                    const histVals = result?.historical || [];
                    const currentVal = histVals.length > 0 ? Math.abs(histVals[histVals.length - 1].values[t] || 0) : 0;
                    const fcMax = Math.max(...(result?.forecast?.values || []).map(v => Math.abs(v[t] || 0)));
                    const color = TARGET_COLORS[t] || '#00ffe1';
                    return (
                      <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span style={{ color }}>{TARGET_LABELS[t] || t}</span>
                        <span>
                          <span style={{ color: 'rgba(230,247,255,0.5)' }}>当前 </span>
                          <span style={{ color: '#e6f7ff' }}>{currentVal.toFixed(2)} mm</span>
                          <span style={{ color: 'rgba(230,247,255,0.5)' }}> | 预测最大 </span>
                          <span style={{ color: fcMax >= DANGER_DEV ? '#ff4d4f' : fcMax >= WARN_DEV ? '#ff7a45' : '#95de64', fontWeight: 'bold' }}>
                            {fcMax.toFixed(2)} mm
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 6. 原始数据 (可折叠) */}
          <div>
            <button type="button" onClick={() => setShowRawData(s => !s)} style={{
              fontSize: 12, padding: '5px 12px', background: 'transparent',
              border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(230,247,255,0.6)',
              borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className={`fas fa-chevron-${showRawData ? 'down' : 'right'}`} style={{ fontSize: 10 }} />
              原始数据
            </button>
            {showRawData && result?.forecast && (
              <div style={{
                marginTop: 6, padding: 10, background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4,
              }}>
                <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginBottom: 6 }}>
                  预测未来 {result.forecast.dates.length} 步 ({result.forecast.dates.length * STEP_MINUTES} 分钟)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0,255,255,0.2)' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', color: 'rgba(230,247,255,0.5)' }}>时刻</th>
                        {result.forecast.targets.map(t => (
                          <th key={t} style={{ padding: '4px 8px', textAlign: 'right', color: TARGET_COLORS[t] || '#00ffe1' }}>
                            {TARGET_LABELS[t] || t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.forecast!.dates.map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                          <td style={{ padding: '4px 8px', color: 'rgba(230,247,255,0.6)' }}>{d.slice(5, 16)}</td>
                          {result.forecast!.targets.map(t => (
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

        </div>
      )}
    </div>
  );
};

export default TBMAIPrediction;
