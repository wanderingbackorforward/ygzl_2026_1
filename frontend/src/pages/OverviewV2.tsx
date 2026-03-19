import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
}

interface AnalysisData {
  stats: { total_points: number; anomaly_count: number };
  anomalies: any[];
  recommendations: any[];
  summary: Record<string, any>;
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
    <div style={{
      flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden',
      background: 'rgba(0,15,30,0.7)',
      border: '1px solid rgba(0,229,255,0.1)',
    }}>
      <div style={{
        padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <i className="fas fa-project-diagram" style={{ color: '#06b6d4', fontSize: 13 }} />
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>证据关系图</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginLeft: 'auto' }}>
          拖拽节点 / 滚轮缩放
        </span>
      </div>
      <EChartsWrapper option={option} style={{ width: '100%', height: 'calc(100% - 32px)' }} />
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

function ActionPanel({ result }: { result: DiagnosisResult | null }) {
  const [role, setRole] = useState<RoleTab>('engineer');

  const filtered = useMemo(
    () => (result?.actions || []).filter(a => a.role === role),
    [result, role],
  );

  return (
    <div style={{
      width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(0,15,30,0.7)', border: '1px solid rgba(0,229,255,0.1)',
      borderRadius: 12, overflow: 'hidden',
    }}>
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

      {/* 行动列表 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
        {filtered.length === 0 ? (
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
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pts, anal] = await Promise.all([
        apiGet<PointSummary[]>('/summary').catch(() => []),
        apiGet<AnalysisData>('/analysis/v2/settlement').catch(() => null),
      ]);
      setPoints(pts || []);
      setAnalysis(anal);
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
        alert_level: p.alert_level || 'normal',
        total_change: p.total_change ?? 0,
        trend_slope: p.trend_slope ?? 0,
        trend_type: p.trend_type || 'stable',
        predicted_change_30d: p.predicted_change_30d ?? 0,
      })),
      anomalies: analysis?.anomalies || [],
      recommendations: analysis?.recommendations || [],
    };
    return diagnose(input);
  }, [points, analysis, loading]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0a1628',
    }}>
      {/* 第一层：诊断带（固定顶部） */}
      <div style={{ flexShrink: 0 }}>
        <DiagnosisBanner result={diagnosis} loading={loading} />
      </div>

      {/* 第二层 + 第三层：证据画布 + 行动面板 */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', gap: 12,
        padding: '12px 16px',
      }}>
        <EvidenceCanvas result={diagnosis} />
        <ActionPanel result={diagnosis} />
      </div>
    </div>
  );
}
