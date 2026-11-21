import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { LayoutProvider, useLayout } from '../contexts/LayoutContext';
import { OverviewProvider } from '../contexts/OverviewContext';
import { CracksProvider } from '../contexts/CracksContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import type { CardConfig } from '../types/layout';
import { CardLibraryModal } from '../components/overview/CardLibraryModal';
import { getCardById } from '../config/cardRegistry';
import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';
import './Overview.css';

const DEFAULT_CARD_IDS = ['safety-score', 'risk-radar', 'settlement-overview', 'cracks-overview', 'temperature-overview', 'vibration-overview'];

const OverviewDashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cardLibraryOpen, setCardLibraryOpen] = useState(false);
  const { layouts, updateLayout } = useLayout();

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('overview-selected-cards');
    return saved ? JSON.parse(saved) : DEFAULT_CARD_IDS;
  });

  useEffect(() => {
    localStorage.setItem('overview-selected-cards', JSON.stringify(selectedCardIds));
  }, [selectedCardIds]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cards = useMemo((): CardConfig[] => {
    return selectedCardIds
      .map(id => getCardById(id))
      .filter((card): card is CardConfig => card !== undefined)
      .map(card => ({
        ...card,
        component: card.component as React.ComponentType<any>,
      }));
  }, [selectedCardIds]);

  const handleAddCard = useCallback((cardId: string) => {
    if (!selectedCardIds.includes(cardId)) {
      setSelectedCardIds(prev => [...prev, cardId]);

      // 为新卡片设置合理的初始位置（放在当前布局最下面）
      const currentLayout = layouts['overview']?.lg || [];
      const maxY = currentLayout.length > 0
        ? Math.max(...currentLayout.map(item => item.y + item.h))
        : 0;

      const newCard = getCardById(cardId);
      if (newCard) {
        const newLayout = {
          i: cardId,
          x: 0,
          y: maxY,
          w: newCard.defaultLayout.w,
          h: newCard.defaultLayout.h,
          minW: newCard.defaultLayout.minW,
          maxW: newCard.defaultLayout.maxW,
          minH: newCard.defaultLayout.minH,
          maxH: newCard.defaultLayout.maxH,
        };
        updateLayout('overview', 'lg', [...currentLayout, newLayout]);
      }
    }
    setCardLibraryOpen(false);
  }, [selectedCardIds, layouts, updateLayout]);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleRemoveCard = useCallback((cardId: string) => {
    const fixed = new Set(['safety-score', 'risk-radar']);
    if (fixed.has(cardId)) {
      showToast('此卡片为固定卡片，无法移除');
      return;
    }
    setSelectedCardIds(prev => prev.filter(id => id !== cardId));
  }, [showToast]);

  const handleResetCards = useCallback(() => {
    setSelectedCardIds(DEFAULT_CARD_IDS);
    localStorage.removeItem('overview-selected-cards');
    showToast('已重置为默认卡片配置');
  }, [showToast]);

  const selectedCardSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);

  return (
    <div className="overview-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e6f7ff' }}>项目监测数据汇总中心</div>
          <div style={{ fontSize: 14, letterSpacing: 2, color: '#e2e8f0' }}>PROJECT DATA AGGREGATION & MONITORING</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="layout-controls__btn"
            onClick={() => setCardLibraryOpen(true)}
            style={{
              background: 'rgba(100, 255, 218, 0.1)',
              border: '1px solid rgba(100, 255, 218, 0.3)',
              color: '#64ffda',
            }}
          >
            <i className="fas fa-plus-circle" />
            <span>添加卡片</span>
          </button>
          <button
            className="layout-controls__btn"
            onClick={handleResetCards}
          >
            <i className="fas fa-undo" />
            <span>重置</span>
          </button>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 18, color: '#00e5ff' }}>
            {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <DashboardGrid
          pageId="overview"
          cards={cards}
          onRemoveCard={handleRemoveCard}
        />
      </div>

      <CardLibraryModal
        open={cardLibraryOpen}
        selectedCards={selectedCardSet}
        onAddCard={handleAddCard}
        onClose={() => setCardLibraryOpen(false)}
      />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 24px',
          borderRadius: 8, fontSize: 14, zIndex: 9999,
          border: '1px solid rgba(0,229,255,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default function Overview() {
  return (
    <LayoutProvider>
      <OverviewProvider>
        <CracksProvider>
          <OverviewDashboard />
        </CracksProvider>
      </OverviewProvider>
    </LayoutProvider>
  );
}
