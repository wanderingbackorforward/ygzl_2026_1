import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import { useLayout } from '../../contexts/LayoutContext';
import { CardBase } from '../cards/CardBase';
import type { CardConfig, Breakpoint, LayoutItem } from '../../types/layout';
import { BREAKPOINTS, COLS, ROW_HEIGHT, MARGIN } from '../../types/layout';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface DashboardGridProps {
  pageId: string;
  cards: CardConfig[];
  onCardFullscreen?: (cardId: string) => void;
}

function getCurrentBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  pageId,
  cards,
  onCardFullscreen,
}) => {
  const {
    getPageLayout,
    updateLayout,
    isCardCollapsed,
    toggleCollapse,
    resetLayout,
    setDefaultLayout,
  } = useLayout();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const currentBreakpoint = getCurrentBreakpoint(containerWidth);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Generate default layout from card configs
  const defaultLayout = useMemo((): LayoutItem[] => {
    return cards.map(card => ({
      i: card.id,
      x: card.defaultLayout.x,
      y: card.defaultLayout.y,
      w: card.defaultLayout.w,
      h: card.defaultLayout.h,
      minW: card.defaultLayout.minW,
      maxW: card.defaultLayout.maxW,
      minH: card.defaultLayout.minH,
      maxH: card.defaultLayout.maxH,
      static: card.defaultLayout.static,
    }));
  }, [cards]);

  // Register default layout on mount
  useEffect(() => {
    setDefaultLayout(pageId, currentBreakpoint, defaultLayout);
  }, [pageId, currentBreakpoint, defaultLayout, setDefaultLayout]);

  // Get current layout (saved or default)
  const currentLayout = useMemo(() => {
    const saved = getPageLayout(pageId, currentBreakpoint);
    return saved.length > 0 ? saved : defaultLayout;
  }, [getPageLayout, pageId, currentBreakpoint, defaultLayout]);

  // Handle layout change
  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    const layoutItems: LayoutItem[] = newLayout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      maxW: item.maxW,
      minH: item.minH,
      maxH: item.maxH,
      static: item.static,
    }));
    updateLayout(pageId, currentBreakpoint, layoutItems);
  }, [updateLayout, pageId, currentBreakpoint]);

  // Handle card collapse - adjust height
  const getCardHeight = useCallback((cardId: string, originalHeight: number): number => {
    if (isCardCollapsed(cardId)) {
      return 1; // Collapsed height
    }
    return originalHeight;
  }, [isCardCollapsed]);

  // Adjust layout for collapsed cards
  const adjustedLayout = useMemo((): LayoutItem[] => {
    return currentLayout.map((item: LayoutItem) => ({
      ...item,
      h: getCardHeight(item.i, item.h),
    }));
  }, [currentLayout, getCardHeight]);

  const handleResetLayout = useCallback(() => {
    resetLayout(pageId);
  }, [resetLayout, pageId]);

  return (
    <div className="dashboard-grid" ref={containerRef}>
      {/* Layout Controls */}
      <div className="layout-controls">
        <button className="layout-controls__btn" onClick={handleResetLayout}>
          <i className="fas fa-undo" />
          <span>Reset Layout</span>
        </button>
      </div>

      {/* Grid */}
      <GridLayout
        className="layout"
        layout={adjustedLayout}
        cols={COLS[currentBreakpoint]}
        rowHeight={ROW_HEIGHT}
        width={containerWidth}
        margin={MARGIN}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".dashboard-card__drag-handle"
        resizeHandles={['se']}
        compactType="vertical"
        preventCollision={false}
        isResizable={true}
        isDraggable={true}
        useCSSTransforms={true}
      >
        {cards.map(card => {
          const CardComponent = card.component;
          const cardId = card.id;
          const collapsed = isCardCollapsed(cardId);

          return (
            <div key={cardId} data-grid={adjustedLayout.find(l => l.i === cardId)}>
              <CardBase
                id={cardId}
                title={card.title}
                icon={card.icon}
                collapsed={collapsed}
                onToggleCollapse={() => toggleCollapse(cardId)}
                onFullscreen={() => onCardFullscreen?.(cardId)}
              >
                <CardComponent
                  cardId={cardId}
                  onFullscreen={() => onCardFullscreen?.(cardId)}
                  {...card.props}
                />
              </CardBase>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default DashboardGrid;
