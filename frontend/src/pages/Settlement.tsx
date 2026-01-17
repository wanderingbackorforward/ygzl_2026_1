import React from 'react';
import ViewModeSwitch from '../components/shared/ViewModeSwitch';
import { useViewMode } from '../hooks/useViewMode';
import SettlementLegacy from './SettlementLegacy';
import SettlementNew from './SettlementNew';

export default function Settlement() {
  const { mode, setMode } = useViewMode('settlement', 'legacy');
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', borderBottom: '1px solid rgba(0, 255, 255, 0.12)' }}>
        <ViewModeSwitch mode={mode} onChange={setMode} legacyLabel="旧版(静态)" newLabel="新版(仪表盘)" />
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {mode === 'legacy' ? <SettlementLegacy /> : <SettlementNew />}
      </div>
    </div>
  );
}
