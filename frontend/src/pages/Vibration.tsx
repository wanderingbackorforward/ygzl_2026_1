import React from 'react';
import VibrationNew from './VibrationNew';

export default function Vibration() {
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <VibrationNew />
      </div>
    </div>
  );
}
