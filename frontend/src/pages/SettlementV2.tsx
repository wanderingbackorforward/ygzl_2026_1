import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { EChartsWrapper } from '../components/charts/EChartsWrapper';
import { useJointData } from '../hooks/useAdvancedAnalysis';
import { AgentHeroCell } from '../components/agent/AgentHeroCell';
import { PageHeader, KpiCard, ChartCard, StateView } from '../components/common/ui';
import type { EChartsOption } from 'echarts';

// ECharts 画在 canvas 上读不到 CSS 变量：图表配色集中在这里（与 design-tokens 对齐），
// 图表配置里不再散落十六进制色值。
const CHART = {
  accent: '#00e5ff',
  text: '#fff',
  tooltipBg: 'rgba(10,20,40,0.95)',
  accentLine: 'rgba(0,229,255,0.3)',
  split: 'rgba(255,255,255,0.06)',
  ok: '#34d399',
  warn: '#fbbf24',
  danger: '#f87171',
  purple: '#a78bfa',
  info: '#38bdf8',
  orange: '#fb923c',
  gray: '#94a3b8',
  teal: '#00d8c9',
  geology: '#bf5af2',
  crack: '#ff3e5f',
  crackWarn: '#ff9e0d',
};

// ─────────────────────────────────────────────
// 类型定义
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
  total_points: number;
  normal_count: number;
  warning_count: number;
  alert_count: number;
  abnormal_count: number;
  max_settlement: number | null;
  max_settlement_point: string | null;
  level: 'normal' | 'warning' | 'alert';
  level_cn: string;
}

interface SummaryResponse {
  points: PointSummary[];
  summary: SettlementSummary | null;
}

interface ProfilePoint {
  chainage_m: number;
  cumulative_change: number;
  daily_change: number;
  point_id: string;
  value: number;
}

interface GeoLayer {
  layer_name: string;
  depth_top: number;
  depth_bottom: number;
  color: string;
}

interface ProfileData {
  date: string;
  profile: ProfilePoint[];
  layers: GeoLayer[];
}

// ─────────────────────────────────────────────
// 工具函数（分级只读后端 level，不在页面重算阈值）
// ─────────────────────────────────────────────
type RiskLevel = 'alert' | 'warning' | 'normal';

function pointLevel(point?: { level?: string; alert_level?: string } | null): RiskLevel {
  const level = (point?.level || '').toLowerCase();
  if (level === 'alert' || level === 'warning' || level === 'normal') return level;
  // 后端未下发 level 时按正常展示，绝不在这里按中文词或数值重新判级
  return 'normal';
}

function alertColor(level: RiskLevel): string {
  if (level === 'alert') return CHART.danger;
  if (level === 'warning') return CHART.warn;
  return CHART.ok;
}

function alertLabel(level: RiskLevel, levelCn?: string): string {
  if (levelCn) return levelCn;
  if (level === 'alert') return '报警';
  if (level === 'warning') return '预警';
  return '正常';
}

// ─────────────────────────────────────────────
// 施工事件类型
// ─────────────────────────────────────────────
interface ConstructionEvent {
  event_id: number;
  event_date: string;
  event_type: string;
  description: string;
  chainage_start?: number;
  chainage_end?: number;
}

// ─────────────────────────────────────────────
// 英雄区
// ─────────────────────────────────────────────
const TIME_OPTIONS = [
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '60天', value: 60 },
  { label: '90天', value: 90 },
  { label: '全部', value: 0 },
];

interface HeroBarProps {
  points: PointSummary[];
  summary: SettlementSummary | null;
  loading: boolean;
  days: number;
  onDaysChange: (d: number) => void;
  onSelectPoint?: (id: string) => void;
  selectedId?: string | null;
}

function HeroBar({ points, summary, loading, days, onDaysChange, onSelectPoint, selectedId }: HeroBarProps) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <PageHeader
        eyebrow="沉降 · 哪个点不对"
        title="沉降监测"
        description="正在加载点位与纵断面…"
      />
    );
  }

  const alertCount = summary?.alert_count ?? 0;
  const warnCount = summary?.warning_count ?? 0;
  const maxSettlement = summary?.max_settlement ?? null;
  const maxPoint = summary?.max_settlement_point
    ? points.find(p => p.point_id === summary.max_settlement_point)
    : undefined;
  const avgRate = points.length > 0 ? points.reduce((s, p) => s + (p.trend_slope ?? 0), 0) / points.length : 0;
  const normalCount = summary?.normal_count ?? 0;
  const riskTone: 'ok' | 'warn' | 'danger' =
    alertCount > 0 ? 'danger' : warnCount > 0 ? 'warn' : 'ok';

  // KPI: 去掉"报警/预警"（Agent已覆盖），换成监测点总览和正常率
  const compactKpis: Array<{
    label: string;
    value: string;
    unit: string;
    tone: 'info' | 'ok' | 'warn' | 'danger';
    sub: string;
  }> = [
    {
      label: '监测点',
      value: `${points.length}`,
      unit: '个',
      tone: 'info',
      sub: `${normalCount} 正常 / ${alertCount + warnCount} 异常`,
    },
    {
      label: '最大累计沉降',
      value: maxSettlement == null ? '--' : maxSettlement.toFixed(2),
      unit: 'mm',
      tone: riskTone,
      sub: maxPoint ? maxPoint.point_id : '--',
    },
    {
      label: '平均日沉降速率',
      value: avgRate.toFixed(4),
      unit: 'mm/d',
      tone: riskTone,
      sub: '线性回归',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="沉降 · 哪个点不对"
        title="沉降监测"
        description="按风险排序的点位；选中后查看纵断面、多点对比与裂缝联动"
        meta={
          <span className={`ds-chip ${alertCount + warnCount > 0 ? 'ds-chip--warn' : 'ds-chip--ok'}`}>
            {alertCount + warnCount} 个异常点 / 共 {points.length} 点
          </span>
        }
        actions={
          <>
            <div className="ds-seg">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`ds-seg__item ${days === opt.value ? 'ds-seg__item--active' : ''}`}
                  onClick={() => onDaysChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              disabled={!selectedId}
              onClick={() => selectedId && navigate(`/advanced?point=${encodeURIComponent(selectedId)}&metric=settlement&from=settlement`)}
            >
              分析该点 →
            </button>
          </>
        }
      />

      {/* Agent 主位 + KPI */}
      <div className="ds-settlement-hero">
        <div className="ds-settlement-hero__agent">
          <AgentHeroCell onSelectPoint={onSelectPoint} />
        </div>
        <div className="ds-kpi-grid ds-settlement-hero__kpis">
          {compactKpis.map(k => (
            <KpiCard key={k.label} label={k.label} value={k.value} unit={k.unit} sub={k.sub} tone={k.tone} />
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// 左侧监测点列表
// ─────────────────────────────────────────────
interface PointListProps {
  points: PointSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function PointList({ points, loading, selectedId, onSelect }: PointListProps) {
  // 按风险排序：alert > warning > normal，同级按沉降量绝对值排
  const sorted = [...points].sort((a, b) => {
    const order = { alert: 0, warning: 1, normal: 2 };
    const ao = order[pointLevel(a)];
    const bo = order[pointLevel(b)];
    if (ao !== bo) return ao - bo;
    return Math.abs(b.total_change ?? 0) - Math.abs(a.total_change ?? 0);
  });

  return (
    <div className="ds-settlement-points" style={{
      width: 172,
      flexShrink: 0,
      background: 'var(--ds-surface)',
      borderRight: '1px solid var(--ds-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '9px 12px',
        fontSize: 12,
        color: 'var(--ds-accent-text)',
        fontWeight: 600,
        letterSpacing: 0.6,
        flexShrink: 0,
        borderBottom: '1px solid var(--ds-divider)',
      }}>
        监测点 · {points.length} 个
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 12, color: 'var(--ds-text-muted)', fontSize: 12 }}>加载中...</div>
        ) : sorted.map(p => {
          const isSelected = selectedId === p.point_id;
          const level = pointLevel(p);
          const chipClass = level === 'alert' ? 'ds-chip ds-chip--danger'
            : level === 'warning' ? 'ds-chip ds-chip--warn' : 'ds-chip ds-chip--ok';
          const textColor = level === 'alert' ? 'var(--ds-danger-text)'
            : level === 'warning' ? 'var(--ds-warn-text)' : 'var(--ds-ok-text)';
          return (
            <button
              key={p.point_id}
              onClick={() => onSelect(p.point_id)}
              style={{
                width: '100%',
                padding: '7px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                background: isSelected ? 'var(--ds-accent-soft)' : 'transparent',
                border: 'none',
                borderLeft: isSelected ? '2px solid var(--ds-accent-line)' : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--ds-accent-text)' : 'var(--ds-text)' }}>
                  {p.point_id}
                </span>
                <span className={chipClass}>
                  {alertLabel(level, p.level_cn)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: textColor }}>
                  {(p.total_change ?? 0).toFixed(2)} mm
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 隧道纵断面图
// ─────────────────────────────────────────────
interface TunnelProfileChartProps {
  profileData: ProfileData | null;
  selectedId: string | null;
  points: PointSummary[];
  loading: boolean;
  events: ConstructionEvent[];
  availableDates?: string[];
  currentDate?: string;
  onDateChange?: (date: string) => void;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  掘进: CHART.info,
  注浆: CHART.purple,
  衬砌: CHART.orange,
  监测: CHART.ok,
  其他: CHART.gray,
};

function TunnelProfileChart({ profileData, selectedId, points, loading, events, availableDates, currentDate, onDateChange }: TunnelProfileChartProps) {
  const option = useMemo((): EChartsOption => {
    if (!profileData || profileData.profile.length === 0) return {};

    const profile = profileData.profile;
    const layers = profileData.layers;

    // 沉降曲线数据
    const lineData = profile.map(p => [p.chainage_m, p.cumulative_change]);

    // 监测点散点（区分选中/报警状态，细粒度着色）
    const scatterData = profile.map(p => {
      const summary = points.find(s => s.point_id === p.point_id);
      const isSelected = p.point_id === selectedId;
      const alert = pointLevel(summary);
      const color = alertColor(alert);
      return {
        value: [p.chainage_m, p.cumulative_change],
        name: p.point_id,
        itemStyle: {
          color: isSelected ? CHART.accent : color,
          borderColor: isSelected ? CHART.text : 'transparent',
          borderWidth: isSelected ? 2 : 0,
        },
        symbolSize: isSelected ? 14 : 8,
        label: { show: isSelected, formatter: p.point_id, color: CHART.text, fontSize: 11, position: 'top' as const },
        // 附加数据用于 tooltip
        dailyChange: p.daily_change,
        alertLevel: alert,
        levelCn: summary?.level_cn,
      };
    });

    // 地层色带数据（用 bar 系列堆叠）
    const maxChainage = Math.max(...profile.map(p => p.chainage_m));
    const layerSeries = layers.map(layer => ({
      type: 'bar' as const,
      xAxisIndex: 1,
      yAxisIndex: 1,
      stack: 'layers',
      name: layer.layer_name,
      data: [layer.depth_bottom - layer.depth_top],
      barWidth: '100%',
      itemStyle: { color: layer.color, opacity: 0.7 },
      emphasis: { disabled: true },
    }));

    return {
      grid: [
        { left: 60, right: 30, top: 40, bottom: '35%' },   // 上：沉降曲线
        { left: 60, right: 30, top: '72%', bottom: 30 },    // 下：地层
      ],
      tooltip: {
        trigger: 'item',
        backgroundColor: CHART.tooltipBg,
        borderColor: CHART.accentLine,
        textStyle: { color: CHART.text, fontSize: 12 },
        formatter: (params: any) => {
          if (params.seriesIndex === 1 && params.data) {
            const d = params.data;
            const alert = alertLabel(d.alertLevel, d.levelCn);
            return `<b>${d.name}</b><br/>` +
              `里程: ${d.value[0].toFixed(1)} m<br/>` +
              `累计沉降: ${d.value[1].toFixed(2)} mm<br/>` +
              `日变化: ${(d.dailyChange ?? 0).toFixed(3)} mm/d<br/>` +
              `状态: ${alert}`;
          }
          if (params.seriesType === 'bar') {
            return `${params.seriesName}<br/>厚度: ${params.value} m`;
          }
          return '';
        },
      },
      // 上图 X 轴：里程
      xAxis: [
        {
          type: 'value',
          gridIndex: 0,
          name: '里程 (m)',
          nameTextStyle: { color: CHART.text, fontSize: 11 },
          axisLabel: { color: CHART.text, fontSize: 11 },
          axisLine: { lineStyle: { color: CHART.accentLine } },
          splitLine: { lineStyle: { color: CHART.split } },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: ['地层'],
          show: false,
        },
      ],
      // Y 轴
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          name: '累计沉降 (mm)',
          nameTextStyle: { color: CHART.text, fontSize: 11 },
          axisLabel: { color: CHART.text, fontSize: 11 },
          axisLine: { lineStyle: { color: CHART.accentLine } },
          splitLine: { lineStyle: { color: CHART.split } },
        },
        {
          type: 'value',
          gridIndex: 1,
          name: '深度 (m)',
          nameTextStyle: { color: CHART.text, fontSize: 11 },
          axisLabel: { color: CHART.text, fontSize: 11 },
          axisLine: { lineStyle: { color: CHART.accentLine } },
          splitLine: { show: false },
          inverse: true,
        },
      ],
      legend: {
        data: layers.map(l => l.layer_name),
        bottom: 4,
        textStyle: { color: CHART.text, fontSize: 11 },
        itemWidth: 14,
        itemHeight: 10,
      },
      series: ([
        // 沉降曲线
        {
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: lineData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: CHART.accent, width: 2, shadowColor: 'rgba(0,229,255,0.4)', shadowBlur: 6 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.15)' }, { offset: 1, color: 'rgba(0,229,255,0)' }] } },
          markLine: {
            silent: true,
            lineStyle: { type: 'dashed' },
            data: [
              { yAxis: -5, lineStyle: { color: CHART.danger }, label: { formatter: '报警 -5mm', color: CHART.danger, fontSize: 10, position: 'insideEndTop' } },
              { yAxis: -3, lineStyle: { color: CHART.warn }, label: { formatter: '预警 -3mm', color: CHART.warn, fontSize: 10, position: 'insideEndTop' } },
            ],
          },
        },
        // 监测点散点
        {
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: scatterData,
          z: 10,
        },
        // 地层色带
        ...layerSeries,
        // 施工事件标注（竖向区域）
        ...(events.length > 0 ? [{
          type: 'line' as const,
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: [],
          markArea: {
            silent: false,
            emphasis: { disabled: false },
            data: events
              .filter(e => e.chainage_start != null)
              .map(e => {
                const type = e.event_type || '其他';
                const color = EVENT_TYPE_COLORS[type] ?? EVENT_TYPE_COLORS['其他'];
                return [
                  {
                    xAxis: e.chainage_start,
                    itemStyle: { color: `${color}22`, borderColor: `${color}88`, borderWidth: 1 },
                    label: {
                      formatter: `${type}\n${e.event_date?.slice(5, 10) ?? ''}`,
                      color: color,
                      fontSize: 10,
                      position: 'insideTop' as const,
                    },
                  },
                  { xAxis: e.chainage_end ?? (e.chainage_start! + 5) },
                ];
              }),
          },
        }] : []),
      ] as any[]),
    };
  }, [profileData, selectedId, points, events]);

  const state = loading
    ? 'loading'
    : !profileData || profileData.profile.length === 0
      ? 'empty'
      : 'ready';

  return (
    <ChartCard
      title="隧道纵断面"
      icon="chart-line"
      cutoff={profileData?.date}
      state={state}
      emptyText="暂无纵断面数据"
      style={{ flex: 1, minHeight: 0 }}
      extra={
        availableDates && availableDates.length > 1 && onDateChange ? (
          <select
            value={currentDate || profileData?.date || ''}
            onChange={e => onDateChange(e.target.value)}
            style={{
              height: 24,
              fontSize: 11,
              padding: '0 6px',
              background: 'var(--ds-accent-soft)',
              border: '1px solid var(--ds-accent-line)',
              borderRadius: 4,
              color: 'var(--ds-accent-text)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {availableDates.map(d => (
              <option key={d} value={d} style={{ background: 'var(--ds-surface-solid)', color: 'var(--ds-text)' }}>{d}</option>
            ))}
          </select>
        ) : null
      }
    >
      <div style={{ position: 'absolute', inset: '0 8px 4px' }}>
        <EChartsWrapper option={option} notMerge />
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// 多点对比面板
// ─────────────────────────────────────────────
const COMPARE_COLORS = [CHART.accent, CHART.warn, CHART.danger, CHART.purple, CHART.ok];

interface MultiCompareProps {
  allPoints: PointSummary[];
  selectedId: string | null;
  days: number;
  summaryLoaded: boolean;
}

function MultiComparePanel({ allPoints, selectedId, days, summaryLoaded }: MultiCompareProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareErrors, setCompareErrors] = useState<string[]>([]);
  const [seriesData, setSeriesData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  // 当选中点变化时自动加入对比列表（等 summary 加载完再响应）
  useEffect(() => {
    if (!summaryLoaded) return;
    if (selectedId && !compareIds.includes(selectedId)) {
      setCompareIds(prev => [selectedId, ...prev].slice(0, 5));
    }
  }, [selectedId, summaryLoaded]);

  // 获取所有对比点数据（等 summary 加载完，再延迟 800ms 发请求，避免冷启动并发）
  useEffect(() => {
    if (!summaryLoaded || compareIds.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      Promise.all(
        compareIds.map(pid =>
          apiGet<{ timeSeriesData: any[] }>(`/point/${pid}`)
            .then(d => ({ pid, rows: d?.timeSeriesData ?? [] }))
            .catch(() => ({ pid, rows: [], failed: true }))
        )
      ).then(results => {
        if (cancelled) return;
        setCompareErrors(results.filter((r: any) => r.failed).map((r: any) => r.pid));
        const map: Record<string, any[]> = {};
        results.forEach(({ pid, rows }) => {
          if (days > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            map[pid] = rows.filter((r: any) => new Date(r.measurement_date) >= cutoff);
          } else {
            map[pid] = rows;
          }
        });
        setSeriesData(map);
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [compareIds, days, summaryLoaded]);

  const togglePoint = (pid: string) => {
    if (compareIds.includes(pid)) {
      setCompareIds(prev => prev.filter(id => id !== pid));
    } else if (compareIds.length < 5) {
      setCompareIds(prev => [...prev, pid]);
    }
  };

  const option = useMemo((): EChartsOption => {
    const series = compareIds.map((pid, idx) => {
      const rows = seriesData[pid] ?? [];
      return {
        name: pid,
        type: 'line' as const,
        data: rows.map((r: any) => [r.measurement_date, r.cumulative_change ?? 0]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: COMPARE_COLORS[idx % COMPARE_COLORS.length], width: 2 },
        itemStyle: { color: COMPARE_COLORS[idx % COMPARE_COLORS.length] },
      };
    });

    return {
      grid: { left: 55, right: 20, top: 30, bottom: 30 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART.tooltipBg,
        borderColor: CHART.accentLine,
        textStyle: { color: CHART.text, fontSize: 11 },
        formatter: (params: any) => {
          const date = params[0]?.axisValue ?? '';
          return `<b>${date}</b><br/>` + params.map((p: any) =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: ${(p.value[1] ?? 0).toFixed(2)} mm`
          ).join('<br/>');
        },
      },
      legend: {
        data: compareIds,
        top: 2,
        textStyle: { color: CHART.text, fontSize: 11 },
        itemWidth: 12,
        itemHeight: 8,
      },
      xAxis: {
        type: 'time',
        axisLabel: { color: CHART.text, fontSize: 10 },
        axisLine: { lineStyle: { color: CHART.accentLine } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '累计沉降(mm)',
        nameTextStyle: { color: CHART.accent, fontSize: 10 },
        axisLabel: { color: CHART.text, fontSize: 10 },
        axisLine: { lineStyle: { color: CHART.accentLine } },
        splitLine: { lineStyle: { color: CHART.split } },
      },
      series,
    };
  }, [compareIds, seriesData]);

  return (
    <div style={{ flexShrink: 0, border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius)', background: 'var(--ds-surface)', display: 'flex', flexDirection: 'column', height: collapsed ? 38 : '38%', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
        <span style={{ fontSize: 12, color: 'var(--ds-accent-text)', fontWeight: 600 }}>
          多点对比 · {compareIds.length}/5
        </span>
        <span style={{ fontSize: 12, color: 'var(--ds-text-muted)' }}>点击监测点加入对比</span>
        {compareErrors.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--ds-danger-text)' }}>{compareErrors.join('、')} 数据不可用</span>
        )}
        <div style={{ flex: 1 }} />
        {/* 已选标签 */}
        {compareIds.map((pid, idx) => (
          <span
            key={pid}
            onClick={e => { e.stopPropagation(); togglePoint(pid); }}
            style={{
              fontSize: 12,
              padding: '1px 6px',
              borderRadius: 3,
              background: `${COMPARE_COLORS[idx % COMPARE_COLORS.length]}22`,
              border: `1px solid ${COMPARE_COLORS[idx % COMPARE_COLORS.length]}88`,
              color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
              cursor: 'pointer',
            }}
          >{pid} ×</span>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ds-text-muted)', marginLeft: 4 }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>
      {/* 图表区 */}
      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, padding: '0 8px 4px' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--ds-text-muted)', fontSize: 12 }}>加载对比数据...</span>
            </div>
          ) : compareIds.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--ds-text-muted)', fontSize: 12 }}>从左侧列表选择监测点加入对比（最多5个）</span>
            </div>
          ) : (
            <EChartsWrapper option={option} notMerge />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 沉降-裂缝联动面板
// ─────────────────────────────────────────────
interface CrackJointPanelProps {
  selectedId: string | null;
}

function CrackJointPanel({ selectedId }: CrackJointPanelProps) {
  const { data: jointData, loading } = useJointData(selectedId);
  const [collapsed, setCollapsed] = useState(true);

  const hasCracks = jointData && jointData.related_cracks && jointData.related_cracks.length > 0;
  const crackCount = jointData?.related_cracks?.length ?? 0;

  const option = useMemo((): EChartsOption => {
    if (!jointData) return {};

    const sData = jointData.settlement_data || [];
    const cracks = jointData.related_cracks || [];

    if (sData.length === 0) return {};

    const dates = sData.map((d: any) => d.measurement_date);
    const sValues = sData.map((d: any) => d.cumulative_change ?? d.value ?? 0);

    const crackColors = [CHART.crack, CHART.crackWarn, CHART.geology, CHART.teal];
    const crackSeries = cracks.map((c: any, idx: number) => ({
      name: c.crack_point,
      type: 'line' as const,
      yAxisIndex: 1,
      data: (c.data || []).map((d: any) => [d.measurement_date, d.value]),
      lineStyle: { width: 1.5, type: 'dashed' as const, color: crackColors[idx % crackColors.length] },
      itemStyle: { color: crackColors[idx % crackColors.length] },
      symbol: 'circle',
      symbolSize: 3,
      smooth: true,
    }));

    return {
      grid: { left: 55, right: 55, top: 30, bottom: 30 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART.tooltipBg,
        borderColor: CHART.accentLine,
        textStyle: { color: CHART.text, fontSize: 11 },
      },
      legend: {
        data: [selectedId || '', ...cracks.map((c: any) => c.crack_point)],
        top: 2,
        textStyle: { color: CHART.text, fontSize: 10 },
        itemWidth: 12,
        itemHeight: 8,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: CHART.text, fontSize: 10, rotate: 30 },
        axisLine: { lineStyle: { color: CHART.accentLine } },
      },
      yAxis: [
        {
          type: 'value',
          name: '沉降(mm)',
          nameTextStyle: { color: CHART.accent, fontSize: 10 },
          axisLabel: { color: CHART.text, fontSize: 10 },
          axisLine: { lineStyle: { color: CHART.accentLine } },
          splitLine: { lineStyle: { color: CHART.split } },
        },
        {
          type: 'value',
          name: '裂缝(mm)',
          nameTextStyle: { color: CHART.crack, fontSize: 10 },
          axisLabel: { color: CHART.text, fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255,62,95,0.3)' } },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: selectedId || '',
          type: 'line',
          yAxisIndex: 0,
          data: sValues,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: CHART.accent, width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.1)' }, { offset: 1, color: 'rgba(0,229,255,0)' }] } },
        },
        ...crackSeries,
      ],
    };
  }, [jointData, selectedId]);

  if (!selectedId) {
    return (
      <div style={{ flexShrink: 0, border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius)', background: 'var(--ds-surface)' }}>
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ds-text-faint)' }}>
          沉降-裂缝联动 · 选择监测点查看
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flexShrink: 0,
      border: '1px solid var(--ds-border)',
      borderRadius: 'var(--ds-radius)',
      background: 'var(--ds-surface)',
      display: 'flex',
      flexDirection: 'column',
      height: collapsed ? 38 : '38%',
      overflow: 'hidden',
      transition: 'height 0.2s',
    }}>
      {/* 标题栏 — 始终可见 */}
      <div
        style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span style={{ fontSize: 12, color: 'var(--ds-accent-text)', fontWeight: 600 }}>
          沉降-裂缝联动 · {selectedId}
        </span>
        <span style={{ fontSize: 12, color: hasCracks ? 'var(--ds-ok-text)' : 'var(--ds-text-muted)' }}>
          {loading ? '加载中...' : hasCracks ? `${crackCount}条关联裂缝` : '无关联裂缝'}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--ds-text-muted)' }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>
      {/* 图表区 — 折叠时隐藏 */}
      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, padding: '0 8px 4px' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--ds-text-muted)', fontSize: 12 }}>加载联动数据...</span>
            </div>
          ) : !hasCracks ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--ds-text-muted)', fontSize: 12 }}>{selectedId} 无关联裂缝数据</span>
            </div>
          ) : (
            <>
              <EChartsWrapper option={option} notMerge />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────
export default function SettlementV2() {
  const [searchParams] = useSearchParams();
  const pointParam = searchParams.get('point');
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(pointParam);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileDates, setProfileDates] = useState<string[]>([]);
  const [profileDate, setProfileDate] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const [events, setEvents] = useState<ConstructionEvent[]>([]);
  const [summaryError, setSummaryError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [eventsError, setEventsError] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const load = async (url: string): Promise<SummaryResponse> => {
      const raw = await apiGet<SummaryResponse | PointSummary[]>(url);
      if (Array.isArray(raw)) return { points: raw, summary: null };
      return { points: raw?.points ?? [], summary: raw?.summary ?? null };
    };
    try {
      // 先尝试带时间范围；结论字段由后端 rules 模块统一计算
      let data: SummaryResponse | null = null;
      if (days > 0) {
        data = await load(`/summary?days=${days}&with_summary=1`);
      }
      // 如果带 days 返回空（数据超出范围），fallback 到全量
      if (!data || data.points.length === 0) {
        data = await load('/summary?with_summary=1');
      }
      setPoints(data.points);
      setSummary(data.summary);
      setSummaryError('');
      if (data.points.length > 0) {
        setSelectedId(prev => {
          if (prev && data.points.some(p => p.point_id === prev)) return prev;
          return (
            data.points.find(p => pointLevel(p) === 'alert') ??
            data.points.find(p => pointLevel(p) === 'warning') ??
            data.points[0]
          ).point_id;
        });
      }
    } catch (e) {
      console.error('[SettlementV2] fetch summary failed', e);
      setSummaryError('沉降摘要接口不可用，点位列表与结论无法更新');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const fetchProfile = useCallback(async (date?: string) => {
    setProfileLoading(true);
    try {
      const url = date ? `/advanced/profile/data?date=${date}` : '/advanced/profile/data';
      const data = await apiGet<ProfileData>(url);
      setProfileData(data ?? null);
      setProfileError('');
    } catch (e) {
      console.error('[SettlementV2] fetch profile failed', e);
      setProfileError('纵断面数据不可用，剖面图无法更新');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchProfileDates = useCallback(async () => {
    try {
      const data = await apiGet<{ dates: string[] }>('/advanced/profile/dates');
      const dates = data?.dates ?? [];
      setProfileDates(dates);
      setProfileError('');
      if (dates.length > 0 && !profileDate) {
        setProfileDate(dates[dates.length - 1]); // 默认选最新日期
      }
    } catch (e) {
      console.error('[SettlementV2] fetch profile dates failed', e);
      setProfileError('纵断面日期列表不可用');
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const end = new Date().toISOString().slice(0, 10);
      const startDate = new Date();
      if (days > 0) startDate.setDate(startDate.getDate() - days);
      else startDate.setFullYear(startDate.getFullYear() - 10);
      const start = startDate.toISOString().slice(0, 10);
      const data = await apiGet<{ events: ConstructionEvent[] }>(
        `/advanced/events/timeline?start=${start}&end=${end}`
      );
      setEvents(data?.events ?? []);
      setEventsError('');
    } catch (e) {
      console.error('[SettlementV2] fetch events failed', e);
      setEvents([]);
      setEventsError('施工事件时间线不可用');
    }
  }, [days]);

  useEffect(() => { fetchSummary(); fetchProfile(); fetchProfileDates(); }, [fetchSummary, fetchProfile, fetchProfileDates]);
  useEffect(() => { if (profileDate) fetchProfile(profileDate); }, [profileDate, fetchProfile]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <div className="ds-page">
      {/* 顶栏：页头 + KPI + 时间范围 + 下一步 */}
      <HeroBar points={points} summary={summary} loading={loading} days={days} onDaysChange={setDays} onSelectPoint={setSelectedId} selectedId={selectedId} />

      {(summaryError || profileError || eventsError) && (
        <div style={{ flexShrink: 0, padding: '8px 12px 0' }}>
          <StateView
            kind="error"
            compact
            title="部分数据不可用"
            hint={[summaryError, profileError, eventsError].filter(Boolean).join('；')}
            onRetry={() => { fetchSummary(); fetchProfile(profileDate || undefined); fetchProfileDates(); fetchEvents(); }}
          />
        </div>
      )}

      {/* 主体：左侧列表 + 右侧（纵断面图 + 裂缝联动） */}
      <div className="ds-settlement-main" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <PointList
          points={points}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 10,
          overflow: 'hidden',
        }}>
          <TunnelProfileChart
            profileData={profileData}
            selectedId={selectedId}
            points={points}
            loading={profileLoading}
            events={events}
            availableDates={profileDates}
            currentDate={profileDate}
            onDateChange={setProfileDate}
          />
          <MultiComparePanel allPoints={points} selectedId={selectedId} days={days} summaryLoaded={!loading} />
          <CrackJointPanel selectedId={selectedId} />
        </div>
      </div>
    </div>
  );
}
