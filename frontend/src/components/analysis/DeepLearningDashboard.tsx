import React, { useState, useCallback } from 'react';
import { PredictionChart } from './PredictionChart';
import type { PredictionResult } from '../../types/analysis';
import {
  fetchInformerPrediction,
  fetchSTGCNPrediction,
  fetchPINNPrediction,
  fetchEnsemblePrediction,
} from '../../utils/apiClient';

type ModelType = 'informer' | 'stgcn' | 'pinn' | 'ensemble';

const MODEL_INFO: Record<ModelType, { label: string; desc: string; icon: string }> = {
  informer: { label: 'Informer', desc: 'Transformer 长序列预测', icon: 'brain' },
  stgcn: { label: 'STGCN', desc: '时空图卷积网络', icon: 'project-diagram' },
  pinn: { label: 'PINN', desc: '物理信息神经网络', icon: 'atom' },
  ensemble: { label: 'Ensemble', desc: '集成学习融合预测', icon: 'layer-group' },
};

export const DeepLearningDashboard: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<ModelType>('informer');
  const [selectedPoint, setSelectedPoint] = useState('S1');
  const [steps, setSteps] = useState(30);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [stgcnData, setStgcnData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelMeta, setModelMeta] = useState<any>(null);

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
          <label style={styles.paramLabel}>预测步数:</label>
          <select value={steps} onChange={e => setSteps(Number(e.target.value))} style={styles.select}>
            <option value={7}>7 天</option>
            <option value={15}>15 天</option>
            <option value={30}>30 天</option>
            <option value={60}>60 天</option>
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
