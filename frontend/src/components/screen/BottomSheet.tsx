import React, { useEffect, useRef, useState } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  headerExtra?: React.ReactNode
  children: React.ReactNode
  /** 抽屉高度，如 '82vh' */
  height?: string
}

/**
 * iPad 风格底部抽屉：从底部滑入，顶部抓手，按住抓手/标题区下拉关闭，
 * 点遮罩或 ✕ 关闭。Pointer 事件统一鼠标+触屏。
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen, onClose, title, onPrev, onNext, prevDisabled, nextDisabled, headerExtra, children, height = '82vh',
}) => {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    setDragY(0)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const dy = e.clientY - startY.current
      if (dy > 0) setDragY(dy)
    }
    const up = (e: PointerEvent) => {
      const dy = e.clientY - startY.current
      setDragging(false)
      if (dy > 120) onClose()
      else setDragY(0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging, onClose])

  if (!isOpen) return null

  const startDrag = (e: React.PointerEvent) => { startY.current = e.clientY; setDragging(true) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }} />
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height, maxHeight: '92vh',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 280ms cubic-bezier(.4,1,.49,.98)',
          background: 'linear-gradient(180deg, rgba(16,32,64,.96), rgba(8,18,38,.98))',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          border: '1px solid rgba(0,229,255,.3)', borderBottom: 'none',
          boxShadow: '0 -10px 40px rgba(0,0,0,.5), 0 0 30px rgba(0,229,255,.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* 抓手 + 标题区（可下拉） */}
        <div onPointerDown={startDrag} style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
            <div style={{ width: 46, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.32)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 18px 12px', borderBottom: '1px solid rgba(0,229,255,.14)' }}>
            {onPrev && <button type="button" className="touchkit-nav-btn" onClick={onPrev} disabled={prevDisabled} aria-label="上一个"><i className="fas fa-chevron-left" /></button>}
            <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--wall-font-lg)', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {headerExtra}
            {onNext && <button type="button" className="touchkit-nav-btn" onClick={onNext} disabled={nextDisabled} aria-label="下一个"><i className="fas fa-chevron-right" /></button>}
            <button type="button" className="touchkit-nav-btn" onClick={onClose} aria-label="关闭" style={{ borderColor: 'rgba(255,62,95,.45)', color: '#ff8b9a' }}><i className="fas fa-times" /></button>
          </div>
        </div>
        {/* 主体 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>{children}</div>
      </div>
    </div>
  )
}

export default BottomSheet
