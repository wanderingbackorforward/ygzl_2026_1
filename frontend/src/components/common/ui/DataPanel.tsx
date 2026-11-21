import React from 'react';
import StateView, { type StateKind } from './StateView';

export interface DataPanelProps {
  title?: React.ReactNode;
  icon?: string;
  subtitle?: React.ReactNode;
  /** 标题右侧的工具区（时间范围、下拉等） */
  extra?: React.ReactNode;
  /** 面板状态：ready 之外都渲染统一三态 */
  state?: StateKind | 'ready';
  emptyText?: string;
  emptyHint?: React.ReactNode;
  errorText?: string;
  onRetry?: () => void;
  /** 内容区是否加内边距 */
  pad?: boolean;
  scroll?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * 数据面板：标题 + 工具区 + 三态 + 内容。
 * 同一页不允许再出现第二种"卡片外壳"写法。
 */
export function DataPanel({
  title,
  icon,
  subtitle,
  extra,
  state = 'ready',
  emptyText,
  emptyHint,
  errorText,
  onRetry,
  pad,
  scroll,
  className = '',
  bodyClassName = '',
  style,
  children,
}: DataPanelProps) {
  const bodyCls = [
    'ds-panel__body',
    pad ? 'ds-panel__body--pad' : '',
    scroll ? 'ds-panel__body--scroll' : '',
    bodyClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`ds-panel ${className}`.trim()} style={style}>
      {(title || extra) && (
        <div className="ds-panel__head">
          {title && (
            <span className="ds-panel__title">
              {icon && <i className={`fas ${icon}`} />}
              {title}
            </span>
          )}
          {subtitle && <span className="ds-panel__subtitle">{subtitle}</span>}
          <span className="ds-panel__spacer" />
          {extra}
        </div>
      )}
      <div className={bodyCls}>
        {state === 'ready' ? (
          children
        ) : (
          <StateView
            kind={state}
            title={state === 'empty' ? emptyText : state === 'error' ? errorText : undefined}
            hint={state === 'empty' ? emptyHint : undefined}
            onRetry={onRetry}
            compact
          />
        )}
      </div>
    </div>
  );
}

export default DataPanel;
