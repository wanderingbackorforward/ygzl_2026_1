import React, { useState, useEffect } from 'react';
import { useTemperature } from '../../contexts/TemperatureContext';
import { fetchTemperaturePrediction, fetchPredictionHistory, fetchDLStatus } from '../../utils/apiClient';

// ===== 类型定义 =====
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

// ===== 阈值常量 =====
const WATCH_TEMP = 50;   // 关注阈值 (°C)
const WARN_TEMP = 60;    // 预警阈值 (°C)
const DANGER_TEMP = 80;  // 危险阈值 (°C)

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
    advice: '温度正常,无需采取措施。',
  },
  watch: {
    color: '#faad14',
    bg: 'rgba(250, 173, 20, 0.12)',
    icon: 'fa-eye',
    label: '关注',
    advice: '温度接近预警值,建议持续观察。',
  },
  warn: {
    color: '#ff7a45',
    bg: 'rgba(255, 122, 69, 0.12)',
    icon: 'fa-exclamation-triangle',
    label: '预警',
    advice: '温度超过预警值,建议排查热源。',
  },
  danger: {
    color: '#ff4d4f',
    bg: 'rgba(255, 77, 79, 0.12)',
    icon: 'fa-times-circle',
    label: '危险',
    advice: '温度超过危险值,建议立即启动降温措施。',
  },
};

// ===== 辅助函数 =====
function getSafetyLevel(maxTemp: number): SafetyLevel {
  if (maxTemp >= DANGER_TEMP) return 'danger';
  if (maxTemp >= WARN_TEMP) return 'warn';
  if (maxTemp >= WATCH_TEMP) return 'watch';
  return 'safe';
}

function getTrend(forecast: number[]): { direction: 'up' | 'down' | 'stable'; change: number } {
  if (forecast.length < 2) return { direction: 'stable', change: 0 };
  const change = forecast[forecast.length - 1] - forecast[0];
  if (change > 0.5) return { direction: 'up', change };
  if (change < -0.5) return { direction: 'down', change };
  return { direction: 'stable', change };
}

function getExceedanceEstimate(
  forecast: number[],
  currentTemp: number,
  maxForecastTemp: number,
): { text: string; level: 'none' | 'warn' | 'danger' } {
  // 优先报告危险阈值
  if (maxForecastTemp >= DANGER_TEMP) {
    if (currentTemp >= DANGER_TEMP) {
      return { text: '已超过危险值', level: 'danger' };
    }
    for (let i = 0; i < forecast.length; i++) {
      if (forecast[i] >= DANGER_TEMP) {
        return { text: `预计 ${i + 1} 天后达到危险值`, level: 'danger' };
      }
    }
  }
  // 其次报告预警阈值
  if (maxForecastTemp >= WARN_TEMP) {
    if (currentTemp >= WARN_TEMP) {
      return { text: '已超过预警值', level: 'warn' };
    }
    for (let i = 0; i < forecast.length; i++) {
      if (forecast[i] >= WARN_TEMP) {
        return { text: `预计 ${i + 1} 天后达到预警值`, level: 'warn' };
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
    trend.direction === 'up' ? '呈上升趋势' :
    trend.direction === 'down' ? '呈下降趋势' : '保持稳定';
  switch (level) {
    case 'safe':
      return '温度在安全范围内';
    case 'watch':
      return `温度${trendText},接近预警值`;
    case 'warn':
    case 'danger':
      return `温度${trendText},${exceedance.text}`;
  }
}

// ===== 组件 =====
const TemperatureAIPrediction: React.FC<{ cardId: string }> = () => {
  const { selectedSensorId } = useTemperature();
  const [steps, setSteps] = useState(2);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
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

  // ===== 分析预测结果 =====
  let analysis: {
    level: SafetyLevel;
    conclusion: string;
    currentTemp: number;
    trend: { direction: 'up' | 'down' | 'stable'; change: number };
    exceedance: { text: string; level: 'none' | 'warn' | 'danger' };
    maxForecast: number;
  } | null = null;

  if (result?.success && result.forecast && result.forecast.values.length > 0) {
    const forecast = result.forecast.values;
    const maxForecast = Math.max(...forecast);
    const level = getSafetyLevel(maxForecast);
    const trend = getTrend(forecast);
    const currentTemp =
      result.historical && result.historical.length > 0
        ? result.historical[result.historical.length - 1].value
        : forecast[0];
    const exceedance = getExceedanceEstimate(forecast, currentTemp, maxForecast);
    const conclusion = buildConclusion(level, trend, exceedance);
    analysis = { level, conclusion, currentTemp, trend, exceedance, maxForecast };
  }

  // ===== 渲染简化趋势图 =====
  const renderChart = () => {
    if (!result?.success || !result.forecast || !result.historical) return null;
    const histAll = result.historical;
    const fc = result.forecast;
    // 只取最近 10 个历史点,避免图表过于拥挤
    const hist = histAll.slice(-10);
    const histVals = hist.map(h => h.value);
    const fcVals = fc.values;
    // 预测线与历史线连接: 预测第一个点 = 历史最后一个点
    const connectedFc = histVals.length > 0 ? [histVals[histVals.length - 1], ...fcVals] : fcVals;

    const W = 380, H = 200, PL = 46, PR = 16, PT = 16, PB = 32;
    const iw = W - PL - PR, ih = H - PT - PB;

    // Y 轴范围: 包含数据 + 阈值线
    const allVals = [...histVals, ...fcVals, WARN_TEMP, DANGER_TEMP];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;
    const pad = range * 0.1;
    const yMin = minV - pad;
    const yMax = maxV + pad;

    const yScale = (v: number) => PT + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const totalPoints = histVals.length + connectedFc.length - 1;
    const xScale = (i: number) => PL + (totalPoints <= 1 ? iw / 2 : (i / (totalPoints - 1)) * iw);

    const toLine = (arr: number[], offset: number) =>
      arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i + offset).toFixed(2)} ${yScale(v).toFixed(2)}`).join(' ');

    const histLine = toLine(histVals, 0);
    const fcLine = toLine(connectedFc, histVals.length - 1);
    const splitX = xScale(histVals.length - 1);

    // Y 轴刻度
    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
      const t = i / yTickCount;
      return { y: yScale(yMin + (yMax - yMin) * t), label: (yMin + (yMax - yMin) * t).toFixed(1) };
    });

    // X 轴标签 (历史最后一个 + 预测各点)
    const xLabels: { x: number; label: string }[] = [];
    if (histVals.length > 0) {
      xLabels.push({ x: xScale(0), label: hist[0].date.slice(5) });
      xLabels.push({ x: splitX, label: hist[hist.length - 1].date.slice(5) });
    }
    fc.dates.forEach((d, i) => {
      xLabels.push({ x: xScale(histVals.length + i), label: d.slice(5) });
    });
    // 去重并控制数量
    const filteredXLabels = xLabels.filter((item, idx, self) =>
      idx === 0 || Math.abs(item.x - self[idx - 1].x) > 50
    );

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200, display: 'block' }}>
        {/* Y 轴网格 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
            <text x={PL - 6} y={t.y + 3} fontSize="9" fill="rgba(230,247,255,0.45)" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {/* 阈值线 - 预警 */}
        <line x1={PL} y1={yScale(WARN_TEMP)} x2={W - PR} y2={yScale(WARN_TEMP)} stroke="#ff7a45" strokeWidth="1" strokeDasharray="5 3" opacity="0.6" />
        <text x={W - PR} y={yScale(WARN_TEMP) - 4} fontSize="9" fill="#ff7a45" textAnchor="end">预警线 {WARN_TEMP}°C</text>
        {/* 阈值线 - 危险 */}
        <line x1={PL} y1={yScale(DANGER_TEMP)} x2={W - PR} y2={yScale(DANGER_TEMP)} stroke="#ff4d4f" strokeWidth="1" strokeDasharray="5 3" opacity="0.6" />
        <text x={W - PR} y={yScale(DANGER_TEMP) - 4} fontSize="9" fill="#ff4d4f" textAnchor="end">危险线 {DANGER_TEMP}°C</text>
        {/* 分割线 (历史/预测) */}
        <line x1={splitX} y1={PT} x2={splitX} y2={H - PB} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
        {/* 实测线 */}
        <path d={histLine} fill="none" stroke="rgba(0,255,225,0.5)" strokeWidth="1.5" />
        {/* 预测线 */}
        <path d={fcLine} fill="none" stroke="#00ffe1" strokeWidth="2.2" />
        {/* 实测点 */}
        {histVals.map((v, i) => (
          <circle key={`h${i}`} cx={xScale(i)} cy={yScale(v)} r="1.5" fill="rgba(0,255,225,0.5)" />
        ))}
        {/* 预测点 */}
        {connectedFc.map((v, i) => (
          <circle key={`f${i}`} cx={xScale(histVals.length - 1 + i)} cy={yScale(v)} r="2.5" fill="#00ffe1" />
        ))}
        {/* X 轴标签 */}
        {filteredXLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PB + 14} fontSize="9" fill="rgba(230,247,255,0.45)" textAnchor="middle">{l.label}</text>
        ))}
        {/* 图例 */}
        <g transform={`translate(${PL}, ${H - 4})`}>
          <line x1="0" y1="-2" x2="14" y2="-2" stroke="rgba(0,255,225,0.5)" strokeWidth="1.5" />
          <text x="18" y="1" fontSize="9" fill="rgba(230,247,255,0.5)">实测</text>
          <line x1="56" y1="-2" x2="70" y2="-2" stroke="#00ffe1" strokeWidth="2.2" />
          <text x="74" y="1" fontSize="9" fill="rgba(230,247,255,0.5)">预测</text>
          <line x1="112" y1="-2" x2="126" y2="-2" stroke="#ff7a45" strokeWidth="1" strokeDasharray="3 2" />
          <text x="130" y="1" fontSize="9" fill="rgba(230,247,255,0.5)">阈值</text>
        </g>
      </svg>
    );
  };

  const levelCfg = analysis ? LEVEL_CONFIG[analysis.level] : null;

  return (
    <div style={{
      padding: 16, background: 'rgba(0, 20, 40, 0.4)',
      border: '1px solid rgba(0, 255, 255, 0.25)', borderRadius: 8, color: '#e6f7ff',
    }}>
      {/* ===== 标题栏 ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          <i className="fas fa-temperature-high" style={{ color: '#00ffe1', marginRight: 8 }} />
          温度预测
          <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8 }}>
            基于历史数据,预测未来温度变化
          </span>
        </h3>
        {tempReady && tempMae != null && (
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: 'rgba(82, 196, 26, 0.15)', border: '1px solid rgba(82, 196, 26, 0.4)', color: '#95de64',
          }}>
            <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
            预测可信度: {tempMae < 0.5 ? '高' : tempMae < 1.0 ? '中' : '低'}
          </div>
        )}
      </div>

      {/* ===== 未就绪提示 ===== */}
      {!tempReady && (
        <div style={{ fontSize: 12, color: 'rgba(255, 169, 64, 0.9)', marginBottom: 12 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />
          预测功能尚未启用,请联系技术团队。
        </div>
      )}

      {/* ===== 控制面板 ===== */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12 }}>
          传感器: <strong style={{ color: '#00ffe1' }}>{selectedSensorId || '未选择'}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>预测时长:</span>
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
          {loading ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />预测中...</> : <><i className="fas fa-play" style={{ marginRight: 6 }} />开始预测</>}
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
      {analysis && levelCfg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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
            {/* 当前温度 */}
            <div style={{
              padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(0,255,255,0.15)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>当前温度</div>
              <div style={{ fontSize: 20, color: '#00ffe1', fontWeight: 'bold' }}>
                {analysis.currentTemp.toFixed(1)}<span style={{ fontSize: 12, marginLeft: 2 }}>°C</span>
              </div>
            </div>
            {/* 温度趋势 */}
            <div style={{
              padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(0,255,255,0.15)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>温度趋势</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                {analysis.trend.direction === 'up' && (
                  <span style={{ color: '#ff7a45' }}>
                    <i className="fas fa-arrow-trend-up" /> 上升
                  </span>
                )}
                {analysis.trend.direction === 'down' && (
                  <span style={{ color: '#52c41a' }}>
                    <i className="fas fa-arrow-trend-down" /> 下降
                  </span>
                )}
                {analysis.trend.direction === 'stable' && (
                  <span style={{ color: '#faad14' }}>
                    <i className="fas fa-minus" /> 稳定
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.4)', marginTop: 2 }}>
                {analysis.trend.change > 0 ? '+' : ''}{analysis.trend.change.toFixed(1)}°C
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

          {/* 3. 简化趋势图 */}
          <div style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.15)',
            borderRadius: 6, padding: 8,
          }}>
            {renderChart()}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>模型类型: </span>{result?.model_info?.model_type || '-'}</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>传感器数量: </span>{result?.model_info?.n_sensors || '-'}</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>预测步长: </span>{result?.model_info?.pred_len || '-'} 天</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>平均误差: </span>{tempMae != null ? `${tempMae.toFixed(4)} °C` : '-'}</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>预测最大值: </span>{analysis.maxForecast.toFixed(2)} °C</div>
                  <div><span style={{ color: 'rgba(230,247,255,0.5)' }}>关注阈值: </span>{WATCH_TEMP} °C / 预警 {WARN_TEMP} °C / 危险 {DANGER_TEMP} °C</div>
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
                {/* 预测数值表 */}
                <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginBottom: 6 }}>
                  预测未来 {result.forecast.values.length} 天
                </div>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,255,255,0.2)' }}>
                      <th style={{ padding: '4px 8px', textAlign: 'left', color: 'rgba(230,247,255,0.5)' }}>日期</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', color: 'rgba(230,247,255,0.5)' }}>预测温度</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', color: 'rgba(230,247,255,0.5)' }}>下限</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', color: 'rgba(230,247,255,0.5)' }}>上限</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.forecast.dates.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                        <td style={{ padding: '4px 8px', color: 'rgba(230,247,255,0.6)' }}>{d}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#95de64', fontWeight: 'bold' }}>
                          {result.forecast!.values[i].toFixed(2)} °C
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: 'rgba(230,247,255,0.4)' }}>
                          {result.forecast!.lower_bound[i].toFixed(2)}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: 'rgba(230,247,255,0.4)' }}>
                          {result.forecast!.upper_bound[i].toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 历史预测记录 */}
                {history.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <button type="button" onClick={() => setShowHistory(s => !s)} style={{
                      fontSize: 11, padding: '3px 8px', background: 'transparent',
                      border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(230,247,255,0.5)',
                      borderRadius: 3, cursor: 'pointer',
                    }}>
                      {showHistory ? '收起' : '查看'}历史预测记录 ({history.length})
                    </button>
                    {showHistory && (
                      <div style={{ marginTop: 6, fontSize: 11 }}>
                        {history.map((h, i) => (
                          <div key={i} style={{ padding: 4, borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                            <span style={{ color: 'rgba(230,247,255,0.5)' }}>{h.prediction_date}</span>:{' '}
                            {(h.forecast_values as number[]).map(v => v.toFixed(2)).join(', ')} °C
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default TemperatureAIPrediction;
