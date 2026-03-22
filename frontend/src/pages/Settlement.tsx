import React, { useState } from 'react';
import SettlementNew from './SettlementNew';
import SettlementV2 from './SettlementV2';

type Tab = 'new' | 'v2';

const TABS: { key: Tab; label: string }[] = [
  { key: 'v2', label: 'V2驾驶舱' },
  { key: 'new', label: '仪表盘' },
];

export default function Settlement() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem('settlement:tab');
      return saved === 'new' ? 'new' : 'v2';
    } catch { return 'v2'; }
  });

  const handleTab = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem('settlement:tab', t); } catch {}
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', borderBottom: '1px solid rgba(0,255,255,0.12)', display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginRight: 4 }}>视图</span>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTab(t.key)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${tab === t.key ? 'rgba(0,229,255,0.7)' : 'rgba(0,229,255,0.2)'}`,
              background: tab === t.key ? 'rgba(0,229,255,0.12)' : 'rgba(0,0,0,0.2)',
              color: tab === t.key ? '#00e5ff' : 'rgba(255,255,255,0.6)',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {tab === 'v2' ? <SettlementV2 /> : <SettlementNew />}
      </div>
    </div>
  );
}
