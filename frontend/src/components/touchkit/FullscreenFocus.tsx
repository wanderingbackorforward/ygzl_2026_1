import React, { useEffect } from 'react'

interface FullscreenFocusProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  /** 上一项 / 下一项（提供则显示大号翻页按钮） */
  onPrev?: () => void
  onNext?: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  /** 头部右侧额外按钮 */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

/**
 * 大屏全屏聚焦层：替换桌面档里拥挤的窄侧栏。
 * 大号关闭 / 前后翻页按钮（≥64px），点遮罩或 ESC 关闭。
 */
export const FullscreenFocus: React.FC<FullscreenFocusProps> = ({
  isOpen,
  onClose,
  title,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  headerExtra,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && onPrev && !prevDisabled) onPrev()
      else if (e.key === 'ArrowRight' && onNext && !nextDisabled) onNext()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose, onPrev, onNext, prevDisabled, nextDisabled])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', height: '100%', maxWidth: 1500,
          background: 'rgba(10,18,30,0.96)', border: '1px solid var(--wall-panel-border)',
          borderRadius: 14, boxShadow: '0 0 40px rgba(0,229,255,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
          padding: '14px 20px', borderBottom: '1px solid var(--wall-panel-border)',
          background: 'linear-gradient(90deg, rgba(0,229,255,0.05), rgba(0,229,255,0.1), rgba(0,229,255,0.05))',
        }}>
          {onPrev && (
            <button type="button" className="touchkit-nav-btn" onClick={onPrev} disabled={prevDisabled} title="上一个" aria-label="上一个">
              <i className="fas fa-chevron-left" />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--wall-font-title)', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {headerExtra}
          {onNext && (
            <button type="button" className="touchkit-nav-btn" onClick={onNext} disabled={nextDisabled} title="下一个" aria-label="下一个">
              <i className="fas fa-chevron-right" />
            </button>
          )}
          <button type="button" className="touchkit-nav-btn" onClick={onClose} title="关闭" aria-label="关闭" style={{ borderColor: 'rgba(255,62,95,0.45)', color: '#ff8b9a' }}>
            <i className="fas fa-times" />
          </button>
        </div>
        {/* 主体 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default FullscreenFocus
