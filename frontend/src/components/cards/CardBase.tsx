import React, { useState, useCallback } from 'react';

export interface CardBaseProps {
  id: string;
  title: string;
  icon?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onFullscreen?: () => void;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}

export const CardBase: React.FC<CardBaseProps> = ({
  id,
  title,
  icon,
  collapsed = false,
  onToggleCollapse,
  onFullscreen,
  loading = false,
  error = null,
  children,
  className = '',
  headerExtra,
}) => {
  const handleCollapseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse?.();
  }, [onToggleCollapse]);

  const handleFullscreenClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFullscreen?.();
  }, [onFullscreen]);

  return (
    <div
      className={`dashboard-card ${collapsed ? 'dashboard-card--collapsed' : ''} ${className}`}
      data-card-id={id}
    >
      {/* Header */}
      <div className="dashboard-card__header">
        <div className="dashboard-card__header-left">
          <span className="dashboard-card__drag-handle">
            <i className="fas fa-grip-vertical" />
          </span>
          {icon && <i className={`dashboard-card__icon ${icon}`} />}
          <span className="dashboard-card__title">{title}</span>
        </div>

        <div className="dashboard-card__actions">
          {headerExtra}

          {onToggleCollapse && (
            <button
              className={`dashboard-card__action-btn ${collapsed ? 'dashboard-card__action-btn--active' : ''}`}
              onClick={handleCollapseClick}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <i className={`fas fa-${collapsed ? 'chevron-down' : 'chevron-up'}`} />
            </button>
          )}

          {onFullscreen && !collapsed && (
            <button
              className="dashboard-card__action-btn"
              onClick={handleFullscreenClick}
              title="Fullscreen"
            >
              <i className="fas fa-expand" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="dashboard-card__body">
          {loading ? (
            <div className="dashboard-card__loading">
              <div className="dashboard-card__loading-spinner" />
            </div>
          ) : error ? (
            <div className="dashboard-card__error">
              <i className="fas fa-exclamation-triangle dashboard-card__error-icon" />
              <span>{error}</span>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

export default CardBase;
