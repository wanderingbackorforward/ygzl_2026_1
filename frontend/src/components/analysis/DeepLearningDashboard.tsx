import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PredictionChart } from './PredictionChart';
import type { PredictionResult } from '../../types/analysis';
import {
  fetchInformerPrediction,
  fetchSTGCNPrediction,
  fetchPINNPrediction,
  fetchEnsemblePrediction,
  fetchDLStatus,
} from '../../utils/apiClient';

type ModelType = 'informer' | 'stgcn' | 'pinn' | 'ensemble';

const MODEL_INFO: Record<ModelType, { label: string; desc: string; icon: string }> = {
  informer: { label: '智能预测', desc: '适合长期趋势分析', icon: 'brain' },
  stgcn: { label: '空间关联预测', desc: '考虑点位间相互影响', icon: 'project-diagram' },
  pinn: { label: '物理模型预测', desc: '结合物理规律,更可靠', icon: 'atom' },
  ensemble: { label: '综合预测', desc: '融合多种模型,最稳健', icon: 'layer-group' },
};

// 5 类监测分组 (8 个模型, 去掉 AI 前缀和英文缩写)
const MONITOR_GROUPS: {
  group: string;
  key: string;
  models: { name: string; label: string; desc: string; page: string }[];
}[] = [
  {
    group: '地表沉降',
    key: 'settlement',
    models: [
      { name: 'informer', label: '智能预测', desc: '适合长期趋势分析', page: '当前页面' },
      { name: 'stgcn', label: '空间关联预测', desc: '考虑点位间相互影响', page: '当前页面' },
      { name: 'pinn', label: '物理模型预测', desc: '结合物理规律,更可靠', page: '当前页面' },
    ],
  },
  {
    group: '温度监测',
    key: 'temperature',
    models: [
      { name: 'temperature', label: '温度预测', desc: '基于 251 个传感器历史数据', page: '温度监测页' },
    ],
  },
  {
    group: '振动监测',
    key: 'vibration',
    models: [
      { name: 'vibration', label: '波形预测', desc: '预测振动波形和统计特征', page: '振动监测页' },
      { name: 'vibration_freq', label: '振动诊断', desc: '自动识别异常频谱模式', page: '振动监测页' },
    ],
  },
  {
    group: '裂缝监测',
    key: 'crack',
    models: [
      { name: 'crack', label: '裂缝预测', desc: '预测未来 2.5 天裂缝变化', page: '裂缝监测页' },
    ],
  },
  {
    group: '盾构掘进',
    key: 'tbm',
    models: [
      { name: 'tbm', label: '盾构姿态预测', desc: '预测未来 20 分钟姿态偏差', page: '盾构轨迹页' },
    ],
  },
];

// 沉降阈值 (mm, 负值表示下沉)
const SETTLEMENT_WARNING = -25; // 预警阈值
const SETTLEMENT_DANGER = -30;  // 危险阈值
const SETTLEMENT_EXTREME = -35; // 极限阈值

// 风险等级
type RiskLevel = 'safe' | 'watch' | 'warning' | 'danger' | 'offline' | 'nodata';

const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
  icon: string;
}> = {
  safe:     { label: '正常',   dotColor: '#52c41a', textColor: '#52c41a', bgColor: 'rgba(82, 196, 26, 0.12)',  icon: 'check-circle' },
  watch:    { label: '需关注', dotColor: '#faad14', textColor: '#faad14', bgColor: 'rgba(250, 173, 20, 0.12)', icon: 'exclamation-circle' },
  warning:  { label: '预警',   dotColor: '#ff4d4f', textColor: '#ff4d4f', bgColor: 'rgba(255, 77, 79, 0.12)',  icon: 'exclamation-triangle' },
  danger:   { label: '危险',   dotColor: '#ff4d4f', textColor: '#ff4d4f', bgColor: 'rgba(255, 77, 79, 0.20)',  icon: 'times-circle' },
  offline:  { label: '未启用', dotColor: '#ff4d4f', textColor: '#ff4d4f', bgColor: 'rgba(255, 77, 79, 0.12)',  icon: 'power-off' },
  nodata:   { label: '无数据', dotColor: '#888888', textColor: '#888888', bgColor: 'rgba(136, 136, 136, 0.12)', icon: 'question-circle' },
};

// 根据预测最小沉降值判断风险等级
function getSettlementLevel(minValue: number): RiskLevel {
  if (minValue >= SETTLEMENT_WARNING) return 'safe';    // >= -25mm 安全
  if (minValue >= SETTLEMENT_DANGER) return 'watch';    // -25 ~ -30mm 需关注
  if (minValue >= SETTLEMENT_EXTREME) return 'warning'; // -30 ~ -35mm 预警
  return 'danger';                                      // < -35mm 危险
}

// 根据风险等级给出处置建议
function getDisposalSuggestion(level: RiskLevel, minVal: number): string {
  switch (level) {
    case 'safe':
      return `当前预测沉降量在安全范围内(最小值 ${minVal.toFixed(1)}mm,预警阈值 ${SETTLEMENT_WARNING}mm)。建议保持常规监测频率(每周1次),继续关注施工进度。`;
    case 'watch':
      return `预测沉降量已接近预警阈值(最小值 ${minVal.toFixed(1)}mm)。建议加密监测频率至每日1次,核查点位附近施工参数,做好预警准备。`;
    case 'warning':
      return `预测沉降量已超过危险阈值(最小值 ${minVal.toFixed(1)}mm)。建议立即排查沉降原因,考虑调整施工参数(如降低掘进速度、加强注浆),通知现场技术人员。`;
    case 'danger':
      return `预测沉降量严重超标(最小值 ${minVal.toFixed(1)}mm)!建议立即停工检查,启动应急预案,组织设计、施工、监理单位现场会勘,必要时采取地基加固措施。`;
    default:
      return '';
  }
}

export const DeepLearningDashboard: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<ModelType>('informer');
  const [selectedPoint, setSelectedPoint] = useState('S1');
  const [steps, setSteps] = useState(8);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [stgcnData, setStgcnData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelMeta, setModelMeta] = useState<any>(null);
  const [dlStatus, setDlStatus] = useState<any>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // 加载时查询训练模型状态
  useEffect(() => {
    fetchDLStatus()
      .then(s => setDlStatus(s))
      .catch(() => setDlStatus({ success: false, models: {} }));
  }, []);

  const pointIds = Array.from({ length: 25 }, (_, i) => `S${i + 1}`);

  const runPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setStgcnData(null);
    setModelMeta(null);

    try {
      if (selectedModel === 'stgcn') {
        const data = await fetchSTGCNPrediction(steps);
        setStgcnData(data);
        const pointData = data.predictions?.[selectedPoint];
        if (pointData) {
          setPrediction({
            success: true,
            point_id: selectedPoint,
            selected_model: 'stgcn',
            model_selection_info: {
              best_score: 0,
              metric: 'rmse',
              data_characteristics: { data_size: 0, trend_strength: 0, volatility: 0, seasonality_strength: 0 },
            },
            historical: pointData.historical || [],
            forecast: pointData.forecast,
          });
        }
        setModelMeta(data.spatial_info);
      } else if (selectedModel === 'informer') {
        const data = await fetchInformerPrediction(selectedPoint, steps);
        setPrediction(data);
        setModelMeta(data.model_info);
      } else if (selectedModel === 'pinn') {
        const data = await fetchPINNPrediction(selectedPoint, steps);
        setPrediction(data);
      } else if (selectedModel === 'ensemble') {
        const data = await fetchEnsemblePrediction(selectedPoint, steps);
        setPrediction(data);
      }
    } catch (err: any) {
      setError(err.message || '预测失败');
    } finally {
      setLoading(false);
    }
  }, [selectedModel, selectedPoint, steps]);

  // 计算每个模型的状态
  const modelStatuses = useMemo(() => {
    const statuses: Record<string, RiskLevel> = {};
    for (const group of MONITOR_GROUPS) {
      for (const m of group.models) {
        const info = dlStatus?.models?.[m.name];
        const loaded = info?.weights_loaded;
        if (!dlStatus) {
          statuses[m.name] = 'nodata';
        } else if (!loaded) {
          statuses[m.name] = 'offline';
        } else {
          statuses[m.name] = 'safe';
        }
      }
    }
    // 沉降类: 如果有预测结果, 用预测值更新所有已加载沉降模型的状态
    if (prediction?.forecast?.values?.length) {
      const minVal = Math.min(...prediction.forecast.values);
      const level = getSettlementLevel(minVal);
      const settlementGroup = MONITOR_GROUPS.find(g => g.key === 'settlement');
      if (settlementGroup) {
        for (const m of settlementGroup.models) {
          if (statuses[m.name] !== 'offline' && statuses[m.name] !== 'nodata') {
            statuses[m.name] = level;
          }
        }
      }
    }
    return statuses;
  }, [dlStatus, prediction]);

  // 计算每类监测的总体状态 (取该类中最严重的等级)
  const groupStatuses = useMemo(() => {
    const result: Record<string, RiskLevel> = {};
    const priority: Record<RiskLevel, number> = {
      safe: 0, watch: 1, warning: 2, danger: 3, offline: 4, nodata: 5,
    };
    for (const group of MONITOR_GROUPS) {
      const levels = group.models.map(m => modelStatuses[m.name]);
      if (levels.every(l => l === 'nodata')) {
        result[group.key] = 'nodata';
      } else if (levels.every(l => l === 'offline' || l === 'nodata')) {
        result[group.key] = 'offline';
      } else {
        // 在已加载的模型中取最严重的等级
        const activeLevels = levels.filter(l => l !== 'offline' && l !== 'nodata');
        result[group.key] = activeLevels.reduce((worst, l) =>
          priority[l] > priority[worst] ? l : worst, 'safe' as RiskLevel);
      }
    }
    return result;
  }, [modelStatuses]);

  // 统计摘要 (8 个模型)
  const summary = useMemo(() => {
    let safe = 0, watch = 0, warning = 0, offline = 0, nodata = 0;
    for (const group of MONITOR_GROUPS) {
      for (const m of group.models) {
        const s = modelStatuses[m.name];
        if (s === 'safe') safe++;
        else if (s === 'watch') watch++;
        else if (s === 'warning' || s === 'danger') warning++;
        else if (s === 'offline') offline++;
        else nodata++;
      }
    }
    return { safe, watch, warning, offline, nodata, total: 8 };
  }, [modelStatuses]);

  // 当前预测的风险等级和最小值
  const predictionLevel = useMemo(() => {
    if (!prediction?.forecast?.values?.length) return null;
    return getSettlementLevel(Math.min(...prediction.forecast.values));
  }, [prediction]);

  const predictionMinVal = useMemo(() => {
    if (!prediction?.forecast?.values?.length) return null;
    return Math.min(...prediction.forecast.values);
  }, [prediction]);

  // 图表阈值线
  const thresholdLines = [
    { value: SETTLEMENT_WARNING, name: `预警 ${SETTLEMENT_WARNING}mm`, color: '#faad14' },
    { value: SETTLEMENT_DANGER,  name: `危险 ${SETTLEMENT_DANGER}mm`,  color: '#ff4d4f' },
  ];

  return (
    <div style={styles.container}>
      {/* ==================== 预测风险评估面板 ==================== */}
      <div style={styles.riskPanel}>
        <div style={styles.riskPanelHeader}>
          <i className="fas fa-shield-alt" style={{ marginRight: 8, color: '#00ffe1' }} />
          <span style={{ fontWeight: 'bold', fontSize: 16, color: '#fff' }}>预测风险评估</span>
        </div>

        {/* 一行总结 */}
        <div style={styles.riskSummary}>
          共监测 <strong style={{ color: '#fff' }}>{summary.total}</strong> 项指标,
          其中 <strong style={{ color: RISK_CONFIG.safe.textColor }}>{summary.safe}</strong> 项正常、
          <strong style={{ color: RISK_CONFIG.watch.textColor }}>{summary.watch}</strong> 项需关注、
          <strong style={{ color: RISK_CONFIG.warning.textColor }}>{summary.warning}</strong> 项预警
          {summary.offline > 0 && (
            <span style={{ color: RISK_CONFIG.offline.textColor }}>
              、<strong>{summary.offline}</strong> 项未启用
            </span>
          )}
          {summary.nodata > 0 && (
            <span style={{ color: RISK_CONFIG.nodata.textColor }}>
              、<strong>{summary.nodata}</strong> 项无数据
            </span>
          )}
        </div>

        {/* 红绿灯指示器 */}
        <div style={styles.trafficLightRow}>
          {MONITOR_GROUPS.map(group => {
            const level = groupStatuses[group.key] || 'nodata';
            const config = RISK_CONFIG[level];
            const isExpanded = expandedGroup === group.key;
            return (
              <button
                key={group.key}
                style={{
                  ...styles.trafficLightBtn,
                  ...(isExpanded ? styles.trafficLightBtnActive : {}),
                }}
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
              >
                <span style={{ ...styles.dot, backgroundColor: config.dotColor }} />
                <span style={styles.trafficLightLabel}>{group.group}</span>
                <span style={{ ...styles.trafficLightStatus, color: config.textColor }}>
                  {config.label}
                </span>
                <i
                  className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}
                  style={{ fontSize: 9, color: 'rgba(230,247,255,0.4)', marginLeft: 4 }}
                />
              </button>
            );
          })}
        </div>

        {/* 展开的详情 */}
        {expandedGroup && (
          <div style={styles.expandedDetail}>
            {(() => {
              const group = MONITOR_GROUPS.find(g => g.key === expandedGroup)!;
              return (
                <>
                  <div style={styles.expandedTitle}>
                    <i className="fas fa-list-ul" style={{ marginRight: 6, fontSize: 12 }} />
                    {group.group} - 监测详情
                    {group.key === 'settlement' && prediction && predictionMinVal != null && predictionLevel && (
                      <span style={{
                        marginLeft: 12, fontSize: 12,
                        color: RISK_CONFIG[predictionLevel].textColor,
                      }}>
                        当前预测: {selectedPoint} 最小值 {predictionMinVal.toFixed(1)}mm
                        ({RISK_CONFIG[predictionLevel].label})
                      </span>
                    )}
                  </div>
                  <div style={styles.expandedModelList}>
                    {group.models.map(m => {
                      const level = modelStatuses[m.name];
                      const config = RISK_CONFIG[level];
                      return (
                        <div key={m.name} style={styles.expandedModelItem}>
                          <span style={{ ...styles.dot, backgroundColor: config.dotColor }} />
                          <div style={{ flex: 1 }}>
                            <div style={styles.expandedModelName}>{m.label}</div>
                            <div style={styles.expandedModelDesc}>{m.desc}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ ...styles.expandedModelStatus, color: config.textColor }}>
                              {config.label}
                            </div>
                            <div style={styles.expandedModelPage}>{m.page}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ==================== 沉降预测分析 ==================== */}
      <div style={styles.sectionHeader}>
        <i className="fas fa-chart-line" style={{ marginRight: 8, color: '#4a9eff' }} />
        <span style={{ fontWeight: 'bold', fontSize: 15, color: '#fff' }}>沉降预测分析</span>
        <span style={{ fontSize: 12, color: 'rgba(230,247,255,0.5)', marginLeft: 8 }}>
          选择模型和点位进行预测
        </span>
      </div>

      {/* 模型选择器 */}
      <div style={styles.modelSelector}>
        {(Object.keys(MODEL_INFO) as ModelType[]).map(key => (
          <button
            key={key}
            style={{
              ...styles.modelButton,
              ...(selectedModel === key ? styles.modelButtonActive : {}),
            }}
            onClick={() => setSelectedModel(key)}
          >
            <i className={`fas fa-${MODEL_INFO[key].icon}`} style={{ marginRight: '8px' }} />
            <div>
              <div style={styles.modelName}>{MODEL_INFO[key].label}</div>
              <div style={styles.modelDesc}>{MODEL_INFO[key].desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 参数行 */}
      <div style={styles.paramRow}>
        <div style={styles.paramGroup}>
          <label style={styles.paramLabel}>监测点位:</label>
          <select
            value={selectedPoint}
            onChange={e => setSelectedPoint(e.target.value)}
            style={styles.select}
          >
            {pointIds.map(pid => (
              <option key={pid} value={pid}>{pid}</option>
            ))}
          </select>
        </div>

        <div style={styles.paramGroup}>
          <label style={styles.paramLabel}>预测步数(周):</label>
          <select value={steps} onChange={e => setSteps(Number(e.target.value))} style={styles.select}>
            <option value={4}>4 周</option>
            <option value={8}>8 周</option>
            <option value={12}>12 周</option>
            <option value={24}>24 周</option>
          </select>
        </div>

        <button style={styles.runButton} onClick={runPrediction} disabled={loading}>
          {loading ? (
            <>
              <div style={styles.miniSpinner} />
              预测中...
            </>
          ) : (
            <>
              <i className="fas fa-play" style={{ marginRight: '6px' }} />
              运行预测
            </>
          )}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={styles.errorBanner}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      {/* 状态结论卡 (结论先行) */}
      {prediction && predictionLevel && predictionMinVal != null && (
        <div style={{
          ...styles.conclusionCard,
          backgroundColor: RISK_CONFIG[predictionLevel].bgColor,
          borderLeft: `4px solid ${RISK_CONFIG[predictionLevel].dotColor}`,
        }}>
          <div style={styles.conclusionTopRow}>
            <div style={styles.conclusionLeft}>
              <i
                className={`fas fa-${RISK_CONFIG[predictionLevel].icon}`}
                style={{ fontSize: 32, color: RISK_CONFIG[predictionLevel].textColor }}
              />
              <div>
                <div style={{
                  fontSize: 24, fontWeight: 'bold',
                  color: RISK_CONFIG[predictionLevel].textColor,
                }}>
                  {RISK_CONFIG[predictionLevel].label}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(230,247,255,0.6)' }}>
                  {MODEL_INFO[selectedModel].label} · 点位 {selectedPoint}
                </div>
              </div>
            </div>
            <div style={styles.conclusionMetrics}>
              <div style={styles.conclusionMetric}>
                <span style={styles.conclusionMetricLabel}>预测最小值</span>
                <span style={{
                  ...styles.conclusionMetricValue,
                  color: RISK_CONFIG[predictionLevel].textColor,
                }}>
                  {predictionMinVal.toFixed(1)} mm
                </span>
              </div>
              <div style={styles.conclusionMetric}>
                <span style={styles.conclusionMetricLabel}>预警阈值</span>
                <span style={styles.conclusionMetricValue}>{SETTLEMENT_WARNING} mm</span>
              </div>
              <div style={styles.conclusionMetric}>
                <span style={styles.conclusionMetricLabel}>危险阈值</span>
                <span style={styles.conclusionMetricValue}>{SETTLEMENT_DANGER} mm</span>
              </div>
            </div>
          </div>
          <div style={styles.disposalBox}>
            <i className="fas fa-lightbulb" style={{ marginRight: 6, color: '#faad14' }} />
            <strong>处置建议:</strong> {getDisposalSuggestion(predictionLevel, predictionMinVal)}
          </div>
        </div>
      )}

      {/* 预测图表 (带阈值线) */}
      {prediction && (
        <div style={styles.chartSection}>
          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>
              {MODEL_INFO[selectedModel].label} - {selectedPoint} 预测曲线
            </span>
            <span style={{ fontSize: 12, color: 'rgba(230,247,255,0.5)', marginLeft: 12 }}>
              黄虚线 = 预警阈值 · 红虚线 = 危险阈值
            </span>
          </div>
          <PredictionChart
            prediction={prediction}
            historicalData={prediction.historical || []}
            height={420}
            thresholdLines={thresholdLines}
          />
        </div>
      )}

      {/* STGCN 多点联合预测总览 */}
      {selectedModel === 'stgcn' && stgcnData && stgcnData.predictions && (
        <div style={styles.stgcnGrid}>
          <div style={styles.sectionTitle}>多点联合预测总览</div>
          <div style={styles.pointGrid}>
            {Object.keys(stgcnData.predictions).slice(0, 10).map((pid: string) => {
              const pData = stgcnData.predictions[pid];
              const lastVal = pData.forecast?.values?.[pData.forecast.values.length - 1];
              return (
                <button
                  key={pid}
                  style={{
                    ...styles.pointCard,
                    ...(selectedPoint === pid ? styles.pointCardActive : {}),
                  }}
                  onClick={() => {
                    setSelectedPoint(pid);
                    setPrediction({
                      success: true,
                      point_id: pid,
                      selected_model: 'stgcn',
                      model_selection_info: { best_score: 0, metric: 'rmse', data_characteristics: { data_size: 0, trend_strength: 0, volatility: 0, seasonality_strength: 0 } },
                      historical: pData.historical || [],
                      forecast: pData.forecast,
                    });
                  }}
                >
                  <div style={styles.pointCardId}>{pid}</div>
                  <div style={styles.pointCardValue}>
                    {lastVal != null ? `${lastVal.toFixed(1)} mm` : '-'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 模型信息 */}
      {modelMeta && (
        <div style={styles.metaSection}>
          <div style={styles.sectionTitle}>模型信息</div>
          <div style={styles.metaGrid}>
            {Object.entries(modelMeta).map(([key, val]) => (
              <div key={key} style={styles.metaItem}>
                <span style={styles.metaKey}>{key}</span>
                <span style={styles.metaVal}>
                  {Array.isArray(val) ? (val as any[]).join(', ') : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!prediction && !loading && !error && (
        <div style={styles.emptyState}>
          <i className="fas fa-chart-line" style={{ fontSize: '48px', color: 'rgba(74,158,255,0.3)' }} />
          <div style={{ fontSize: '16px', color: '#fff', marginTop: '12px' }}>
            选择模型和点位，点击"运行预测"开始
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' },

  /* ===== 风险评估面板 ===== */
  riskPanel: {
    padding: '16px 20px',
    backgroundColor: 'rgba(0, 20, 40, 0.4)',
    border: '1px solid rgba(0, 255, 255, 0.25)',
    borderRadius: '8px',
  },
  riskPanelHeader: {
    display: 'flex', alignItems: 'center',
    marginBottom: 10,
  },
  riskSummary: {
    fontSize: 14, color: 'rgba(230,247,255,0.8)',
    marginBottom: 14, lineHeight: 1.8,
  },
  trafficLightRow: {
    display: 'flex', flexWrap: 'wrap', gap: '10px',
  },
  trafficLightBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    backgroundColor: 'rgba(20, 30, 50, 0.6)',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    borderRadius: '20px',
    cursor: 'pointer', transition: 'all 0.2s',
    color: '#fff',
  },
  trafficLightBtnActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
  },
  dot: {
    display: 'inline-block',
    width: 12, height: 12, borderRadius: '50%',
    flexShrink: 0,
    boxShadow: '0 0 6px currentColor',
  },
  trafficLightLabel: {
    fontSize: 13, fontWeight: 500, color: '#fff',
  },
  trafficLightStatus: {
    fontSize: 11, fontWeight: 600,
    padding: '1px 6px', borderRadius: '8px',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* ===== 展开详情 ===== */
  expandedDetail: {
    marginTop: 12,
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 10, 25, 0.5)',
    borderRadius: '6px',
    border: '1px solid rgba(74, 158, 255, 0.15)',
  },
  expandedTitle: {
    fontSize: 13, fontWeight: 600, color: 'rgba(230,247,255,0.8)',
    marginBottom: 10, display: 'flex', alignItems: 'center',
  },
  expandedModelList: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  expandedModelItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px',
    backgroundColor: 'rgba(20, 20, 40, 0.5)',
    borderRadius: '5px',
  },
  expandedModelName: {
    fontSize: 13, color: '#fff', fontWeight: 500,
  },
  expandedModelDesc: {
    fontSize: 11, color: 'rgba(230,247,255,0.45)', marginTop: 2,
  },
  expandedModelStatus: {
    fontSize: 12, fontWeight: 600,
  },
  expandedModelPage: {
    fontSize: 10, color: 'rgba(74, 158, 255, 0.5)', marginTop: 2,
  },

  /* ===== 区块标题 ===== */
  sectionHeader: {
    display: 'flex', alignItems: 'center',
    marginTop: 4,
  },

  /* ===== 模型选择器 ===== */
  modelSelector: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
  modelButton: {
    display: 'flex', alignItems: 'center', gap: '4px', padding: '16px',
    backgroundColor: 'rgba(30,30,50,0.8)', border: '1px solid rgba(74,158,255,0.2)',
    borderRadius: '8px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
  },
  modelButtonActive: {
    backgroundColor: 'rgba(74,158,255,0.15)', borderColor: '#4a9eff', color: '#4a9eff',
  },
  modelName: { fontSize: '15px', fontWeight: 'bold' },
  modelDesc: { fontSize: '12px', opacity: 0.7, marginTop: '2px' },

  /* ===== 参数行 ===== */
  paramRow: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
    backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)', flexWrap: 'wrap',
  },
  paramGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  paramLabel: { fontSize: '14px', color: '#aaa', whiteSpace: 'nowrap' },
  select: {
    padding: '8px 12px', backgroundColor: 'rgba(20,20,40,0.8)',
    border: '1px solid rgba(74,158,255,0.3)', borderRadius: '6px',
    color: '#fff', fontSize: '13px', outline: 'none',
  },
  runButton: {
    display: 'flex', alignItems: 'center', padding: '10px 20px',
    backgroundColor: 'rgba(74,158,255,0.2)', border: '1px solid rgba(74,158,255,0.4)',
    borderRadius: '6px', color: '#4a9eff', fontSize: '14px', fontWeight: '500',
    cursor: 'pointer', transition: 'all 0.2s', marginLeft: 'auto',
  },
  miniSpinner: {
    width: '14px', height: '14px', border: '2px solid rgba(74,158,255,0.3)',
    borderTop: '2px solid #4a9eff', borderRadius: '50%', animation: 'spin 1s linear infinite',
    marginRight: '8px', flexShrink: 0,
  },
  errorBanner: {
    padding: '12px 16px', backgroundColor: 'rgba(255,77,79,0.1)',
    border: '1px solid rgba(255,77,79,0.3)', borderRadius: '8px',
    color: '#ff7a7a', fontSize: '14px',
  },

  /* ===== 状态结论卡 ===== */
  conclusionCard: {
    padding: '18px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.15)',
  },
  conclusionTopRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 16, marginBottom: 14,
  },
  conclusionLeft: {
    display: 'flex', alignItems: 'center', gap: 14,
  },
  conclusionMetrics: {
    display: 'flex', gap: 24,
  },
  conclusionMetric: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  conclusionMetricLabel: {
    fontSize: 11, color: 'rgba(230,247,255,0.5)',
  },
  conclusionMetricValue: {
    fontSize: 18, fontWeight: 'bold', color: '#fff',
  },
  disposalBox: {
    fontSize: 13, color: 'rgba(230,247,255,0.85)', lineHeight: 1.7,
    padding: '10px 14px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '6px',
  },

  /* ===== 图表区域 ===== */
  chartSection: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  chartHeader: { marginBottom: '12px', display: 'flex', alignItems: 'center' },
  chartTitle: { fontSize: '16px', fontWeight: 'bold', color: '#fff' },

  /* ===== STGCN 多点 ===== */
  stgcnGrid: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '12px' },
  pointGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' },
  pointCard: {
    padding: '12px', backgroundColor: 'rgba(74,158,255,0.08)',
    border: '1px solid rgba(74,158,255,0.2)', borderRadius: '6px',
    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', color: '#aaa',
  },
  pointCardActive: { borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,0.2)', color: '#4a9eff' },
  pointCardId: { fontSize: '14px', fontWeight: 'bold' },
  pointCardValue: { fontSize: '12px', marginTop: '4px', opacity: 0.8 },

  /* ===== 模型信息 ===== */
  metaSection: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' },
  metaItem: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
    backgroundColor: 'rgba(20,20,40,0.5)', borderRadius: '4px',
  },
  metaKey: { fontSize: '13px', color: '#fff' },
  metaVal: { fontSize: '13px', color: '#ddd', fontWeight: '500' },

  /* ===== 空状态 ===== */
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 20px',
  },
};

export default DeepLearningDashboard;
