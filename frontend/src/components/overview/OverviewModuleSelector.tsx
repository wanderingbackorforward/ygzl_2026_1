import React from 'react';
import type { OverviewModuleId } from '../../hooks/useOverviewModuleSelection';

const LABELS: Record<OverviewModuleId, string> = {
  settlement: '沉降',
  cracks: '裂缝',
  temperature: '温度',
  vibration: '振动',
};

export interface OverviewModuleSelectorProps {
  open: boolean;
  selected: Set<OverviewModuleId>;
  onToggle: (id: OverviewModuleId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const OverviewModuleSelector: React.FC<OverviewModuleSelectorProps> = ({
  open,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  onReset,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(520px, 96vw)',
          borderRadius: 12,
          border: '1px solid rgba(0, 229, 255, 0.25)',
          background: 'rgba(10, 18, 30, 0.95)',
          boxShadow: '0 0 20px rgba(0, 229, 255, 0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ color: '#e6f7ff', fontWeight: 800 }}>二级模块管理</div>
            <div style={{ color: '#8ba0b6', fontSize: 12 }}>选中加入汇总页，取消移出</div>
          </div>
          <button
            className="layout-controls__btn"
            style={{ padding: '6px 10px' }}
            onClick={onClose}
          >
            <i className="fas fa-times" />
            <span>关闭</span>
          </button>
        </div>

        <div style={{ padding: 14, display: 'grid', gap: 10 }}>
          {(Object.keys(LABELS) as OverviewModuleId[]).map((id) => {
            const checked = selected.has(id);
            return (
              <label
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(0, 229, 255, 0.15)',
                  background: 'rgba(0, 229, 255, 0.05)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(id)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ color: '#e6f7ff', fontWeight: 700 }}>{LABELS[id]}</span>
                </div>
                <span style={{ color: checked ? '#00e5ff' : '#8ba0b6', fontSize: 12 }}>
                  {checked ? '已加入' : '未加入'}
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid rgba(0, 229, 255, 0.12)' }}>
          <button className="layout-controls__btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onSelectAll}>
            <i className="fas fa-check-double" />
            <span>全选</span>
          </button>
          <button className="layout-controls__btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClearAll}>
            <i className="fas fa-ban" />
            <span>全不选</span>
          </button>
          <button className="layout-controls__btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onReset}>
            <i className="fas fa-undo" />
            <span>恢复默认</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewModuleSelector;

