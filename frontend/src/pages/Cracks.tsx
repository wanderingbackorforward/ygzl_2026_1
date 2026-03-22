import React from 'react';
import CracksNew from './CracksNew';

export default function Cracks() {
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <CracksNew />
      </div>
    </div>
  );
}
