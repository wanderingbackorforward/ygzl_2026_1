import React, { useState } from 'react';
import { IS_MOBILE } from '../hooks/useViewMode';
import TemperatureNew from './TemperatureNew';
import { TemperatureV2Cockpit } from '../components/temperature-v2';

type TempMode = 'v2' | 'new';

export default function Temperature() {
  const [mode, setMode] = useState<TempMode>('v2');

  const modes: { key: TempMode; label: string }[] = [
    { key: 'v2', label: 'V2驾驶舱' },
    { key: 'new', label: '仪表盘' },
  ];

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!IS_MOBILE && (
        <div style={{ flex: '0 0 auto', borderBottom: '1px solid var(--ds-divider)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
          <div style={{ color: 'var(--ds-text-muted)', fontSize: 12 }}>视图</div>
          <div className="ds-seg">
            {modes.map(m => (
              <button key={m.key} type="button" onClick={() => setMode(m.key)}
                className={`ds-seg__item ${mode === m.key ? 'ds-seg__item--active' : ''}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {mode === 'v2' ? <TemperatureV2Cockpit /> : <TemperatureNew />}
      </div>
    </div>
  );
}
