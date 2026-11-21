import React, { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import { PageHeader, StateView } from '../common/ui';

interface LedgerPoint {
  point_id: string;
  x_coord: number | null;
  y_coord: number | null;
  z_coord: number | null;
  description: string | null;
  latest_value: number | null;
  latest_daily_change: number | null;
  last_date: string | null;
  record_count: number | null;
  total_change: number | null;
  avg_daily_rate: number | null;
  trend_slope: number | null;
  trend_type: string | null;
  level: 'normal' | 'warning' | 'alert' | null;
  level_cn: string | null;
  reason: string | null;
  trend: 'up' | 'down' | 'stable' | null;
}

interface LedgerResponse {
  points: LedgerPoint[];
  count: number;
  coord_source: 'schematic' | 'surveyed';
  coord_note: string;
  generated_at: string;
}

const LEVEL_CLASS: Record<string, string> = {
  alert: 'ds-chip ds-chip--danger',
  warning: 'ds-chip ds-chip--warn',
  normal: 'ds-chip ds-chip--ok',
};

const TREND_LABEL: Record<string, string> = {
  up: '上升',
  down: '下降',
  stable: '平稳',
};

function day(value?: string | null): string {
  if (!value) return '—';
  return String(value).replace('T', ' ').slice(0, 10);
}

function num(value: number | null | undefined, digits = 2, unit = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)}${unit}`;
}

export default function SettlementLedger() {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    apiGet<LedgerResponse>('/points/ledger')
      .then(setData)
      .catch(() => setFailed(true));
  };

  useEffect(load, []);

  if (failed) {
    return (
      <div className="ds-page">
        <PageHeader eyebrow="沉降 · 点位在哪、状态如何" title="点位台账" />
        <div className="ds-page__body">
          <StateView kind="error" hint="台账接口 /api/points/ledger 不可用；本页不会用演示数据填充" onRetry={load} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ds-page">
        <PageHeader eyebrow="沉降 · 点位在哪、状态如何" title="点位台账" description="正在加载点位与最新实测…" />
        <div className="ds-page__body">
          <StateView kind="loading" />
        </div>
      </div>
    );
  }

  const points = data.points || [];
  const schematic = data.coord_source === 'schematic';
  const latestDate = points.reduce(
    (max, p) => (p.last_date && p.last_date > max ? p.last_date : max),
    ''
  );

  return (
    <div className="ds-page">
      <PageHeader
        eyebrow="沉降 · 点位在哪、状态如何"
        title="点位台账"
        description={`共 ${data.count} 个沉降监测点，数据截至 ${day(latestDate)}`}
        meta={schematic ? <span className="ds-chip ds-chip--warn">坐标为示意布局</span> : null}
      />
      <div className="ds-page__body">
        {points.length === 0 ? (
          <StateView kind="empty" hint="monitoring_points 表没有记录" onRetry={load} />
        ) : (
          <div className="ds-panel">
            <div className="ds-panel__head">
              <span className="ds-panel__title">点位清单</span>
              <span className="ds-panel__subtitle">状态按最新实测与阈值判定，阈值由后端规则统一给出</span>
            </div>
            <div className="ds-only-narrow" style={{ padding: '6px 12px 0', fontSize: 11, color: 'var(--ds-text-faint)' }}>
              手机端可左右滑动表格，查看全部列
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['点位', '最新测次', '最新值 (mm)', '累计变化 (mm)', '日均速率 (mm/d)', '趋势', '状态', '布设说明'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {points.map(p => (
                    <tr key={p.point_id}>
                      <td style={{ ...tdStyle, color: 'var(--ds-accent-text)', fontWeight: 600 }}>{p.point_id}</td>
                      <td style={tdStyle}>{day(p.last_date)}</td>
                      <td style={tdStyle}>{num(p.latest_value)}</td>
                      <td style={tdStyle}>{num(p.total_change)}</td>
                      <td style={tdStyle}>{num(p.avg_daily_rate, 3)}</td>
                      <td style={tdStyle}>{p.trend ? TREND_LABEL[p.trend] || p.trend : '—'}</td>
                      <td style={tdStyle}>
                        <span className={LEVEL_CLASS[p.level || 'normal'] || 'ds-chip'}>{p.level_cn || '未评估'}</span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--ds-text-muted)' }}>
                        {p.description || '未登记'}
                        {schematic && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ds-text-faint)' }}>
                            （坐标为示意）
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ds-text-muted)', borderTop: '1px solid var(--ds-divider)' }}>
              {data.coord_note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--ds-text-muted)',
  background: 'var(--ds-surface-solid)',
  borderBottom: '1px solid var(--ds-border)',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 12px',
  color: 'var(--ds-text-secondary)',
  borderBottom: '1px solid var(--ds-divider)',
};
