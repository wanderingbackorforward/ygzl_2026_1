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
        <div style={{ flex: '0 0 auto', borderBottom: '1px solid rgba(0, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
          <div style={{ color: 'rgba(230, 247, 255, 0.85)', fontSize: 12 }}>视图</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {modes.map(m => (
              <button key={m.key} type="button" onClick={() => setMode(m.key)}
                style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12, lineHeight: '16px', cursor: 'pointer', whiteSpace: 'nowrap',
                  border: mode === m.key ? '1px solid rgba(0, 255, 255, 0.7)' : '1px solid rgba(0, 255, 255, 0.25)',
                  background: mode === m.key ? 'rgba(0, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.25)',
                  color: '#e6f7ff',
                }}>
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
