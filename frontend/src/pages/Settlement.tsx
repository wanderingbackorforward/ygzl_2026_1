import React, { useState } from 'react';
import SettlementNew from './SettlementNew';
import SettlementV2 from './SettlementV2';
import SettlementLedger from '../components/settlement/SettlementLedger';

type Tab = 'v2' | 'new' | 'ledger';

const TABS: { key: Tab; label: string }[] = [
  { key: 'v2', label: 'V2驾驶舱' },
  { key: 'new', label: '仪表盘' },
  { key: 'ledger', label: '点位台账' },
];

export default function Settlement() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem('settlement:tab');
      return saved === 'new' || saved === 'ledger' ? saved : 'v2';
    } catch { return 'v2'; }
  });

  const handleTab = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem('settlement:tab', t); } catch {}
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', borderBottom: '1px solid var(--ds-divider)', display: 'flex', gap: 10, padding: '8px 16px', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ds-text-muted)' }}>视图</span>
        <div className="ds-seg">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTab(t.key)}
              className={`ds-seg__item ${tab === t.key ? 'ds-seg__item--active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {tab === 'v2' && <SettlementV2 />}
        {tab === 'new' && <SettlementNew />}
        {tab === 'ledger' && <SettlementLedger />}
      </div>
    </div>
  );
}
