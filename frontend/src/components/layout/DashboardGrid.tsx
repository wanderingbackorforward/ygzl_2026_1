import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import { useLayout } from '../../contexts/LayoutContext';
import { CardBase } from '../cards/CardBase';
import { MobileCardSwitcher } from './MobileCardSwitcher';
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
    layouts,
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
      x: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).x,
      y: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).y,
      w: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).w,
      h: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).h,
      minW: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).minW,
      maxW: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).maxW,
      minH: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).minH,
      maxH: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).maxH,
      static: (card.defaultLayouts?.[currentBreakpoint] ?? card.defaultLayout).static,
    }));
  }, [cards, currentBreakpoint]);

  // Register default layout on mount
  useEffect(() => {
    setDefaultLayout(pageId, currentBreakpoint, defaultLayout);
  }, [pageId, currentBreakpoint, defaultLayout, setDefaultLayout]);

  // Get current layout (saved or default)
  const currentLayout = useMemo(() => {
    const cols = COLS[currentBreakpoint];
    const saved = layouts[pageId]?.[currentBreakpoint];
    const isSavedLayoutValid = (layout: LayoutItem[]): boolean => {
      return layout.every(item => (
        Number.isFinite(item.x) &&
        Number.isFinite(item.y) &&
        Number.isFinite(item.w) &&
        Number.isFinite(item.h) &&
        item.x >= 0 &&
        item.y >= 0 &&
        item.w > 0 &&
        item.h > 0 &&
        item.x + item.w <= cols
      ));
    };

    if (saved && saved.length > 0 && isSavedLayoutValid(saved)) {
      return saved;
    }

    return defaultLayout;
  }, [currentBreakpoint, defaultLayout, layouts, pageId]);

  // Handle layout change
  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    const layoutItems: LayoutItem[] = newLayout.map(item => {
      const prev = currentLayout.find(l => l.i === item.i);
      const collapsed = isCardCollapsed(item.i);
      return {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: collapsed && prev ? prev.h : item.h,
        minW: item.minW,
        maxW: item.maxW,
        minH: item.minH,
        maxH: item.maxH,
        static: item.static,
      };
    });
    updateLayout(pageId, currentBreakpoint, layoutItems);
  }, [updateLayout, pageId, currentBreakpoint, currentLayout, isCardCollapsed]);

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

  // 移动端 (<768px) 使用卡片切换器模式
  const isMobile = containerWidth > 0 && containerWidth < 768;

  // 移动端渲染
  if (isMobile) {
    return (
      <div className="dashboard-grid" ref={containerRef}>
        <MobileCardSwitcher cards={cards} />
      </div>
    );
  }

  // 桌面端渲染（原有逻辑不变）
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
