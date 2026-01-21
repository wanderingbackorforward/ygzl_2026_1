import React, { useEffect, useMemo, useState } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { OverviewProvider } from '../contexts/OverviewContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import type { CardConfig, CardComponentProps } from '../types/layout';
import SafetyScoreGaugeCard from '../components/overview/SafetyScoreGaugeCard';
import RiskRadarCard from '../components/overview/RiskRadarCard';
import SettlementOverviewCard from '../components/overview/SettlementOverviewCard';
import CracksOverviewCard from '../components/overview/CracksOverviewCard';
import TemperatureOverviewCard from '../components/overview/TemperatureOverviewCard';
import VibrationOverviewCard from '../components/overview/VibrationOverviewCard';
import OverviewModuleSelector from '../components/overview/OverviewModuleSelector';
import { useOverviewModuleSelection, type OverviewModuleId } from '../hooks/useOverviewModuleSelection';
import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';
import './Overview.css';

function buildOverviewCards(): CardConfig[] {
  return [
    {
      id: 'safety-score',
      title: '项目安全总览',
      icon: 'fas fa-shield-alt',
      component: SafetyScoreGaugeCard as React.ComponentType<CardComponentProps>,
      defaultLayout: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
      defaultLayouts: { md: { x: 0, y: 0, w: 5, h: 4, minW: 4, minH: 3 } },
    },
    {
      id: 'risk-radar',
      title: '综合风险评估',
      icon: 'fas fa-bullseye',
      component: RiskRadarCard as React.ComponentType<CardComponentProps>,
      defaultLayout: { x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
      defaultLayouts: { md: { x: 5, y: 0, w: 5, h: 4, minW: 4, minH: 3 } },
    },
    {
      id: 'settlement',
      title: '沉降监测概况',
      icon: 'fas fa-arrows-alt-v',
      component: SettlementOverviewCard as React.ComponentType<CardComponentProps>,
      defaultLayout: { x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
      defaultLayouts: { md: { x: 0, y: 4, w: 5, h: 4, minW: 4, minH: 3 } },
    },
    {
      id: 'cracks',
      title: '裂缝监测概况',
      icon: 'fas fa-stream',
      component: CracksOverviewCard as React.ComponentType<CardComponentProps>,
      defaultLayout: { x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
      defaultLayouts: { md: { x: 5, y: 4, w: 5, h: 4, minW: 4, minH: 3 } },
    },
    {
      id: 'temperature',
      title: '温度监测概况',
      icon: 'fas fa-thermometer-half',
      component: TemperatureOverviewCard as React.ComponentType<CardComponentProps>,
      defaultLayout: { x: 0, y: 8, w: 6, h: 4, minW: 4, minH: 3 },
      defaultLayouts: { md: { x: 0, y: 8, w: 5, h: 4, minW: 4, minH: 3 } },
    },
    {
      id: 'vibration',
      title: '振动监测概况',
      icon: 'fas fa-wave-square',
      component: VibrationOverviewCard as React.ComponentType<CardComponentProps>,
      defaultLayout: { x: 6, y: 8, w: 6, h: 3, minW: 4, minH: 2 },
      defaultLayouts: { md: { x: 5, y: 8, w: 5, h: 3, minW: 4, minH: 2 } },
    },
  ];
}

const OverviewDashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [moduleSelectorOpen, setModuleSelectorOpen] = useState(false);
  const { selectedSet, toggle, selectAll, clearAll, reset } = useOverviewModuleSelection();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cards = useMemo(() => {
    const fixed = new Set(['safety-score', 'risk-radar']);
    const all = buildOverviewCards();
    return all.filter((c) => fixed.has(c.id) || selectedSet.has(c.id as OverviewModuleId));
  }, [selectedSet]);

  return (
    <div className="overview-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e6f7ff' }}>项目监测数据汇总中心</div>
          <div style={{ fontSize: 12, letterSpacing: 2, color: '#8ba0b6' }}>PROJECT DATA AGGREGATION & MONITORING</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="layout-controls__btn"
            onClick={() => setModuleSelectorOpen(true)}
          >
            <i className="fas fa-layer-group" />
            <span>二级模块</span>
          </button>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 18, color: '#00e5ff' }}>
            {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <DashboardGrid pageId="overview" cards={cards} />
      </div>

      <OverviewModuleSelector
        open={moduleSelectorOpen}
        selected={selectedSet}
        onToggle={toggle}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        onReset={reset}
        onClose={() => setModuleSelectorOpen(false)}
      />
    </div>
  );
};

export default function Overview() {
  return (
    <LayoutProvider>
      <OverviewProvider>
        <OverviewDashboard />
      </OverviewProvider>
    </LayoutProvider>
  );
}
