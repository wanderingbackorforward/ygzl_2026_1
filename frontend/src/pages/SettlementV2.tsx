import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

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
// 英雄区
// ─────────────────────────────────────────────
interface HeroBarProps {
  points: PointSummary[];
  loading: boolean;
}

function HeroBar({ points, loading }: HeroBarProps) {
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
          borderRight: i < kpis.length - 1 ? '1px solid rgba(0,229,255,0.1)' : 'none',
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
// 右侧占位区（后续批次填充）
// ─────────────────────────────────────────────
function RightPlaceholder({ selectedId }: { selectedId: string | null }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(0,10,25,0.6)', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ color: 'rgba(0,229,255,0.3)', fontSize: 14 }}>
        {selectedId ? `已选中 ${selectedId}` : '请在左侧选择监测点'}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
        隧道纵断面图 · 施工指导 · 科研算法 — 开发中
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

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<PointSummary[]>('/summary');
      setPoints(data ?? []);
      // 默认选中第一个报警点或第一个点
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

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%)',
      overflow: 'hidden',
    }}>
      {/* 顶栏英雄区 */}
      <HeroBar points={points} loading={loading} />

      {/* 主体：左侧列表 + 右侧内容 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <PointList
          points={points}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <RightPlaceholder selectedId={selectedId} />
      </div>
    </div>
  );
}
