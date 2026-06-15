import React from 'react'

interface TourControlProps {
  active: boolean
  index: number
  total: number
  /** 切换播放/暂停 */
  onToggle: () => void
  onPrev?: () => void
  onNext?: () => void
  disabled?: boolean
}

/**
 * 巡检轮播控制（控制室主角）。
 * 大号 播放/暂停 + 进度 + 上/下，壁挂屏自动逐点推进。
 */
export const TourControl: React.FC<TourControlProps> = ({ active, index, total, onToggle, onPrev, onNext, disabled }) => {
  const safeTotal = Math.max(1, total)
  const pct = Math.min(100, Math.max(0, ((index + 1) / safeTotal) * 100))
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      {onPrev && (
        <button type="button" className="touchkit-icon-btn" onClick={onPrev} disabled={index <= 0} title="上一个" aria-label="上一个">
          <i className="fas fa-step-backward" />
        </button>
      )}
      <button
        type="button"
        className={`touchkit-icon-btn ${active ? 'touchkit-icon-btn--danger' : 'touchkit-icon-btn--active'}`}
        onClick={onToggle}
        disabled={disabled}
        title={active ? '停止巡检' : '开始巡检'}
      >
        <i className={`fas ${active ? 'fa-stop' : 'fa-play'}`} />
        <span>{active ? '停止' : '巡检'}</span>
      </button>
      {onNext && (
        <button type="button" className="touchkit-icon-btn" onClick={onNext} disabled={index >= total - 1} title="下一个" aria-label="下一个">
          <i className="fas fa-step-forward" />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
        <span style={{ fontSize: 16, color: '#e6f7ff', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {index + 1} / {total}
        </span>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--wall-info)', transition: 'width 250ms ease' }} />
        </div>
      </div>
    </div>
  )
}

export default TourControl
