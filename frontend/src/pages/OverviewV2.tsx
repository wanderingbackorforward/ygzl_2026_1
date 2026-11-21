import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { EChartsWrapper } from '../components/charts/EChartsWrapper';
import {
  diagnose,
  LEVEL_CONFIG,
  type DiagnosisInput,
  type DiagnosisResult,
  type HealthLevel,
  type ActionItem,
} from '../utils/diagnosisEngine';
import type { EChartsOption } from 'echarts';
import { TerzaghiIndicator, MoranIndicator, AnomalyConfidenceRadar } from '../components/overview-v2/SciencePanel';
import { PageHeader, KpiCard } from '../components/common/ui';
import './OverviewV2.css';

// ─────────────────────────────────────────────
// 数据类型（与后端对齐）
// ─────────────────────────────────────────────
interface PointSummary {
  point_id: string;
  alert_level: string;
  total_change: number;
  trend_slope: number;
  trend_type: string;
  predicted_change_30d: number;
  last_date: string;
  level?: 'normal' | 'warning' | 'alert';
  level_cn?: string;
  reason?: string;
}

interface SettlementSummary {
  total_points?: number;
  normal_count?: number;
  warning_count?: number;
  alert_count?: number;
  abnormal_count?: number;
  max_settlement?: number | null;
  max_settlement_point?: string | null;
  level?: 'normal' | 'warning' | 'alert';
  level_cn?: string;
  max_value?: number;
  trend_distribution?: Record<string, number>;
}

interface AnalysisData {
  stats: { total_points: number; anomaly_count: number };
  anomalies: any[];
  recommendations: any[];
  summary: Record<string, any>;
}

// 四指标口径来自 /api/overview/summary（见 指标口径.md 第 2 节）
interface OverviewSummary {
  settlement?: SettlementSummary;
  cracks?: { total_points?: number; expanding_count?: number; shrinking_count?: number; stable_count?: number };
  temperature?: {
    total_sensors?: number;
    analyzed_sensors?: number;
    normal_count?: number;
    warning_count?: number;
    alert_count?: number;
    abnormal_count?: number;
    level?: 'normal' | 'warning' | 'alert';
    avg_temp?: number;
    min_temp?: number;
    max_temp?: number;
  };
  vibration?: { total_datasets?: number };
  safety_score?: number;
}

// ─────────────────────────────────────────────
// 诊断带 — 一句话诊断（60px，像通知栏）
// ─────────────────────────────────────────────
function DiagnosisBanner({ result, loading }: { result: DiagnosisResult | null; loading: boolean }) {
  if (loading || !result) {
    return (
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,20,40,0.95)', borderBottom: '1px solid rgba(0,229,255,0.1)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>正在分析项目健康状态...</span>
      </div>
    );
  }

  const cfg = LEVEL_CONFIG[result.level];

  return (
    <div style={{
      height: 52, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px',
      background: 'rgba(0,20,40,0.95)', borderBottom: `2px solid ${cfg.color}`,
    }}>
      {/* 健康色块 */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: cfg.bg, border: `2px solid ${cfg.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: cfg.color,
      }}>
        {result.score}
      </div>

      {/* 诊断句 */}
      <div style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: 500 }}>
        {result.sentence}
      </div>

      {/* 数据质量 */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${result.dataQuality * 100}%`, height: '100%',
            background: result.dataQuality > 0.7 ? '#22c55e' : '#eab308',
            borderRadius: 2,
          }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
          数据 {Math.round(result.dataQuality * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 证据画布 — ECharts Graph 因果关系图
// ─────────────────────────────────────────────
function EvidenceCanvas({ result }: { result: DiagnosisResult | null }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<{ name: string; detail: string; category: string } | null>(null);

  const handleChartReady = useCallback((chart: any) => {
    chart.off('click');
    chart.on('click', (params: any) => {
      if (params.dataType === 'node') {
        setSelected({ name: params.name, detail: params.value || '', category: params.data?.category ?? '' });
      } else {
        setSelected(null);
      }
    });
  }, []);

  const option: EChartsOption = useMemo(() => {
    if (!result || result.evidenceNodes.length === 0) {
      return {
        graphic: [{
          type: 'text',
          left: 'center', top: 'center',
          style: { text: '所有监测点数据正常，无异常证据', fill: '#22c55e', fontSize: 15 },
        }],
      };
    }

    const catColors: Record<string, string> = {
      settlement: '#06b6d4',
      crack: '#f97316',
      temperature: '#eab308',
      geology: '#8b5cf6',
      construction: '#ec4899',
    };
    const catLabels: Record<string, string> = {
      settlement: '沉降',
      crack: '裂缝',
      temperature: '温度',
      geology: '地质',
      construction: '施工',
    };

    const categories = [...new Set(result.evidenceNodes.map(n => n.category))].map(c => ({
      name: catLabels[c] || c,
      itemStyle: { color: catColors[c] || '#06b6d4' },
    }));

    const catIndex = (cat: string) => categories.findIndex(c => c.name === (catLabels[cat] || cat));

    const nodes = result.evidenceNodes.map(n => ({
      id: n.id,
      name: n.label,
      category: catIndex(n.category),
      symbolSize: 20 + n.severity * 35,
      value: n.detail,
      label: { show: true, color: '#fff', fontSize: 12, fontWeight: 600 as const },
      itemStyle: {
        color: catColors[n.category] || '#06b6d4',
        borderColor: 'rgba(255,255,255,0.3)',
        borderWidth: 1,
        shadowBlur: n.severity > 0.7 ? 15 : 5,
        shadowColor: catColors[n.category] || '#06b6d4',
      },
    }));

    const edges = result.evidenceLinks.map(l => ({
      source: l.source,
      target: l.target,
      value: l.relation,
      lineStyle: {
        width: 1 + l.strength * 4,
        color: 'rgba(255,255,255,0.25)',
        curveness: 0.2,
      },
      label: {
        show: l.strength > 0.5,
        formatter: l.relation,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,20,40,0.95)',
        borderColor: 'rgba(0,229,255,0.3)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (p: any) => {
          if (p.dataType === 'node') return `<b>${p.name}</b><br/>${p.value || ''}`;
          if (p.dataType === 'edge') return p.value || '';
          return '';
        },
      },
      legend: {
        data: categories.map(c => c.name),
        bottom: 8, left: 'center',
        textStyle: { color: '#fff', fontSize: 12 },
        itemWidth: 12, itemHeight: 12,
      },
      animationDuration: 800,
      animationEasingUpdate: 'quinticInOut' as const,
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories,
        data: nodes,
        links: edges,
        force: {
          repulsion: 180,
          edgeLength: [80, 200],
          gravity: 0.08,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 6 },
        },
      }],
    };
  }, [result]);

  return (
    <div className="ds-panel" style={{ flex: 1, minHeight: 0 }}>
      <div style={{
        padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <i className="fas fa-project-diagram" style={{ color: '#06b6d4', fontSize: 13 }} />
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>证据关系图</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginLeft: 'auto' }}>
          拖拽节点 / 滚轮缩放
        </span>
      </div>
      <EChartsWrapper option={option} style={{ width: '100%', height: selected ? 'calc(100% - 80px)' : 'calc(100% - 32px)' }} onChartReady={handleChartReady} />

      {/* 节点详情条 */}
      {selected && (
        <div style={{
          height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', background: 'rgba(6,182,212,0.08)',
          borderTop: '1px solid rgba(6,182,212,0.2)',
        }}>
          <span style={{ color: '#06b6d4', fontSize: 14, fontWeight: 700 }}>{selected.name}</span>
          <span style={{ color: '#fff', fontSize: 12, flex: 1 }}>{selected.detail}</span>
          {/^[A-Za-z]/.test(selected.name) && /^(settlement|temperature|crack)$/.test(selected.category) && (
            <button
              onClick={() => navigate(`/advanced?point=${encodeURIComponent(selected.name)}&metric=${selected.category}&from=overview`)}
              style={{
                padding: '4px 10px', fontSize: 12, borderRadius: 4,
                border: '1px solid rgba(0,229,255,0.5)', background: 'rgba(0,229,255,0.15)',
                color: '#00e5ff', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              去处置 →
            </button>
          )}
          <button onClick={() => setSelected(null)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 14, padding: '4px 8px',
          }}>
            <i className="fas fa-times" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 管理概览面板 — 趋势摘要 + 预测迷你图
// ─────────────────────────────────────────────
function ManagerOverview({ points, summary }: { points: PointSummary[]; summary?: SettlementSummary }) {
  // 趋势分类统计
  const stats = useMemo(() => {
    const stable = points.filter(p => p.trend_type === 'stable' || Math.abs(p.trend_slope) < 0.05).length;
    const increasing = points.filter(p => p.trend_type === 'increasing' && p.trend_slope < -0.05).length;
    const decreasing = points.filter(p => p.trend_type === 'decreasing' || p.trend_slope > 0.05).length;
    const alert = summary?.alert_count ?? 0;
    const warn = summary?.warning_count ?? 0;
    const maxSett = summary?.max_settlement ?? 0;
    const avgSlope = points.length > 0 ? points.reduce((s, p) => s + (p.trend_slope ?? 0), 0) / points.length : 0;
    return { stable, increasing, decreasing, alert, warn, maxSett, avgSlope, total: summary?.total_points ?? points.length };
  }, [points, summary]);

  // 30天预测分布迷你图
  const predOption: EChartsOption = useMemo(() => {
    if (points.length === 0) return {};
    const sorted = [...points].sort((a, b) => (a.predicted_change_30d ?? 0) - (b.predicted_change_30d ?? 0));
    return {
      grid: { top: 8, bottom: 24, left: 36, right: 8 },
      xAxis: {
        type: 'category' as const,
        data: sorted.map(p => p.point_id),
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, rotate: 45 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'value' as const,
        name: 'mm',
        nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [{
        type: 'bar',
        data: sorted.map(p => ({
          value: p.predicted_change_30d ?? 0,
          itemStyle: {
            color: (p.predicted_change_30d ?? 0) < -20 ? '#ef4444'
              : (p.predicted_change_30d ?? 0) < -10 ? '#eab308' : '#22c55e',
          },
        })),
        barWidth: '60%',
      }],
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(0,20,40,0.95)',
        borderColor: 'rgba(0,229,255,0.3)',
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: (p: any) => {
          const d = p[0];
          return `${d.name}<br/>30天预测: ${d.value?.toFixed(1) ?? '-'}mm`;
        },
      },
    };
  }, [points]);

  const statItems = [
    { label: '监测总数', value: stats.total, tone: 'info' as const },
    { label: '报警', value: stats.alert, tone: stats.alert > 0 ? ('danger' as const) : ('ok' as const) },
    { label: '预警', value: stats.warn, tone: stats.warn > 0 ? ('warn' as const) : ('ok' as const) },
    { label: '加速中', value: stats.increasing, tone: stats.increasing > 0 ? ('warn' as const) : ('ok' as const) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 统计摘要网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {statItems.map(s => (
          <KpiCard key={s.label} label={s.label} value={s.value} tone={s.tone} compact />
        ))}
      </div>

      {/* 关键指标 */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>最大沉降</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{stats.maxSett.toFixed(1)} mm</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>平均速率</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{stats.avgSlope.toFixed(2)} mm/d</div>
        </div>
      </div>

      {/* 30天预测分布 */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: 10,
        padding: '10px 12px', borderLeft: '3px solid var(--ds-info)',
      }}>
        <div style={{ color: 'var(--ds-text)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          30天预测分布
        </div>
        <div style={{ height: 140 }}>
          <EChartsWrapper option={predOption} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 行动面板 — 角色切换（施工/科研/管理）
// ─────────────────────────────────────────────
type RoleTab = 'engineer' | 'researcher' | 'manager';
const ROLE_TABS: { key: RoleTab; label: string; icon: string }[] = [
  { key: 'engineer', label: '施工指令', icon: 'fa-hard-hat' },
  { key: 'researcher', label: '科研洞察', icon: 'fa-flask' },
  { key: 'manager', label: '管理概览', icon: 'fa-chart-line' },
];

const URGENCY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  now:   { label: '立即', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  today: { label: '今日', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  week:  { label: '本周', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
};

function ActionPanel({ result, points, summary }: { result: DiagnosisResult | null; points: PointSummary[]; summary?: SettlementSummary }) {
  const [role, setRole] = useState<RoleTab>('engineer');

  const filtered = useMemo(
    () => (result?.actions || []).filter(a => a.role === role),
    [result, role],
  );

  return (
    <div className="ds-panel" style={{ width: 340, flexShrink: 0 }}>
      {/* 角色切换栏 */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {ROLE_TABS.map(t => (
          <button key={t.key} onClick={() => setRole(t.key)} style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            background: role === t.key ? 'rgba(6,182,212,0.15)' : 'transparent',
            borderBottom: role === t.key ? '2px solid #06b6d4' : '2px solid transparent',
            color: role === t.key ? '#fff' : 'rgba(255,255,255,0.5)',
            fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <i className={`fas ${t.icon}`} style={{ fontSize: 11 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
        {role === 'researcher' ? (
          /* 科研视角：算法面板 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TerzaghiIndicator points={points} />
            <MoranIndicator points={points} />
            <AnomalyConfidenceRadar points={points} />
          </div>
        ) : role === 'manager' ? (
          /* 管理视角：趋势摘要 + 预测迷你图 */
          <ManagerOverview points={points} summary={summary} />
        ) : filtered.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', padding: 24 }}>
            当前视角暂无待办事项
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((a, i) => {
              const u = URGENCY_STYLE[a.urgency] || URGENCY_STYLE.week;
              return (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                  padding: '10px 12px', borderLeft: `3px solid ${u.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: u.color,
                      background: u.bg, borderRadius: 3, padding: '1px 6px',
                    }}>{u.label}</span>
                    {a.relatedPoints.length > 0 && (
                      <span style={{ fontSize: 10, color: '#06b6d4' }}>
                        {a.relatedPoints.slice(0, 3).join(' ')}
                        {a.relatedPoints.length > 3 ? ` +${a.relatedPoints.length - 3}` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                    {a.instruction}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    {a.reason}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 页面主体 — 数据加载 + 布局组装
// ─────────────────────────────────────────────
export default function OverviewV2() {
  const navigate = useNavigate();
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [overview, setOverview] = useState<OverviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pts, anal, ov] = await Promise.all([
        apiGet<PointSummary[]>('/summary').catch(() => []),
        apiGet<AnalysisData>('/analysis/v2/settlement').catch(() => null),
        apiGet<OverviewSummary>('/overview/summary').catch(() => null),
      ]);
      setPoints(pts || []);
      setAnalysis(anal);
      setOverview(ov);
    } catch {
      // 静默降级
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 自动刷新（5分钟）
  useEffect(() => {
    const timer = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 运行诊断引擎
  const diagnosis = useMemo<DiagnosisResult | null>(() => {
    if (loading || points.length === 0) return null;
    const input: DiagnosisInput = {
      points: points.map(p => ({
        point_id: p.point_id,
        alert_level: p.level || 'normal',
        total_change: p.total_change ?? 0,
        trend_slope: p.trend_slope ?? 0,
        trend_type: p.trend_type || 'stable',
        predicted_change_30d: p.predicted_change_30d ?? 0,
      })),
      anomalies: analysis?.anomalies || [],
      recommendations: analysis?.recommendations || [],
      status: overview?.settlement,
    };
    return diagnose(input);
  }, [points, analysis, loading, overview?.settlement]);

  const settlement = overview?.settlement;
  const cracks = overview?.cracks;
  const temperature = overview?.temperature;
  const vibration = overview?.vibration;

  const kpiItems = [
    {
      key: 'settlement',
      label: '沉降 · 异常点',
      value: settlement?.abnormal_count ?? '—',
      unit: '个',
      tone: settlement?.level === 'alert' ? ('danger' as const)
        : settlement?.level === 'warning' ? ('warn' as const) : ('ok' as const),
      sub: settlement
        ? `${settlement.total_points ?? 0} 点 · 最大累计沉降 ${Number(settlement.max_settlement ?? 0).toFixed(2)} mm`
        : '接口不可用',
      onClick: () => navigate('/settlement?from=overview'),
    },
    {
      key: 'temperature',
      label: '温度 · 监测点',
      value: temperature?.analyzed_sensors ?? temperature?.total_sensors ?? '—',
      unit: '个',
      tone: 'info' as const,
      sub: temperature
        ? `正常 ${temperature.normal_count ?? 0} · 需关注 ${temperature.warning_count ?? 0} · 均值 ${Number(temperature.avg_temp ?? 0).toFixed(1)}℃`
        : '接口不可用',
      onClick: () => navigate('/temperature?from=overview'),
    },
    {
      key: 'cracks',
      label: '裂缝 · 扩展',
      value: cracks?.expanding_count ?? '—',
      unit: '条',
      tone: (cracks?.expanding_count ?? 0) > 0 ? ('warn' as const) : ('ok' as const),
      sub: cracks
        ? `${cracks.total_points ?? 0} 条 · 收缩 ${cracks.shrinking_count ?? 0} / 稳定 ${cracks.stable_count ?? 0}`
        : '接口不可用',
      onClick: () => navigate('/cracks?from=overview'),
    },
    {
      key: 'vibration',
      label: '振动 · 数据集',
      value: vibration?.total_datasets ?? '—',
      unit: '个',
      tone: 'muted' as const,
      sub: '演示数据 · 仅波形展示',
      onClick: () => navigate('/vibration?from=overview'),
    },
  ];

  return (
    <div className="ds-page">
      <PageHeader
        eyebrow="今天有没有事"
        title="数据总览"
        description="四类监测指标的最新状态；点异常进入对应指标页，再进高级分析"
        meta={
          <span className="ds-chip ds-chip--accent">
            安全评分 {overview?.safety_score ?? '—'}
          </span>
        }
        actions={
          <button type="button" className="ds-btn" onClick={() => navigate('/advanced')}>
            高级分析 →
          </button>
        }
      />

      {/* 四指标 KPI（信息架构第 2 节第一区块） */}
      <div style={{ flexShrink: 0, padding: '12px 16px 0' }}>
        <div className="ds-kpi-grid">
          {kpiItems.map(item => (
            <KpiCard
              key={item.key}
              label={item.label}
              value={item.value}
              unit={item.unit}
              sub={item.sub}
              tone={item.tone}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>

      {/* 第一层：诊断带（固定顶部） */}
      <div style={{ flexShrink: 0, marginTop: 10 }}>
        <DiagnosisBanner result={diagnosis} loading={loading} />
      </div>

      {/* 第二层 + 第三层：证据画布 + 行动面板（响应式） */}
      <div className="ov2-main">
        <EvidenceCanvas result={diagnosis} />
        <ActionPanel result={diagnosis} points={points} summary={settlement} />
      </div>
    </div>
  );
}
