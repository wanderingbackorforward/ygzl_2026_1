import React from 'react';

export type StateKind = 'loading' | 'empty' | 'nodata' | 'error';

export interface StateViewProps {
  kind: StateKind;
  title?: string;
  hint?: React.ReactNode;
  /** 出错时的重试回调 */
  onRetry?: () => void;
  /** 面板内使用的小尺寸 */
  compact?: boolean;
  className?: string;
}

const DEFAULT_TITLE: Record<StateKind, string> = {
  loading: '加载中…',
  empty: '暂无数据',
  nodata: '该点位无数据',
  error: '数据接口不可用',
};

const DEFAULT_HINT: Partial<Record<StateKind, string>> = {
  empty: '接口已返回，但当前筛选范围内没有记录',
  nodata: '该点位未映射到主表，或采集期外',
  error: '请稍后重试；页面不会用演示数据填充',
};

const ICON: Record<StateKind, string> = {
  loading: 'fa-spinner fa-spin',
  empty: 'fa-inbox',
  nodata: 'fa-database',
  error: 'fa-exclamation-triangle',
};

/**
 * 三态统一视图（信息架构第 5 节）：
 * loading / empty / nodata / error 只有这一种写法。
 */
export function StateView({ kind, title, hint, onRetry, compact, className = '' }: StateViewProps) {
  return (
    <div className={`ds-state ds-state--${kind} ${compact ? 'ds-state--compact' : ''} ${className}`.trim()}>
      <i className={`fas ${ICON[kind]} ds-state__icon`} />
      <div className="ds-state__title">{title || DEFAULT_TITLE[kind]}</div>
      {(hint ?? DEFAULT_HINT[kind]) && <div className="ds-state__hint">{hint ?? DEFAULT_HINT[kind]}</div>}
      {kind === 'error' && onRetry && (
        <button type="button" className="ds-state__action" onClick={onRetry}>
          重新加载
        </button>
      )}
    </div>
  );
}

export default StateView;
