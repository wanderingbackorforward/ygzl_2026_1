import React, { useState, useCallback } from 'react'
import type { CardConfig } from '../../types/layout'
import { FullscreenFocus } from '../touchkit/FullscreenFocus'
import { BorderBox13 } from '../screen/datav/BorderBox13'

/**
 * 单卡片错误边界：避免一张坏卡片拖垮整面墙。
 */
class TileErrorBoundary extends React.Component<
  { children: React.ReactNode; title: string },
  { hasError: boolean; msg: string }
> {
  state = { hasError: false, msg: '' }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, msg: e.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: '#ff8b9a', fontSize: 14 }}>
          「{this.props.title}」加载失败：{this.state.msg}
        </div>
      )
    }
    return this.props.children
  }
}

interface TileGridProps {
  cards: CardConfig[]
}

/**
 * 大屏固定响应式卡片网格（控制室/壁挂档）。
 * 替换桌面档的 react-grid-layout 拖拽/缩放——无拖拽、无缩放、无 collapse。
 * 每张色块内卡片可就地交互；点「展开」进入 FullscreenFocus 大图查看。
 * 消费与 DashboardGrid 同一份 cards: CardConfig[]，页面接线零改动。
 */
export const TileGrid: React.FC<TileGridProps> = ({ cards }) => {
  const [focusId, setFocusId] = useState<string | null>(null)
  const focusCard = cards.find(c => c.id === focusId) || null
  const close = useCallback(() => setFocusId(null), [])

  const renderBody = (card: CardConfig, opts: { fullscreen?: boolean }) => {
    const CardComponent = card.component
    return (
      <TileErrorBoundary title={card.title}>
        <CardComponent
          cardId={card.id}
          onFullscreen={opts.fullscreen ? undefined : () => setFocusId(card.id)}
          {...card.props}
        />
      </TileErrorBoundary>
    )
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gridAutoRows: 'minmax(260px, auto)',
          gap: 'var(--wall-gap)',
          padding: 'var(--wall-gap)',
          height: '100%',
          overflow: 'auto',
          alignContent: 'start',
        }}
      >
        {cards.map(card => (
          <BorderBox13
            key={card.id}
            style={{ minHeight: 'var(--wall-min-target)' }}
            padding={0}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 头部 */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', flexShrink: 0,
                  borderBottom: '1px solid rgba(0,229,255,0.12)',
                  background: 'linear-gradient(90deg, rgba(0,229,255,0.1), transparent 70%)',
                }}
              >
                {card.icon && <i className={card.icon} style={{ fontSize: 20, color: 'var(--wall-info)', textShadow: '0 0 8px rgba(0,229,255,0.6)' }} />}
                <span style={{ flex: 1, fontSize: 'var(--wall-font-lg)', fontWeight: 600, color: '#eafcff', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(0,229,255,0.4)' }}>
                  {card.title}
                </span>
                <button
                  type="button"
                  className="touchkit-icon-btn"
                  onClick={() => setFocusId(card.id)}
                  title="展开"
                  aria-label={`展开 ${card.title}`}
                  style={{ minHeight: 44, minWidth: 44, padding: '0 12px' }}
                >
                  <i className="fas fa-expand" />
                </button>
              </div>
              {/* 主体 */}
              <div style={{ flex: 1, minHeight: 160, padding: 12, overflow: 'auto' }}>
                {renderBody(card, {})}
              </div>
            </div>
          </BorderBox13>
        ))}
      </div>

      <FullscreenFocus isOpen={!!focusCard} onClose={close} title={focusCard?.title}>
        {focusCard && <div style={{ height: '100%' }}>{renderBody(focusCard, { fullscreen: true })}</div>}
      </FullscreenFocus>
    </>
  )
}

export default TileGrid
