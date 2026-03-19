import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet } from '../lib/api';
import { EChartsWrapper } from '../components/charts/EChartsWrapper';
import { useJointData } from '../hooks/useAdvancedAnalysis';
import type { EChartsOption } from 'echarts';

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
// 工具函数
// ─────────────────────────────────────────────
function alertColor(level: string): string {
  if (level === 'alert') return '#f87171';
  if (level === 'warning') return '#fbbf24';
  return '#34d399';
}

function alertLabel(level: string): string {
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
  loading: boolean;
  days: number;
  onDaysChange: (d: number) => void;
}

function HeroBar({ points, loading, days, onDaysChange }: HeroBarProps) {
  if (loading) {
    return (
      <div style={{ background: 'rgba(0,30,60,0.9)', borderBottom: '1px solid rgba(0,229,255,0.15)', padding: '10px 20px', display: 'flex', gap: 32, alignItems: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>加载中...</span>
      </div>
    );
  }

  const alertCount = points.filter(p => p.alert_level === 'alert').length;
  const warnCount = points.filter(p => p.alert_level === 'warning').length;
  const maxSettlement = points.length > 0 ? Math.min(...points.map(p => p.total_change ?? 0)) : 0;
  const maxPoint = points.find(p => p.total_change === maxSettlement);
  const avgRate = points.length > 0 ? points.reduce((s, p) => s + (p.trend_slope ?? 0), 0) / points.length : 0;

  // 健康评分：100分 - 报警点*15 - 预警点*8
  const healthScore = Math.max(0, 100 - alertCount * 15 - warnCount * 8);
  const healthColor = healthScore >= 80 ? '#34d399' : healthScore >= 60 ? '#fbbf24' : '#f87171';

  const kpis = [
    {
      label: '系统健康度',
      value: `${healthScore}分`,
      color: healthColor,
      sub: `${points.length}个监测点`,
    },
    {
      label: '报警',
      value: alertCount,
      color: alertCount > 0 ? '#f87171' : '#34d399',
      sub: '超报警阈值',
    },
    {
      label: '预警',
      value: warnCount,
      color: warnCount > 0 ? '#fbbf24' : '#34d399',
      sub: '超警戒阈值',
    },
    {
      label: '最大累计沉降',
      value: `${maxSettlement.toFixed(2)} mm`,
      color: maxSettlement < -5 ? '#f87171' : maxSettlement < -3 ? '#fbbf24' : '#34d399',
      sub: maxPoint ? maxPoint.point_id : '--',
    },
    {
      label: '平均日沉降速率',
      value: `${avgRate.toFixed(4)} mm/d`,
      color: Math.abs(avgRate) > 0.08 ? '#f87171' : Math.abs(avgRate) > 0.03 ? '#fbbf24' : '#34d399',
      sub: '线性回归',
    },
  ];

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(0,20,50,0.95) 0%, rgba(0,30,60,0.9) 100%)',
      borderBottom: '1px solid rgba(0,229,255,0.15)',
      padding: '8px 20px',
      display: 'flex',
      gap: 0,
      alignItems: 'stretch',
      flexShrink: 0,
    }}>
      {kpis.map((k, i) => (
        <div key={k.label} style={{
          flex: 1,
          borderRight: '1px solid rgba(0,229,255,0.1)',
          padding: '4px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{k.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{k.sub}</div>
        </div>
      ))}
      {/* 时间范围选择器 */}
      <div style={{ flexShrink: 0, padding: '4px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>时间范围</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onDaysChange(opt.value)}
              style={{
                padding: '3px 8px',
                fontSize: 12,
                borderRadius: 4,
                border: `1px solid ${days === opt.value ? 'rgba(0,229,255,0.8)' : 'rgba(0,229,255,0.2)'}`,
                background: days === opt.value ? 'rgba(0,229,255,0.15)' : 'transparent',
                color: days === opt.value ? '#00e5ff' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontWeight: days === opt.value ? 600 : 400,
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>
    </div>
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
    const ao = order[a.alert_level as keyof typeof order] ?? 2;
    const bo = order[b.alert_level as keyof typeof order] ?? 2;
    if (ao !== bo) return ao - bo;
    return Math.abs(b.total_change ?? 0) - Math.abs(a.total_change ?? 0);
  });

  return (
    <div style={{
      width: 160,
      flexShrink: 0,
      background: 'rgba(0,15,35,0.8)',
      borderRight: '1px solid rgba(0,229,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px 6px', fontSize: 11, color: 'rgba(0,229,255,0.6)', fontWeight: 600, letterSpacing: 1, flexShrink: 0 }}>
        监测点 · {points.length}个
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 12, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>加载中...</div>
        ) : sorted.map(p => {
          const isSelected = selectedId === p.point_id;
          const color = alertColor(p.alert_level);
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
                background: isSelected ? 'rgba(0,229,255,0.1)' : 'transparent',
                border: 'none',
                borderLeft: isSelected ? '2px solid rgba(0,229,255,0.8)' : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#00e5ff' : '#fff' }}>
                  {p.point_id}
                </span>
                <span style={{
                  fontSize: 10,
                  color: color,
                  background: `${color}22`,
                  border: `1px solid ${color}55`,
                  borderRadius: 3,
                  padding: '1px 4px',
                }}>
                  {alertLabel(p.alert_level)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                {(p.total_change ?? 0).toFixed(2)} mm
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
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  掘进: '#38bdf8',
  注浆: '#a78bfa',
  衬砌: '#fb923c',
  监测: '#34d399',
  其他: '#94a3b8',
};

function TunnelProfileChart({ profileData, selectedId, points, loading, events }: TunnelProfileChartProps) {
  const option = useMemo((): EChartsOption => {
    if (!profileData || profileData.profile.length === 0) return {};

    const profile = profileData.profile;
    const layers = profileData.layers;

    // 沉降曲线数据
    const lineData = profile.map(p => [p.chainage_m, p.cumulative_change]);

    // 监测点散点（区分选中/报警状态）
    const scatterData = profile.map(p => {
      const summary = points.find(s => s.point_id === p.point_id);
      const isSelected = p.point_id === selectedId;
      const alert = summary?.alert_level ?? 'normal';
      const color = alert === 'alert' ? '#f87171' : alert === 'warning' ? '#fbbf24' : '#34d399';
      return {
        value: [p.chainage_m, p.cumulative_change],
        name: p.point_id,
        itemStyle: {
          color: isSelected ? '#00e5ff' : color,
          borderColor: isSelected ? '#fff' : 'transparent',
          borderWidth: isSelected ? 2 : 0,
        },
        symbolSize: isSelected ? 14 : 8,
        label: { show: isSelected, formatter: p.point_id, color: '#fff', fontSize: 11, position: 'top' as const },
        // 附加数据用于 tooltip
        dailyChange: p.daily_change,
        alertLevel: alert,
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
        backgroundColor: 'rgba(10,20,40,0.95)',
        borderColor: 'rgba(0,229,255,0.3)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: any) => {
          if (params.seriesIndex === 1 && params.data) {
            const d = params.data;
            const alert = d.alertLevel === 'alert' ? '报警' : d.alertLevel === 'warning' ? '预警' : '正常';
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
          nameTextStyle: { color: '#fff', fontSize: 11 },
          axisLabel: { color: '#fff', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
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
          nameTextStyle: { color: '#fff', fontSize: 11 },
          axisLabel: { color: '#fff', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        {
          type: 'value',
          gridIndex: 1,
          name: '深度 (m)',
          nameTextStyle: { color: '#fff', fontSize: 11 },
          axisLabel: { color: '#fff', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
          splitLine: { show: false },
          inverse: true,
        },
      ],
      legend: {
        data: layers.map(l => l.layer_name),
        bottom: 4,
        textStyle: { color: '#fff', fontSize: 11 },
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
          lineStyle: { color: '#00e5ff', width: 2, shadowColor: 'rgba(0,229,255,0.4)', shadowBlur: 6 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.15)' }, { offset: 1, color: 'rgba(0,229,255,0)' }] } },
          markLine: {
            silent: true,
            lineStyle: { type: 'dashed' },
            data: [
              { yAxis: -5, lineStyle: { color: '#f87171' }, label: { formatter: '报警 -5mm', color: '#f87171', fontSize: 10, position: 'insideEndTop' } },
              { yAxis: -3, lineStyle: { color: '#fbbf24' }, label: { formatter: '预警 -3mm', color: '#fbbf24', fontSize: 10, position: 'insideEndTop' } },
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

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.6)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>加载纵断面数据...</span>
      </div>
    );
  }

  if (!profileData || profileData.profile.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.6)' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>暂无纵断面数据</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(0,10,25,0.6)' }}>
      <div style={{ padding: '8px 16px 0', fontSize: 12, color: 'rgba(0,229,255,0.6)', fontWeight: 600, flexShrink: 0 }}>
        隧道纵断面 · {profileData.date}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '0 8px 4px' }}>
        <EChartsWrapper option={option} notMerge />
      </div>
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

  const option = useMemo((): EChartsOption => {
    if (!jointData) return {};

    const sData = jointData.settlement_data || [];
    const cracks = jointData.related_cracks || [];

    if (sData.length === 0) return {};

    const dates = sData.map((d: any) => d.measurement_date);
    const sValues = sData.map((d: any) => d.cumulative_change ?? d.value ?? 0);

    const crackColors = ['#ff3e5f', '#ff9e0d', '#bf5af2', '#00d8c9'];
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
        backgroundColor: 'rgba(10,20,40,0.95)',
        borderColor: 'rgba(0,229,255,0.3)',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      legend: {
        data: [selectedId || '', ...cracks.map((c: any) => c.crack_point)],
        top: 2,
        textStyle: { color: '#fff', fontSize: 10 },
        itemWidth: 12,
        itemHeight: 8,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: '#fff', fontSize: 10, rotate: 30 },
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '沉降(mm)',
          nameTextStyle: { color: '#00e5ff', fontSize: 10 },
          axisLabel: { color: '#fff', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        {
          type: 'value',
          name: '裂缝(mm)',
          nameTextStyle: { color: '#ff3e5f', fontSize: 10 },
          axisLabel: { color: '#fff', fontSize: 10 },
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
          lineStyle: { color: '#00e5ff', width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,255,0.1)' }, { offset: 1, color: 'rgba(0,229,255,0)' }] } },
        },
        ...crackSeries,
      ],
    };
  }, [jointData, selectedId]);

  if (!selectedId) {
    return (
      <div style={{ height: '40%', flexShrink: 0, borderTop: '1px solid rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.6)' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>选择监测点查看裂缝联动</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: '40%', flexShrink: 0, borderTop: '1px solid rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.6)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>加载联动数据...</span>
      </div>
    );
  }

  const hasCracks = jointData && jointData.related_cracks && jointData.related_cracks.length > 0;

  if (!hasCracks) {
    return (
      <div style={{ height: '40%', flexShrink: 0, borderTop: '1px solid rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.6)' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{selectedId} 无关联裂缝数据</span>
      </div>
    );
  }

  return (
    <div style={{ height: '40%', flexShrink: 0, borderTop: '1px solid rgba(0,229,255,0.1)', display: 'flex', flexDirection: 'column', background: 'rgba(0,10,25,0.6)' }}>
      <div style={{ padding: '6px 16px 0', fontSize: 12, color: 'rgba(0,229,255,0.6)', fontWeight: 600, flexShrink: 0 }}>
        沉降-裂缝联动 · {selectedId} · {jointData!.related_cracks.length}条关联裂缝
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '0 8px 2px' }}>
        <EChartsWrapper option={option} notMerge />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────
export default function SettlementV2() {
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [days, setDays] = useState<number>(30);
  const [events, setEvents] = useState<ConstructionEvent[]>([]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<PointSummary[]>('/summary');
      setPoints(data ?? []);
      if (data && data.length > 0 && !selectedId) {
        const first = data.find(p => p.alert_level === 'alert') ?? data[0];
        setSelectedId(first.point_id);
      }
    } catch (e) {
      console.error('[SettlementV2] fetch summary failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await apiGet<ProfileData>('/advanced/profile/data');
      setProfileData(data ?? null);
    } catch (e) {
      console.error('[SettlementV2] fetch profile failed', e);
    } finally {
      setProfileLoading(false);
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
    } catch (e) {
      console.error('[SettlementV2] fetch events failed', e);
      setEvents([]);
    }
  }, [days]);

  useEffect(() => { fetchSummary(); fetchProfile(); }, [fetchSummary, fetchProfile]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%)',
      overflow: 'hidden',
    }}>
      {/* 顶栏英雄区 + 时间范围选择器 */}
      <HeroBar points={points} loading={loading} days={days} onDaysChange={setDays} />

      {/* 主体：左侧列表 + 右侧（纵断面图 + 裂缝联动） */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <PointList
          points={points}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TunnelProfileChart
            profileData={profileData}
            selectedId={selectedId}
            points={points}
            loading={profileLoading}
            events={events}
          />
          <CrackJointPanel selectedId={selectedId} />
        </div>
      </div>
    </div>
  );
}
