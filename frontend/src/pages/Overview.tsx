import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { LayoutProvider, useLayout } from '../contexts/LayoutContext';
import { OverviewProvider } from '../contexts/OverviewContext';
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
  const { layouts } = useLayout();

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
    }
    setCardLibraryOpen(false);
  }, [selectedCardIds]);

  const handleRemoveCard = useCallback((cardId: string) => {
    const fixed = new Set(['safety-score', 'risk-radar']);
    if (fixed.has(cardId)) {
      alert('此卡片为固定卡片，无法移除');
      return;
    }
    if (window.confirm(`确认移除"${getCardById(cardId)?.title}"卡片？`)) {
      setSelectedCardIds(prev => prev.filter(id => id !== cardId));
    }
  }, []);

  const handleResetCards = useCallback(() => {
    if (window.confirm('确认重置为默认卡片配置？')) {
      setSelectedCardIds(DEFAULT_CARD_IDS);
      localStorage.removeItem('overview-selected-cards');
    }
  }, []);

  const selectedCardSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);

  return (
    <div className="overview-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e6f7ff' }}>项目监测数据汇总中心</div>
          <div style={{ fontSize: 12, letterSpacing: 2, color: '#8ba0b6' }}>PROJECT DATA AGGREGATION & MONITORING</div>
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
    </div>
  );
};

export default function Overview() {
  return (
    <LayoutProvider>
      <OverviewProvider>
        <OverviewDashboard />
      </OverviewProvider>
    </LayoutProvider>
  );
}
