import React, { useEffect, useRef, useState } from 'react';
import { MobileCardSwitcher } from './MobileCardSwitcher';
import { TileGrid } from './TileGrid';
import type { CardConfig } from '../../types/layout';

interface DashboardGridProps {
  pageId: string;
  cards: CardConfig[];
  onCardFullscreen?: (cardId: string) => void;
  onRemoveCard?: (cardId: string) => void;
}

/**
 * 仪表盘容器（统一大屏触控设计后）：
 *   - 窄屏（<768px，含手机 APK）→ MobileCardSwitcher（单卡 + 底部切换）
 *   - 其余（桌面/iPad/壁挂）→ TileGrid（固定响应式大色块网格，点按全屏）
 *
 * 桌面 react-grid-layout 拖拽/缩放已移除。pageId/onCardFullscreen 等入参保留兼容，不再消费。
 */
export const DashboardGrid: React.FC<DashboardGridProps> = ({ cards }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const isMobile = containerWidth > 0 && containerWidth < 768;

  return (
    <div className="dashboard-grid" ref={containerRef}>
      {isMobile ? <MobileCardSwitcher cards={cards} /> : <TileGrid cards={cards} />}
    </div>
  );
};

export default DashboardGrid;
