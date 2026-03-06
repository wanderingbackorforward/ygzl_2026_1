import React, { useState, useMemo } from 'react';
import { CARD_REGISTRY, CARD_CATEGORIES, getCardsByCategory } from '../../config/cardRegistry';

interface CardLibraryModalProps {
  open: boolean;
  selectedCards: Set<string>;
  onAddCard: (cardId: string) => void;
  onClose: () => void;
}

export const CardLibraryModal: React.FC<CardLibraryModalProps> = ({
  open,
  selectedCards,
  onAddCard,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(CARD_CATEGORIES[0] || '综合分析');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCards = useMemo(() => {
    const categoryCards = getCardsByCategory(selectedCategory);
    if (!searchQuery.trim()) return categoryCards;

    const query = searchQuery.toLowerCase();
    return categoryCards.filter(card =>
      card.title.toLowerCase().includes(query) ||
      card.description?.toLowerCase().includes(query)
    );
  }, [selectedCategory, searchQuery]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0a192f 0%, #112240 100%)',
          borderRadius: 12,
          border: '1px solid rgba(100, 255, 218, 0.2)',
          maxWidth: 900,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(100, 255, 218, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <i className="fas fa-th-large" style={{ fontSize: 20, color: '#64ffda' }} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e6f7ff' }}>
              卡片库
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8ba0b6',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#8ba0b6';
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(100, 255, 218, 0.1)' }}>
          <div style={{ position: 'relative' }}>
            <i
              className="fas fa-search"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#8ba0b6',
                fontSize: 14,
              }}
            />
            <input
              type="text"
              placeholder="搜索卡片..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(100, 255, 218, 0.2)',
                borderRadius: 6,
                color: '#e6f7ff',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Category Sidebar */}
          <div
            style={{
              width: 180,
              borderRight: '1px solid rgba(100, 255, 218, 0.1)',
              padding: '16px 0',
              overflowY: 'auto',
            }}
          >
            {CARD_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  width: '100%',
                  padding: '10px 20px',
                  background: selectedCategory === category ? 'rgba(100, 255, 218, 0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: selectedCategory === category ? '3px solid #64ffda' : '3px solid transparent',
                  color: selectedCategory === category ? '#64ffda' : '#8ba0b6',
                  fontSize: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: selectedCategory === category ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== category) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = '#e6f7ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== category) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#8ba0b6';
                  }
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Card Grid */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {filteredCards.map((card) => {
                const isAdded = selectedCards.has(card.id);
                return (
                  <div
                    key={card.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(100, 255, 218, 0.15)',
                      borderRadius: 8,
                      padding: 16,
                      cursor: isAdded ? 'not-allowed' : 'pointer',
                      opacity: isAdded ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                    onClick={() => !isAdded && onAddCard(card.id)}
                    onMouseEnter={(e) => {
                      if (!isAdded) {
                        e.currentTarget.style.background = 'rgba(100, 255, 218, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.3)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAdded) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.15)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <i className={card.icon} style={{ fontSize: 18, color: '#64ffda' }} />
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e6f7ff' }}>
                        {card.title}
                      </h3>
                    </div>
                    {card.description && (
                      <p style={{ margin: 0, fontSize: 13, color: '#8ba0b6', lineHeight: 1.5 }}>
                        {card.description}
                      </p>
                    )}
                    {isAdded && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '4px 8px',
                          background: 'rgba(100, 255, 218, 0.15)',
                          borderRadius: 4,
                          fontSize: 12,
                          color: '#64ffda',
                          display: 'inline-block',
                        }}
                      >
                        已添加
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredCards.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 40,
                  color: '#8ba0b6',
                  fontSize: 14,
                }}
              >
                <i className="fas fa-inbox" style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                <div>未找到匹配的卡片</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
