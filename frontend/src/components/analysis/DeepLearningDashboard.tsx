import React, { useState, useCallback, useEffect } from 'react';
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

// 全部 8 个 AI 模型总览 (按监测类型分组, 通俗描述)
const ALL_AI_MODELS: {
  group: string;
  models: { name: string; label: string; desc: string; page: string; metricKey?: string; metricLabel?: string }[];
}[] = [
  {
    group: '地表沉降',
    models: [
      { name: 'informer', label: '智能预测', desc: '适合长期趋势分析', page: '当前页面 ↓', metricKey: 'MAE', metricLabel: 'MAE' },
      { name: 'stgcn', label: '空间关联预测', desc: '考虑点位间相互影响', page: '当前页面 ↓', metricKey: 'MAE', metricLabel: 'MAE' },
      { name: 'pinn', label: '物理模型预测', desc: '结合物理规律,更可靠', page: '当前页面 ↓', metricKey: 'MAE', metricLabel: 'MAE' },
    ],
  },
  {
    group: '温度监测',
    models: [
      { name: 'temperature', label: 'AI 温度预测', desc: '基于 251 个传感器历史数据', page: '温度监测页', metricKey: 'MAE', metricLabel: 'MAE' },
    ],
  },
  {
    group: '振动监测',
    models: [
      { name: 'vibration', label: 'AI 波形预测', desc: '预测振动波形和统计特征', page: '振动监测页', metricKey: 'val_mae_real', metricLabel: 'MAE' },
      { name: 'vibration_freq', label: 'AI 振动诊断', desc: '自动识别异常频谱模式', page: '振动监测页', metricKey: 'val_accuracy', metricLabel: '准确率' },
    ],
  },
  {
    group: '裂缝监测',
    models: [
      { name: 'crack', label: 'AI 裂缝预测', desc: '预测未来 2.5 天裂缝变化', page: '裂缝监测页', metricKey: 'val_mae_real', metricLabel: 'MAE' },
    ],
  },
  {
    group: '盾构掘进',
    models: [
      { name: 'tbm', label: 'AI 盾构姿态预测', desc: '预测未来 20 分钟姿态偏差', page: '盾构轨迹页', metricKey: 'val_mae_real', metricLabel: 'MAE' },
    ],
  },
];

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
        // Convert STGCN result for selected point into PredictionResult format
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

  return (
    <div style={styles.container}>
      {/* AI 模型总览 (8 个模型, 5 类监测) */}
      <div style={{
        marginBottom: '16px',
        padding: '14px 18px',
        backgroundColor: 'rgba(0, 20, 40, 0.4)',
        border: '1px solid rgba(0, 255, 255, 0.25)',
        borderRadius: '8px',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 10, color: '#fff' }}>
          <i className="fas fa-microchip" style={{ marginRight: 8, color: '#00ffe1' }} />
          AI 预测模型总览
          <span style={{ fontSize: 11, color: 'rgba(230,247,255,0.6)', marginLeft: 8, fontWeight: 'normal' }}>
            共 8 个模型,覆盖 5 类监测数据
          </span>
        </div>
        {ALL_AI_MODELS.map(group => (
          <div key={group.group} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(230,247,255,0.5)', marginBottom: 4 }}>{group.group}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
              {group.models.map(m => {
                const info = dlStatus?.models?.[m.name];
                const loaded = info?.weights_loaded;
                const metricVal = info?.metrics?.[m.metricKey || 'MAE'];
                return (
                  <div key={m.name} style={{
                    padding: '6px 10px',
                    background: loaded ? 'rgba(82, 196, 26, 0.06)' : 'rgba(255, 122, 122, 0.06)',
                    border: `1px solid ${loaded ? 'rgba(82, 196, 26, 0.25)' : 'rgba(255, 122, 122, 0.25)'}`,
                    borderRadius: 5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                      <i className={`fas fa-${loaded ? 'check-circle' : 'times-circle'}`}
                         style={{ color: loaded ? '#95de64' : '#ff7a7a', fontSize: 10 }} />
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(230,247,255,0.45)', marginBottom: 1 }}>{m.desc}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                      <span style={{ color: loaded && metricVal != null ? '#95de64' : 'rgba(230,247,255,0.35)' }}>
                        {loaded && metricVal != null
                          ? `${m.metricLabel}=${m.metricKey === 'val_accuracy' ? (metricVal * 100).toFixed(1) + '%' : Number(metricVal).toFixed(4)}`
                          : loaded ? '已就绪' : '未加载'}
                      </span>
                      <span style={{ color: 'rgba(74, 158, 255, 0.6)' }}>{m.page}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Model selector */}
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

      {/* Parameters */}
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

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      {/* Chart */}
      {prediction && (
        <div style={styles.chartSection}>
          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>
              {MODEL_INFO[selectedModel].label} - {selectedPoint} 预测曲线
            </span>
          </div>
          <PredictionChart
            prediction={prediction}
            historicalData={prediction.historical || []}
            height={420}
          />
        </div>
      )}

      {/* STGCN multi-point preview */}
      {selectedModel === 'stgcn' && stgcnData && stgcnData.predictions && (
        <div style={styles.stgcnGrid}>
          <div style={styles.sectionTitle}>STGCN 多点联合预测总览</div>
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

      {/* Model meta info */}
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

      {/* Empty state */}
      {!prediction && !loading && !error && (
        <div style={styles.emptyState}>
          <i className="fas fa-robot" style={{ fontSize: '48px', color: 'rgba(74,158,255,0.3)' }} />
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
  chartSection: {
    padding: '20px', backgroundColor: 'rgba(30,30,50,0.6)', borderRadius: '8px',
    border: '1px solid rgba(74,158,255,0.2)',
  },
  chartHeader: { marginBottom: '12px' },
  chartTitle: { fontSize: '16px', fontWeight: 'bold', color: '#fff' },
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
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 20px',
  },
};

export default DeepLearningDashboard;
