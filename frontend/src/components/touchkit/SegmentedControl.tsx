import React from 'react'

export type SegmentTone = 'default' | 'danger' | 'warning' | 'normal' | 'info'

export interface SegmentItem {
  key: string
  label: string
  count?: number | string
  icon?: string
  tone?: SegmentTone
}

interface SegmentedControlProps {
  items: SegmentItem[]
  value: string
  onChange: (key: string) => void
  ariaLabel?: string
}

const TONE_COLOR: Record<SegmentTone, string> = {
  default: '#e6f7ff',
  danger: '#ff8b9a',
  warning: '#ffc24d',
  normal: '#7dff9d',
  info: '#7df0ff',
}

/**
 * 大号分段控件（控制室/壁挂档）。
 * 替换密集的小按钮组（如 InSAR 风险筛选、视图切换）。
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({ items, value, onChange, ariaLabel }) => {
  return (
    <div className="touchkit-segmented" role="tablist" aria-label={ariaLabel}>
      {items.map(item => {
        const active = item.key === value
        const color = TONE_COLOR[item.tone || 'default']
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`touchkit-segmented__item ${active ? 'touchkit-segmented__item--active' : ''}`}
            onClick={() => onChange(item.key)}
            style={active && item.tone && item.tone !== 'default' ? { color } : undefined}
          >
            {item.icon && <i className={item.icon} />}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="touchkit-segmented__count" style={active && item.tone && item.tone !== 'default' ? { background: 'rgba(255,255,255,0.18)' } : undefined}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedControl
