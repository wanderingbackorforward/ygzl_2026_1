import React, { useState, useEffect, useRef } from 'react';
import { EventImpactChart } from './EventImpactChart';
import { fetchCausalAnalysis } from '../../utils/apiClient';

interface CausalAnalysisProps {
  pointIds?: string[];
}

interface EventImpactResult {
  method: string;
  treatment_effect: number;
  treated_change: number;
  control_change: number;
  confidence_interval: [number, number];
  interpretation: string;
  before_period: {
    dates: string[];
    treated_values: number[];
    control_values: number[];
  };
  after_period: {
    dates: string[];
    treated_values: number[];
    control_values: number[];
    counterfactual?: number[];
  };
}

const EVENT_PRESETS = ['基坑开挖', '盾构穿越', '降水施工', '其他'];

export const CausalAnalysis: React.FC<CausalAnalysisProps> = ({
  pointIds = [],
}) => {
  const [selectedPoint, setSelectedPoint] = useState<string>(pointIds[0] || '');
  const [eventDate, setEventDate] = useState<string>('2021-06-01');
  const [eventPreset, setEventPreset] = useState<string>('基坑开挖');
  const [customName, setCustomName] = useState<string>('');
  const [controlPoints, setControlPoints] = useState<string[]>([]);
  const [method, setMethod] = useState<'DID' | 'SCM'>('DID');
  const [windowDays, setWindowDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventImpactResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  useEffect(() => {
    if (!selectedPoint && pointIds.length > 0) {
      setSelectedPoint(pointIds[0]);
    }
  }, [pointIds, selectedPoint]);

  const eventName = eventPreset === '其他'
    ? (customName.trim() || '施工事件')
    : eventPreset;

  const handleAnalyze = async () => {
    if (!selectedPoint || !eventDate) {
      setError('请先选择点位和事件日期');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchCausalAnalysis({
        point_id: selectedPoint,
        event_date: eventDate,
        control_point_ids: controlPoints.length > 0 ? controlPoints : undefined,
        method,
        window_days: windowDays,
      });

      // 检查后端是否返回错误（success: false）
      if (data && (data as any).success === false) {
        setError((data as any).message || '分析失败，请检查参数');
        setResult(null);
      } else if (data && (typeof data.treatment_effect === 'number' || typeof (data as any).post_event_effect === 'number')) {
        // DID returns treatment_effect, SCM returns post_event_effect
        if (typeof data.treatment_effect !== 'number' && typeof (data as any).post_event_effect === 'number') {
          data.treatment_effect = (data as any).post_event_effect;
        }
        setResult(data);
      } else {
        setError('返回数据格式异常，请检查参数后重试');
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleControlPointToggle = (pointId: string) => {
    setControlPoints(prev =>
      prev.includes(pointId)
        ? prev.filter(p => p !== pointId)
        : [...prev, pointId]
    );
  };

  const effect = result ? Number(result.treatment_effect) : 0;
  const absEffect = Math.abs(effect);
  const tone = absEffect >= 3 ? 'danger' : absEffect >= 1 ? 'warn' : 'ok';
  const resultSentence = !result
    ? ''
    : effect < 0
      ? `施工让 ${selectedPoint} 比“没施工”时多下沉了 ${absEffect.toFixed(2)} mm`
      : `施工让 ${selectedPoint} 比“没施工”时抬升了 ${absEffect.toFixed(2)} mm`;

  return (
    <div style={styles.container}>
      {/* 一句话说明这页在算什么 */}
      <div style={styles.explainCard}>
        <div style={styles.explainIcon}>
          <i className="fas fa-lightbulb" />
        </div>
        <div>
          <div style={styles.explainTitle}>这件事在算什么？</div>
          <div style={styles.explainText}>
            用没受施工影响的点位做对比，算出施工让这个点位额外下沉了多少毫米。
          </div>
        </div>
      </div>

      {/* 三步：选点位 → 选事件 → 看结论 */}
      <div style={styles.steps}>
        <section style={styles.stepCard}>
          <div style={styles.stepHead}>
            <span style={styles.stepNo}>1</span>
            <div>
              <div style={styles.stepTitle}>要分析哪个点位？</div>
              <div style={styles.stepHint}>默认是沉降最大的 S1</div>
            </div>
          </div>
          <select
            value={selectedPoint}
            onChange={e => setSelectedPoint(e.target.value)}
            style={styles.select}
          >
            <option value="">请选择点位</option>
            {pointIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <div style={styles.pointTip}>
            <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
            拿不准就先用 S1，系统会自动挑对比点位
          </div>
          <div style={styles.pointTip}>
            <i className="fas fa-lightbulb" style={{ marginRight: 6 }} />
            点位离施工越近，影响通常越大
          </div>
        </section>

        <section style={styles.stepCard}>
          <div style={styles.stepHead}>
            <span style={styles.stepNo}>2</span>
            <div>
              <div style={styles.stepTitle}>什么时候、发生了什么？</div>
              <div style={styles.stepHint}>选一个施工事件</div>
            </div>
          </div>
          <div style={styles.chipRow}>
            {EVENT_PRESETS.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setEventPreset(name)}
                style={{
                  ...styles.chip,
                  ...(eventPreset === name ? styles.chipActive : {}),
                }}
              >
                {name}
              </button>
            ))}
          </div>
          {eventPreset === '其他' && (
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="输入事件名称，例如：爆破施工"
              style={{ ...styles.input, marginTop: 10 }}
            />
          )}
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>发生日期</span>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>观察前后各</span>
            <div style={styles.chipRow}>
              {[15, 30, 60].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setWindowDays(days)}
                  style={{
                    ...styles.chip,
                    ...(windowDays === days ? styles.chipActive : {}),
                  }}
                >
                  {days} 天
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={{ ...styles.stepCard, ...styles.stepCardAction }}>
          <div style={styles.stepHead}>
            <span style={styles.stepNo}>3</span>
            <div>
              <div style={styles.stepTitle}>看结论</div>
              <div style={styles.stepHint}>点一下，马上出结果</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !selectedPoint || !eventDate}
            style={{
              ...styles.analyzeButton,
              opacity: loading || !selectedPoint || !eventDate ? 0.55 : 1,
            }}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />
                分析中…
              </>
            ) : (
              <>
                <i className="fas fa-play" style={{ marginRight: 8 }} />
                开始分析
              </>
            )}
          </button>
          <div style={styles.autoHint}>
            <i className="fas fa-magic" style={{ marginRight: 6 }} />
            对比点位和分析方式已自动配好，不需要懂统计方法
          </div>
        </section>
      </div>

      {/* 高级设置：默认收起 */}
      <details style={styles.advanced}>
        <summary style={styles.advancedSummary}>
          <i className="fas fa-sliders-h" style={{ marginRight: 8 }} />
          高级设置：换对比点位 / 换分析方式
        </summary>
        <div style={styles.advancedBody}>
          <div style={styles.advancedBlock}>
            <div style={styles.advancedLabel}>用来对比的点位（不选就自动挑离得远的）</div>
            <div style={styles.chipRow}>
              {pointIds
                .filter(id => id !== selectedPoint)
                .map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleControlPointToggle(id)}
                    style={{
                      ...styles.chip,
                      ...(controlPoints.includes(id) ? styles.chipActive : {}),
                    }}
                  >
                    {id}
                  </button>
                ))}
            </div>
          </div>
          <div style={styles.advancedBlock}>
            <div style={styles.advancedLabel}>分析方式</div>
            <button
              type="button"
              onClick={() => setMethod('DID')}
              style={{ ...styles.methodCard, ...(method === 'DID' ? styles.methodCardActive : {}) }}
            >
              <div style={styles.methodTitle}>对比法（推荐）</div>
              <div style={styles.methodDesc}>用没受施工影响的点位做对照，直观好懂</div>
            </button>
            <button
              type="button"
              onClick={() => setMethod('SCM')}
              style={{ ...styles.methodCard, ...(method === 'SCM' ? styles.methodCardActive : {}) }}
            >
              <div style={styles.methodTitle}>趋势模拟法（进阶）</div>
              <div style={styles.methodDesc}>用施工前的趋势，推算“如果没施工会怎样”</div>
            </button>
          </div>
        </div>
      </details>

      {/* 错误提示 */}
      {error && (
        <div style={styles.errorContainer}>
          <i className="fas fa-exclamation-circle" style={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* 分析结果：先说结论，再看图 */}
      {result && (
        <>
          <div ref={resultRef} style={{ ...styles.resultBanner, ...styles[`result_${tone}` as 'result_ok' | 'result_warn' | 'result_danger'] }}>
            <div style={styles.resultLabel}>施工的净影响</div>
            <div style={styles.resultNumber}>
              {effect > 0 ? '+' : ''}{effect.toFixed(2)}
              <span style={styles.resultUnit}>mm</span>
            </div>
            <div style={styles.resultSentence}>{resultSentence}</div>
            <div style={styles.resultMeta}>
              {selectedPoint} 实际变化 {Number(result.treated_change).toFixed(2)} mm
              <span style={styles.dot}>·</span>
              对比点位 {Number(result.control_change).toFixed(2)} mm
              {result.confidence_interval && (
                <>
                  <span style={styles.dot}>·</span>
                  波动范围 {Number(result.confidence_interval[0]).toFixed(2)} ~ {Number(result.confidence_interval[1]).toFixed(2)} mm
                </>
              )}
            </div>
          </div>
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>
              {eventName}前后，{selectedPoint} 与对比点位的走势
            </div>
            <EventImpactChart
              data={result}
              eventDate={eventDate}
              eventName={eventName}
              height={420}
            />
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  explainCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '16px 18px',
    background: 'linear-gradient(90deg, rgba(74,158,255,0.16), rgba(74,158,255,0.04))',
    border: '1px solid rgba(74,158,255,0.25)',
    borderRadius: 12,
  },
  explainIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    background: 'rgba(74,158,255,0.2)',
    color: '#7ab8ff',
    fontSize: 18,
  },
  explainTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 4,
  },
  explainText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#b9cbe0',
  },
  steps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 16,
  },
  stepCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 18,
    background: 'rgba(30, 42, 62, 0.75)',
    border: '1px solid rgba(120,160,210,0.18)',
    borderRadius: 14,
  },
  stepCardAction: {
    justifyContent: 'space-between',
  },
  stepHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  stepNo: {
    width: 28,
    height: 28,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: 'rgba(74,158,255,0.18)',
    border: '1px solid rgba(74,158,255,0.45)',
    color: '#7ab8ff',
    fontSize: 13,
    fontWeight: 700,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
  },
  stepHint: {
    fontSize: 12,
    color: '#8fa8c2',
    marginTop: 2,
  },
  select: {
    padding: '10px 12px',
    background: 'rgba(12, 24, 40, 0.9)',
    border: '1px solid rgba(120,160,210,0.3)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  },
  pointTip: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    color: '#7f9ab5',
    lineHeight: 1.5,
  },
  input: {
    padding: '9px 12px',
    background: 'rgba(12, 24, 40, 0.9)',
    border: '1px solid rgba(120,160,210,0.3)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    outline: 'none',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#8fa8c2',
    minWidth: 56,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    padding: '7px 13px',
    background: 'rgba(74,158,255,0.08)',
    border: '1px solid rgba(120,160,210,0.3)',
    borderRadius: 999,
    color: '#cfe0f2',
    fontSize: 12.5,
    cursor: 'pointer',
    transition: 'all .15s',
  },
  chipActive: {
    background: 'rgba(74,158,255,0.28)',
    borderColor: '#4a9eff',
    color: '#fff',
    fontWeight: 600,
  },
  analyzeButton: {
    width: '100%',
    padding: '13px 20px',
    background: 'linear-gradient(90deg, #2f7cf6, #4a9eff)',
    border: 'none',
    borderRadius: 999,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: '#7f9ab5',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  advanced: {
    background: 'rgba(20, 32, 50, 0.6)',
    border: '1px solid rgba(120,160,210,0.16)',
    borderRadius: 12,
    padding: '10px 16px',
  },
  advancedSummary: {
    cursor: 'pointer',
    fontSize: 13,
    color: '#9fb8d1',
  },
  advancedBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '14px 2px 6px',
  },
  advancedBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  advancedLabel: {
    fontSize: 12,
    color: '#8fa8c2',
  },
  methodCard: {
    textAlign: 'left',
    padding: '10px 14px',
    background: 'rgba(12,24,40,0.6)',
    border: '1px solid rgba(120,160,210,0.2)',
    borderRadius: 10,
    cursor: 'pointer',
  },
  methodCardActive: {
    background: 'rgba(74,158,255,0.16)',
    borderColor: '#4a9eff',
  },
  methodTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e8f2ff',
  },
  methodDesc: {
    fontSize: 12,
    color: '#8fa8c2',
    marginTop: 3,
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    background: 'rgba(255,77,79,0.1)',
    border: '1px solid rgba(255,77,79,0.3)',
    borderRadius: 10,
    color: '#ff7875',
    fontSize: 13,
  },
  errorIcon: {
    fontSize: 18,
  },
  resultBanner: {
    padding: '22px 24px',
    borderRadius: 14,
    border: '1px solid',
  },
  result_ok: {
    background: 'rgba(82,196,26,0.10)',
    borderColor: 'rgba(82,196,26,0.35)',
  },
  result_warn: {
    background: 'rgba(250,173,20,0.10)',
    borderColor: 'rgba(250,173,20,0.38)',
  },
  result_danger: {
    background: 'rgba(255,77,79,0.10)',
    borderColor: 'rgba(255,77,79,0.38)',
  },
  resultLabel: {
    fontSize: 13,
    color: '#9fb8d1',
    marginBottom: 6,
  },
  resultNumber: {
    fontSize: 44,
    fontWeight: 800,
    lineHeight: 1.1,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  resultUnit: {
    fontSize: 18,
    fontWeight: 600,
    marginLeft: 6,
    color: '#b9cbe0',
  },
  resultSentence: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
  },
  resultMeta: {
    marginTop: 10,
    fontSize: 12.5,
    color: '#9fb8d1',
  },
  dot: {
    margin: '0 8px',
    color: '#54708c',
  },
  chartCard: {
    padding: '16px 18px 10px',
    background: 'rgba(30, 42, 62, 0.7)',
    border: '1px solid rgba(120,160,210,0.18)',
    borderRadius: 14,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 6,
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '34px 20px',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 22,
    color: '#4a9eff',
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e8f2ff',
  },
  emptyMessage: {
    fontSize: 13,
    color: '#8fa8c2',
    textAlign: 'center',
  },
};
