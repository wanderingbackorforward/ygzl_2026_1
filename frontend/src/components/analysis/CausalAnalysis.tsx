import React, { useState, useEffect, useRef } from 'react';
import { EventImpactChart } from './EventImpactChart';
import { fetchCausalAnalysis } from '../../utils/apiClient';

interface CausalAnalysisProps {
  pointIds?: string[];
}

interface EventImpactResult {
  method: string;
  method_label?: string;
  treatment_effect: number;
  treated_change: number;
  control_change: number;
  confidence_interval: [number, number];
  interpretation: string;
  // 后端给出的人话结论（区间跨 0 时不会说成"有影响"）
  significant?: boolean;
  level?: 'unknown' | 'clear' | 'caution';
  headline?: string;
  detail?: string;
  advice?: string;
  control_points?: string[];
  control_selection?: string;
  data_note?: string;
  low_sample?: boolean;
  interval_reliable?: boolean;
  sample_size?: {
    treated_before?: number;
    treated_after?: number;
    control_points?: number;
  };
  algorithm?: {
    name?: string;
    label?: string;
    uses_llm?: boolean;
    data_source?: string;
  };
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
  const level = result?.level || 'unknown';
  const tone: 'danger' | 'warn' | 'ok' | 'neutral' =
    level === 'caution' ? 'warn'
      : level === 'clear' ? (effect < 0 ? 'danger' : 'ok')
        : 'neutral';
  const badgeText =
    level === 'caution' ? '结果不够稳'
      : level === 'clear' ? (effect < 0 ? '影响明确 · 偏不利' : '影响明确 · 偏安全')
        : '暂时看不出影响';
  const headline = result?.headline || (effect < 0
    ? `施工让 ${selectedPoint} 比“没施工”时多下沉了 ${absEffect.toFixed(2)} mm`
    : `施工让 ${selectedPoint} 比“没施工”时抬升了 ${absEffect.toFixed(2)} mm`);
  const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
  const controlList = (result?.control_points || []).join('、') || '未指定';
  const ci = result?.confidence_interval;
  const ciIncludesZero = !!ci && ci[0] <= 0 && ci[1] >= 0;
  const algoLabel = result?.method_label || (result?.method === 'SCM' ? '趋势模拟法' : '对比法');

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
          <div style={styles.explainTag}>
            <i className="fas fa-microchip" style={{ marginRight: 6 }} />
            纯统计计算 · 数据来自现场实测 · 未调用大模型
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
            <div style={styles.advancedLabel}>用来对比的点位（不选就按施工前走势自动配对）</div>
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

      {/* 分析结果：一句话结论 → 依据 → 建议 → 想看细节再展开 */}
      {result && (
        <div ref={resultRef} style={styles.resultWrap}>
          <div
            style={{
              ...styles.verdictCard,
              ...(styles[`result_${tone}` as 'result_ok' | 'result_warn' | 'result_danger' | 'result_neutral']),
            }}
          >
            <div style={styles.verdictTop}>
              <span style={styles.verdictBadge}>{badgeText}</span>
              <span style={styles.verdictMethod}>{selectedPoint} · {algoLabel}</span>
            </div>
            <div style={styles.verdictHeadline}>{headline}</div>
            {result.detail && <div style={styles.verdictDetail}>{result.detail}</div>}
            {level === 'clear' && (
              <div style={styles.bigNumberRow}>
                <span style={styles.bigNumber}>{fmt(effect)}</span>
                <span style={styles.bigNumberUnit}>mm 净影响</span>
              </div>
            )}
          </div>

          <div style={styles.evidenceCard}>
            <div style={styles.sectionTitle}>依据：三组数字对得上</div>
            <div style={styles.evidenceRow}>
              <span style={styles.evidenceLabel}>{selectedPoint} 施工前后变化</span>
              <span style={styles.evidenceValue}>{fmt(Number(result.treated_change))} mm</span>
            </div>
            <div style={styles.evidenceRow}>
              <span style={styles.evidenceLabel}>对比点位同期变化（{controlList}）</span>
              <span style={styles.evidenceValue}>{fmt(Number(result.control_change))} mm</span>
            </div>
            <div style={{ ...styles.evidenceRow, ...styles.evidenceRowLast }}>
              <span style={styles.evidenceLabel}>相减得到的净影响</span>
              <span style={styles.evidenceValueStrong}>{fmt(effect)} mm</span>
            </div>
            <div style={styles.ciNote}>
              可复算：{fmt(Number(result.treated_change))} −（{fmt(Number(result.control_change))}）= {fmt(effect)} mm
            </div>
            <div style={styles.ciNote}>
              可能范围 {fmt(Number(ci?.[0] ?? 0))} ~ {fmt(Number(ci?.[1] ?? 0))} mm
              {ciIncludesZero ? '，包含 0，所以不能断定是施工造成的' : '，不包含 0，结论比较稳'}
            </div>
            {result.low_sample && (
              <div style={styles.warnNote}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
                这次施工前后各只有 {result.sample_size?.treated_before ?? 0} 次测量，样本偏少，建议换 60 天窗口再算一次。
              </div>
            )}
          </div>

          <div style={styles.adviceCard}>
            <i className="fas fa-clipboard-check" style={styles.adviceIcon} />
            <div>
              <div style={styles.adviceLabel}>建议</div>
              <div style={styles.adviceText}>{result.advice}</div>
            </div>
          </div>

          <details style={styles.fold}>
            <summary style={styles.foldSummary}>
              <i className="fas fa-calculator" style={{ marginRight: 8 }} />
              这次是怎么算出来的？（没有调用大模型）
            </summary>
            <div style={styles.foldBody}>
              <div style={styles.foldLine}>
                <b>算法：</b>{algoLabel}（{result.method}）。
                {result.method === 'SCM'
                  ? '用施工前的走势推一个“如果没施工”的对照，再看实际和它的差距。'
                  : '用施工前后的实测变化，减去同期对比点位的变化。'}
              </div>
              <div style={styles.foldLine}>
                <b>数据：</b>{result.algorithm?.data_source || '现场实测沉降数据'}；
                {result.data_note || '按周测数据计算'}。
              </div>
              <div style={styles.foldLine}>
                <b>对比点位：</b>{controlList}
                {result.control_selection === 'auto_similar_trend'
                  ? '（按施工前走势自动配对，未使用坐标距离）'
                  : ''}
              </div>
              <div style={styles.foldLine}>
                <b>是否用大模型：</b>没有。这是本地统计计算，同样的数据谁算都是这个结果。
              </div>
              <div style={styles.foldHint}>
                说明：事件名称只用于图表标注；真正参与计算的是点位、日期和前后各 {windowDays} 天的实测值。
              </div>
            </div>
          </details>

          <details style={styles.fold}>
            <summary style={styles.foldSummary}>
              <i className="fas fa-chart-line" style={{ marginRight: 8 }} />
              展开看走势图（两条线各自怎么走）
            </summary>
            <div style={styles.chartBox}>
              <EventImpactChart
                data={result}
                eventDate={eventDate}
                eventName={eventName}
                height={340}
              />
            </div>
          </details>
        </div>
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
  explainTag: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: 8,
    padding: '3px 9px',
    borderRadius: 999,
    background: 'rgba(74,158,255,0.16)',
    border: '1px solid rgba(74,158,255,0.3)',
    fontSize: 11.5,
    color: '#9fc6ff',
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
  resultWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  verdictCard: {
    padding: '20px 22px',
    borderRadius: 16,
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
  result_neutral: {
    background: 'rgba(74,158,255,0.10)',
    borderColor: 'rgba(74,158,255,0.35)',
  },
  verdictTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  verdictBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.14)',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },
  verdictMethod: {
    fontSize: 12,
    color: '#9fb8d1',
  },
  verdictHeadline: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 1.35,
    fontWeight: 800,
    color: '#fff',
  },
  verdictDetail: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 1.7,
    color: '#cfdcec',
  },
  bigNumberRow: {
    marginTop: 12,
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1.1,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  bigNumberUnit: {
    fontSize: 13,
    color: '#9fb8d1',
  },
  evidenceCard: {
    padding: '16px 18px',
    background: 'rgba(30, 42, 62, 0.75)',
    border: '1px solid rgba(120,160,210,0.18)',
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#8fa8c2',
    marginBottom: 10,
  },
  evidenceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    padding: '9px 0',
    borderBottom: '1px solid rgba(120,160,210,0.12)',
  },
  evidenceRowLast: {
    borderBottom: 'none',
  },
  evidenceLabel: {
    fontSize: 13,
    color: '#c2d3e6',
    lineHeight: 1.5,
  },
  evidenceValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
  },
  evidenceValueStrong: {
    fontSize: 17,
    fontWeight: 800,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
  },
  ciNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#8fa8c2',
    lineHeight: 1.6,
  },
  warnNote: {
    marginTop: 10,
    fontSize: 12,
    color: '#fbbf24',
    lineHeight: 1.6,
    display: 'flex',
    alignItems: 'flex-start',
  },
  adviceCard: {
    display: 'flex',
    gap: 12,
    padding: '14px 16px',
    background: 'rgba(74,158,255,0.10)',
    border: '1px solid rgba(74,158,255,0.28)',
    borderRadius: 12,
  },
  adviceIcon: {
    fontSize: 18,
    color: '#7ab8ff',
    marginTop: 2,
  },
  adviceLabel: {
    fontSize: 12,
    color: '#8fa8c2',
    marginBottom: 4,
  },
  adviceText: {
    fontSize: 13.5,
    color: '#e8f2ff',
    lineHeight: 1.7,
  },
  fold: {
    background: 'rgba(20, 32, 50, 0.6)',
    border: '1px solid rgba(120,160,210,0.16)',
    borderRadius: 12,
    padding: '10px 16px',
  },
  foldSummary: {
    cursor: 'pointer',
    fontSize: 13,
    color: '#9fb8d1',
  },
  foldBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 2px 6px',
  },
  foldLine: {
    fontSize: 12.5,
    lineHeight: 1.7,
    color: '#c2d3e6',
  },
  foldHint: {
    fontSize: 12,
    lineHeight: 1.6,
    color: '#7f9ab5',
  },
  chartBox: {
    paddingTop: 8,
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
