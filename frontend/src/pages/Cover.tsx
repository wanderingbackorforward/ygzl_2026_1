import React from 'react';
import ViewModeSwitch from '../components/shared/ViewModeSwitch';
import { useViewMode } from '../hooks/useViewMode';
import CoverLegacy from './CoverLegacy';
import CoverMapShow from './CoverMapShow';

export default function Cover() {
  const { mode, setMode } = useViewMode('cover', 'legacy');
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', borderBottom: '1px solid rgba(0, 255, 255, 0.12)' }}>
        <ViewModeSwitch mode={mode} onChange={setMode} legacyLabel="现有样式" newLabel="地图样式" />
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {mode === 'legacy' ? <CoverLegacy /> : <CoverMapShow />}
      </div>
    </div>
  );
}
