import React from 'react';

export type KpiTone = 'default' | 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  tone?: KpiTone;
  /** 可点击进入下一层 */
  onClick?: () => void;
  active?: boolean;
  title?: string;
  /** 紧凑尺寸：面板内多列 KPI 使用 */
  compact?: boolean;
  className?: string;
}

/**
 * KPI 卡片：全站唯一写法。
 * 只放能复算的数字，口径见 运维/杨高中路/指标口径.md。
 */
export function KpiCard({
  label,
  value,
  unit,
  sub,
  tone = 'default',
  onClick,
  active,
  title,
  compact,
  className = '',
}: KpiCardProps) {
  const cls = [
    'ds-kpi',
    tone !== 'default' ? `ds-kpi--${tone}` : '',
    active ? 'ds-kpi--active' : '',
    compact ? 'ds-kpi--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span className="ds-kpi__label">{label}</span>
      <span className="ds-kpi__value">
        {value}
        {unit && <span className="ds-kpi__unit">{unit}</span>}
      </span>
      {sub && <span className="ds-kpi__sub">{sub}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} title={title}>
        {body}
      </button>
    );
  }

  return (
    <div className={cls} title={title}>
      {body}
    </div>
  );
}

export default KpiCard;
