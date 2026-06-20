import React, { useState, useEffect } from 'react';
import { useCracks } from '../../../contexts/CracksContext';
import { fetchCrackPrediction, fetchPredictionHistory, fetchDLStatus } from '../../../utils/apiClient';

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

// ── 阈值配置 (mm) ──
const WARN_THRESHOLD = 0.5;
const ALARM_THRESHOLD = 1.0;
const STEP_HOURS = 6; // 每步 6 小时

// ── 状态判定 ──
type SafetyLevel = 'safe' | 'watch' | 'warn' | 'alarm';

function getSafetyLevel(maxForecast: number, currentValue: number): SafetyLevel {
  const peak = Math.max(maxForecast, currentValue);
  if (peak >= ALARM_THRESHOLD) return 'alarm';
  if (peak >= WARN_THRESHOLD) return 'warn';
  if (peak >= WARN_THRESHOLD * 0.7) return 'watch';
  return 'safe';
}

const LEVEL_CONFIG: Record<SafetyLevel, { label: string; color: string; bg: string; border: string; icon: string }> = {
  safe:   { label: '安全',   color: '#52c41a', bg: 'rgba(82,196,26,0.1)',  border: 'rgba(82,196,26,0.4)',  icon: 'check-circle' },
  watch:  { label: '关注',   color: '#faad14', bg: 'rgba(250,173,20,0.1)', border: 'rgba(250,173,20,0.4)', icon: 'eye' },
  warn:   { label: '预警',   color: '#fa8c16', bg: 'rgba(250,140,22,0.1)', border: 'rgba(250,140,22,0.4)', icon: 'exclamation-triangle' },
  alarm:  { label: '危险',   color: '#f5222d', bg: 'rgba(245,34,45,0.1)',  border: 'rgba(245,34,45,0.4)',  icon: 'times-circle' },
};

// ── 生成一句话结论 ──
function buildConclusion(level: SafetyLevel, currentValue: number, maxForecast: number, daysToExceed: number | null): string {
  const trendDir = maxForecast > currentValue ? '扩大' : maxForecast < currentValue ? '收敛' : '稳定';
  switch (level) {
    case 'safe':
      return `裂缝趋势${trendDir}，未来预测值在安全范围内，暂无超限风险。`;
    case 'watch':
      return `裂缝呈${trendDir}趋势，预测值接近关注阈值，建议持续观察。`;
    case 'warn':
      return daysToExceed != null
        ? `裂缝持续${trendDir}，预计约 ${daysToExceed} 天后达到预警值，建议加密监测。`
        : `裂缝已达预警水平，建议加密监测频率。`;
    case 'alarm':
      return daysToExceed != null
        ? `裂缝快速${trendDir}，预计约 ${daysToExceed} 天后超过危险阈值，需立即处置。`
        : `裂缝已超过危险阈值，需立即采取处置措施。`;
  }
}

// ── 生成处置建议 ──
function buildAdvice(level: SafetyLevel): string {
  switch (level) {
    case 'safe':   return '当前无需额外措施，保持常规监测频率即可。';
    case 'watch':  return '建议每日查看数据变化，关注趋势是否加速。';
    case 'warn':   return '建议加密监测频率至每 2 小时一次，排查施工影响因素。';
    case 'alarm':  return '立即启动应急响应：暂停相关施工、现场巡查、上报项目负责人。';
  }
}

// ── 计算超限天数 ──
function calcDaysToExceed(forecast: number[], threshold: number): number | null {
  for (let i = 0; i < forecast.length; i++) {
    if (forecast[i] >= threshold) {
      return Math.round((i * STEP_HOURS / 24) * 10) / 10;
    }
  }
  return null;
}

const CrackAIPrediction: React.FC<{ cardId?: string }> = () => {
  const { points, selectedPointId, selectPoint } = useCracks();
  const [predLen, setPredLen] = useState(10);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const crackReady = dlStatus?.models?.crack?.weights_loaded;
  const crackMae = dlStatus?.models?.crack?.metrics?.val_mae_real;

  // ── 计算安全等级和结论 ──
  const currentValue = result?.meta?.last_value ?? result?.historical?.slice(-1)[0]?.value ?? 0;
  const maxForecast = result?.forecast?.values ? Math.max(...result.forecast.values) : 0;
  const level = result?.success ? getSafetyLevel(maxForecast, currentValue) : 'safe';
  const levelCfg = LEVEL_CONFIG[level];
  const daysToWarn = result?.forecast?.values ? calcDaysToExceed(result.forecast.values, WARN_THRESHOLD) : null;
  const daysToAlarm = result?.forecast?.values ? calcDaysToExceed(result.forecast.values, ALARM_THRESHOLD) : null;
  const daysToExceed = daysToWarn ?? daysToAlarm;
  const conclusion = result?.success ? buildConclusion(level, currentValue, maxForecast, daysToExceed) : '';
  const advice = buildAdvice(level);

  // ── 简化趋势图 (带阈值线) ──
  const renderSimpleChart = () => {
    if (!result?.success || !result.historical || !result.forecast) return null;
    const W = 720, H = 180, PL = 50, PR = 20, PT = 16, PB = 28;
    const iw = W - PL - PR, ih = H - PT - PB;

    const histVals = result.historical.map(h => h.value);
    const fcVals = result.forecast.values;
    const startV = histVals.length > 0 ? histVals[histVals.length - 1] : 0;
    const fcValsConnected = [startV, ...fcVals];
    const allVals = [...histVals, ...fcValsConnected, WARN_THRESHOLD, ALARM_THRESHOLD];
    const minV = Math.min(...allVals) * 0.9;
    const maxV = Math.max(...allVals) * 1.1;
    const range = maxV - minV || 1;
    const yScale = (v: number) => PT + ih - ((v - minV) / range) * ih;
    const totalN = histVals.length + fcValsConnected.length - 1;
    const xScale = (i: number) => PL + (totalN === 0 ? 0 : (i / totalN) * iw);

    const histLine = histVals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(' ');
    const fcLine = fcValsConnected.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(histVals.length - 1 + i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(' ');
    const splitX = xScale(histVals.length - 1);

    // X 轴标签: 头/中/尾
    const xLabels = [
      { x: xScale(0), label: result.historical[0]?.date?.slice(5, 10) || '' },
      { x: splitX, label: '现在' },
      { x: xScale(totalN), label: result.forecast.dates[result.forecast.dates.length - 1]?.slice(5, 10) || '' },
    ];

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, display: 'block' }}>
        {/* 阈值区域 */}
        <rect x={PL} y={yScale(ALARM_THRESHOLD)} width={iw} height={yScale(minV) - yScale(ALARM_THRESHOLD)} fill="rgba(245,34,45,0.06)" />
        <rect x={PL} y={yScale(WARN_THRESHOLD)} width={iw} height={yScale(ALARM_THRESHOLD) - yScale(WARN_THRESHOLD)} fill="rgba(250,140,22,0.06)" />
        {/* 阈值线 */}
        <line x1={PL} y1={yScale(WARN_THRESHOLD)} x2={W - PR} y2={yScale(WARN_THRESHOLD)} stroke="rgba(250,140,22,0.5)" strokeDasharray="4 3" strokeWidth="1" />
        <text x={W - PR - 4} y={yScale(WARN_THRESHOLD) - 4} fontSize="9" fill="rgba(250,140,22,0.7)" textAnchor="end">预警值 {WARN_THRESHOLD}mm</text>
        <line x1={PL} y1={yScale(ALARM_THRESHOLD)} x2={W - PR} y2={yScale(ALARM_THRESHOLD)} stroke="rgba(245,34,45,0.5)" strokeDasharray="4 3" strokeWidth="1" />
        <text x={W - PR - 4} y={yScale(ALARM_THRESHOLD) - 4} fontSize="9" fill="rgba(245,34,45,0.7)" textAnchor="end">危险值 {ALARM_THRESHOLD}mm</text>
        {/* 分界线 */}
        <line x1={splitX} y1={PT} x2={splitX} y2={H - PB} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
        {/* 历史线 */}
        <path d={histLine} fill="none" stroke="rgba(0,255,255,0.8)" strokeWidth="1.5" />
        {/* 预测线 */}
        <path d={fcLine} fill="none" stroke={levelCfg.color} strokeWidth="2" />
        {/* 预测终点 */}
        <circle cx={xScale(totalN)} cy={yScale(fcVals[fcVals.length - 1])} r="4" fill={levelCfg.color} />
        {/* X 轴标签 */}
        {xLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 8} fontSize="9" fill="rgba(230,247,255,0.6)" textAnchor="middle">{t.label}</text>
        ))}
        {/* 图例 */}
        <g transform={`translate(${PL}, ${H - 2})`}>
          <rect x="0" y="-7" width="10" height="2" fill="rgba(0,255,255,0.8)" />
          <text x="14" y="-4" fontSize="9" fill="rgba(230,247,255,0.6)">实测</text>
          <rect x="50" y="-7" width="10" height="2" fill={levelCfg.color} />
          <text x="64" y="-4" fontSize="9" fill="rgba(230,247,255,0.6)">预测</text>
        </g>
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
      {/* ── 标题栏 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-microchip" style={{ color: '#00ffe1', marginRight: 8 }} />
          裂缝预测
          <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
            基于 31 个监测点的历史趋势,预测未来裂缝变化
          </span>
        </h3>
        {crackReady && crackMae != null && (
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'rgba(82, 196, 26, 0.15)', border: '1px solid rgba(82, 196, 26, 0.4)', color: '#95de64',
          }}>
            <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
            预测可信度: {crackMae < 0.5 ? '高' : crackMae < 1.0 ? '中' : '低'}
          </div>
        )}
      </div>

      {!crackReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 12 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          预测功能尚未启用,请联系技术团队。
        </div>
      )}

      {/* ── 操作栏 ── */}
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
          <span style={{ fontSize: 12 }}>预测时长:</span>
          <select value={predLen} onChange={e => setPredLen(Number(e.target.value))} style={{
            padding: '4px 8px', background: 'rgba(0,0,0,0.4)', color: '#e6f7ff',
            border: '1px solid rgba(0,255,255,0.3)', borderRadius: 4, fontSize: 12,
          }}>
            <option value={5}>1.25 天</option>
            <option value={10}>2.5 天</option>
            <option value={20}>5 天</option>
            <option value={30}>7.5 天</option>
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
            : <><i className="fas fa-play" style={{ marginRight: 6 }} />开始预测</>}
        </button>
      </div>

      {result && !result.success && (
        <div style={{ fontSize: 12, color: '#ff7a7a', padding: 8, background: 'rgba(255, 122, 122, 0.1)', borderRadius: 4 }}>
          <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
          预测失败: {result.message}
        </div>
      )}

      {/* ── 结果区: 结论先行 ── */}
      {result && result.success && (
        <div>
          {/* 状态结论卡 */}
          <div style={{
            padding: '12px 16px',
            background: levelCfg.bg,
            border: `1px solid ${levelCfg.border}`,
            borderRadius: 6,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: levelCfg.bg, border: `2px solid ${levelCfg.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className={`fas fa-${levelCfg.icon}`} style={{ color: levelCfg.color, fontSize: 18 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: levelCfg.color, marginBottom: 4 }}>
                {levelCfg.label}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                {conclusion}
              </div>
            </div>
          </div>

          {/* 三个关键指标卡 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(0,255,255,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>当前状态</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: levelCfg.color }}>{levelCfg.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.4)' }}>实测 {currentValue.toFixed(3)} mm</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(0,255,255,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>变化趋势</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: maxForecast > currentValue ? '#fa8c16' : '#52c41a' }}>
                {maxForecast > currentValue ? '扩大' : maxForecast < currentValue ? '收敛' : '稳定'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.4)' }}>
                {result.meta?.total_change != null ? `累计变化 ${result.meta.total_change.toFixed(3)} mm` : ''}
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(0,255,255,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>超限预计</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: daysToExceed != null ? '#f5222d' : '#52c41a' }}>
                {daysToExceed != null ? `约 ${daysToExceed} 天` : '暂无风险'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.4)' }}>
                {daysToExceed != null ? `预警值 ${WARN_THRESHOLD} mm` : `预测峰值 ${maxForecast.toFixed(3)} mm`}
              </div>
            </div>
          </div>

          {/* 简化趋势图 */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 4, padding: 4, marginBottom: 12 }}>
            {renderSimpleChart()}
          </div>

          {/* 处置建议 */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(0, 255, 255, 0.04)',
            border: '1px solid rgba(0, 255, 255, 0.15)',
            borderRadius: 6,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}>
            <i className="fas fa-clipboard-list" style={{ color: '#00ffe1', fontSize: 14, marginTop: 2, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 12, color: 'rgba(230,247,255,0.5)' }}>处置建议: </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{advice}</span>
            </div>
          </div>

          {/* 技术详情 (可折叠) */}
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={() => setShowTechDetails(s => !s)} style={{
              fontSize: 11, padding: '4px 10px', background: 'transparent',
              border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(0,255,255,0.7)', borderRadius: 3, cursor: 'pointer',
            }}>
              <i className={`fas fa-${showTechDetails ? 'chevron-down' : 'chevron-right'}`} style={{ marginRight: 4 }} />
              技术详情
            </button>
            {showTechDetails && result.meta && (
              <div style={{
                marginTop: 6, padding: 10,
                background: 'rgba(0,0,0,0.2)', borderRadius: 4,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6,
              }}>
                {result.meta.trend_type && (
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: 'rgba(230,247,255,0.4)' }}>趋势类型: </span>
                    <strong style={{ color: '#95de64' }}>{result.meta.trend_type}</strong>
                  </div>
                )}
                {result.meta.trend_slope != null && (
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: 'rgba(230,247,255,0.4)' }}>变化速率: </span>
                    <strong style={{ color: '#95de64' }}>{Number(result.meta.trend_slope).toFixed(6)} mm/步</strong>
                  </div>
                )}
                {result.meta.r_value != null && (
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: 'rgba(230,247,255,0.4)' }}>趋势可靠性: </span>
                    <strong style={{ color: '#95de64' }}>{Number(result.meta.r_value) > 0.8 ? '高' : Number(result.meta.r_value) > 0.5 ? '中' : '低'}</strong>
                  </div>
                )}
                {result.meta.location && (
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: 'rgba(230,247,255,0.4)' }}>位置: </span>
                    <strong style={{ color: '#95de64' }}>{result.meta.location}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 原始数据 (可折叠) */}
          <div>
            <button type="button" onClick={() => setShowRawData(s => !s)} style={{
              fontSize: 11, padding: '4px 10px', background: 'transparent',
              border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(0,255,255,0.7)', borderRadius: 3, cursor: 'pointer',
            }}>
              <i className={`fas fa-${showRawData ? 'chevron-down' : 'chevron-right'}`} style={{ marginRight: 4 }} />
              原始数据
            </button>
            {showRawData && result.forecast && (
              <div style={{ marginTop: 6, maxHeight: 160, overflowY: 'auto', fontSize: 11 }}>
                <div style={{ color: 'rgba(82,196,26,0.7)', marginBottom: 4 }}>
                  预测 {result.forecast.values.length} 个数据点 ({(result.forecast.values.length * STEP_HOURS / 24).toFixed(1)} 天):
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {result.forecast.dates.map((d, i) => (
                    <div key={i} style={{
                      padding: '3px 6px', background: 'rgba(82,196,26,0.08)',
                      border: '1px solid rgba(82,196,26,0.2)', borderRadius: 3, minWidth: 70,
                    }}>
                      <div style={{ fontSize: 9, color: 'rgba(230,247,255,0.5)' }}>{d.slice(5, 16).replace('T', ' ')}</div>
                      <div style={{ fontSize: 12, color: '#95de64', fontWeight: 'bold' }}>{result.forecast!.values[i].toFixed(3)}</div>
                      <div style={{ fontSize: 8, color: 'rgba(230,247,255,0.4)' }}>
                        [{Number(result.forecast!.lower_bound[i]).toFixed(3)}, {Number(result.forecast!.upper_bound[i]).toFixed(3)}]
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrackAIPrediction;
