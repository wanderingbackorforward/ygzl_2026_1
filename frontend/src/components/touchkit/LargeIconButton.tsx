import React from 'react'

interface LargeIconButtonProps {
  icon: string
  label?: string
  onClick?: () => void
  active?: boolean
  tone?: 'default' | 'danger'
  disabled?: boolean
  title?: string
  /** 只显示图标（更紧凑，工具栏用） */
  iconOnly?: boolean
}

/**
 * 大号图标按钮（≥64px 触控目标）。
 * 替换密集工具栏里的小按钮。
 */
export const LargeIconButton: React.FC<LargeIconButtonProps> = ({
  icon,
  label,
  onClick,
  active = false,
  tone = 'default',
  disabled = false,
  title,
  iconOnly = false,
}) => {
  const cls = [
    'touchkit-icon-btn',
    active ? 'touchkit-icon-btn--active' : '',
    tone === 'danger' ? 'touchkit-icon-btn--danger' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={title || label}
      aria-pressed={active}
    >
      <i className={icon} />
      {!iconOnly && label && <span>{label}</span>}
    </button>
  )
}

export default LargeIconButton
