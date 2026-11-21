import React from 'react';
import DataPanel from './DataPanel';
import type { StateKind } from './StateView';

export interface ChartCardProps {
  title: React.ReactNode;
  icon?: string;
  /** 数据截止时间（信息架构第 4 节要求每页可见） */
  cutoff?: string | null;
  extra?: React.ReactNode;
  state?: StateKind | 'ready';
  emptyText?: string;
  emptyHint?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * 图表卡：面板 + 数据截止标记。
 * 图表配色统一由 cyberpunkTheme 提供，这里只统一外壳。
 */
export function ChartCard({
  title,
  icon,
  cutoff,
  extra,
  state = 'ready',
  emptyText,
  emptyHint,
  onRetry,
  className = '',
  style,
  children,
}: ChartCardProps) {
  return (
    <DataPanel
      title={title}
      icon={icon}
      state={state}
      emptyText={emptyText}
      emptyHint={emptyHint}
      onRetry={onRetry}
      className={className}
      style={style}
      extra={
        <>
          {cutoff && <span className="ds-chip ds-chip--info">截止 {cutoff}</span>}
          {extra}
        </>
      }
    >
      {children}
    </DataPanel>
  );
}

export default ChartCard;
