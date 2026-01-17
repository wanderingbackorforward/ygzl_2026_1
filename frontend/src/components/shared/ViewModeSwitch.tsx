import React from 'react';
import type { ViewMode } from '../../hooks/useViewMode';

type Props = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  legacyLabel?: string;
  newLabel?: string;
};

export default function ViewModeSwitch({
  mode,
  onChange,
  legacyLabel = '旧版',
  newLabel = '新版',
}: Props) {
  const baseBtn: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid rgba(0, 255, 255, 0.25)',
    background: 'rgba(0, 0, 0, 0.25)',
    color: '#e6f7ff',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: '16px',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const activeBtn: React.CSSProperties = {
    border: '1px solid rgba(0, 255, 255, 0.7)',
    background: 'rgba(0, 255, 255, 0.12)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
      <div style={{ color: 'rgba(230, 247, 255, 0.85)', fontSize: 12 }}>视图</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onChange('legacy')}
          style={{ ...baseBtn, ...(mode === 'legacy' ? activeBtn : null) }}
        >
          {legacyLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange('new')}
          style={{ ...baseBtn, ...(mode === 'new' ? activeBtn : null) }}
        >
          {newLabel}
        </button>
      </div>
    </div>
  );
}

