import React, { useState, useCallback, useRef, TouchEvent } from 'react';
import type { CardConfig } from '../../types/layout';
import './MobileCardSwitcher.css';

interface MobileCardSwitcherProps {
    cards: CardConfig[];
}

/**
 * 移动端卡片切换器组件
 * 仅在 <768px 屏幕宽度下由 DashboardGrid 渲染
 * 支持标签点击和左右滑动切换卡片
 */
export const MobileCardSwitcher: React.FC<MobileCardSwitcherProps> = ({ cards }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);

    const currentCard = cards[activeIndex];

    // 切换到指定卡片
    const switchToCard = useCallback((index: number) => {
        if (index === activeIndex || index < 0 || index >= cards.length) return;

        setSlideDirection(index > activeIndex ? 'left' : 'right');
        setActiveIndex(index);

        // 清除动画类
        setTimeout(() => setSlideDirection(null), 250);
    }, [activeIndex, cards.length]);

    // 触摸滑动处理
    const handleTouchStart = useCallback((e: TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    }, []);

    const handleTouchEnd = useCallback(() => {
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50; // 最小滑动距离

        if (Math.abs(diff) > threshold) {
            if (diff > 0 && activeIndex < cards.length - 1) {
                // 向左滑 -> 下一张
                switchToCard(activeIndex + 1);
            } else if (diff < 0 && activeIndex > 0) {
                // 向右滑 -> 上一张
                switchToCard(activeIndex - 1);
            }
        }
    }, [activeIndex, cards.length, switchToCard]);

    if (!currentCard) return null;

    const CardComponent = currentCard.component;

    return (
        <div className="mobile-card-switcher">
            {/* 标签导航栏 */}
            <div className="mobile-tabs">
                {cards.map((card, index) => (
                    <button
                        key={card.id}
                        className={`mobile-tab ${index === activeIndex ? 'active' : ''}`}
                        onClick={() => switchToCard(index)}
                    >
                        {card.icon && <i className={card.icon} />}
                        <span>{card.title}</span>
                    </button>
                ))}
            </div>

            {/* 卡片内容区域 */}
            <div
                className={`mobile-card-content ${slideDirection ? `slide-${slideDirection}` : ''}`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="mobile-card-wrapper">
                    <div className="mobile-card-header">
                        {currentCard.icon && <i className={currentCard.icon} />}
                        <span>{currentCard.title}</span>
                    </div>
                    <div className="mobile-card-body">
                        <CardComponent cardId={currentCard.id} {...currentCard.props} />
                    </div>
                </div>
            </div>

            {/* 页码指示器 */}
            <div className="mobile-page-indicator">
                {cards.map((_, index) => (
                    <div
                        key={index}
                        className={`mobile-page-dot ${index === activeIndex ? 'active' : ''}`}
                        onClick={() => switchToCard(index)}
                    />
                ))}
            </div>
        </div>
    );
};

export default MobileCardSwitcher;
