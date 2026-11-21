import React from 'react';

export interface PageHeaderProps {
  /** 本页只回答的那个问题 */
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  /** 数据截止、口径等标记 */
  meta?: React.ReactNode;
  /** 下一步按钮组 */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 页头：标题 + 数据截止 + 下一步（信息架构第 4 节固定三段）。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`ds-page-header ${className}`.trim()}>
      <div className="ds-page-header__main">
        {eyebrow && <span className="ds-page-header__eyebrow">{eyebrow}</span>}
        <h1 className="ds-page-header__title">{title}</h1>
        {description && <span className="ds-page-header__desc">{description}</span>}
      </div>
      {meta && <div className="ds-page-header__meta">{meta}</div>}
      {actions && <div className="ds-page-header__actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
