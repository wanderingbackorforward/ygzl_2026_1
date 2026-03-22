import React from 'react';
import CoverMapShow from './CoverMapShow';

export default function Cover() {
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <CoverMapShow />
      </div>
    </div>
  );
}
