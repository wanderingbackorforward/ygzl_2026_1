/**
 * 温度V2 施工指导面板
 * 红黄绿灯矩阵 + 具体施工建议
 */
import React from 'react';

interface ConstructionGuidePanelProps {
  assessment: any;
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string }> = {
  green: { dot: 'bg-green-400', bg: 'bg-green-900/30 border-green-700/40', text: '正常' },
  yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700/40', text: '注意' },
  red: { dot: 'bg-red-500', bg: 'bg-red-900/30 border-red-700/40', text: '警告' },
};

const METRIC_LABELS: Record<string, string> = {
  ambient_temp: '环境温度',
  concrete_temp: '混凝土温度',
  core_surface_diff: '内外温差',
  cooling_rate: '冷却速率',
  ground_temp: '地温',
  daily_range: '日温差',
};

export const ConstructionGuidePanel: React.FC<ConstructionGuidePanelProps> = ({ assessment }) => {
  if (!assessment) {
    return (
      <div className="p-4 text-center text-slate-200">
        <i className="fas fa-hard-hat text-2xl mb-2 block text-cyan-400" />
        暂无施工条件数据
      </div>
    );
  }

  const { overall_status, metrics, actions, summary } = assessment;
  const cfg = STATUS_CONFIG[overall_status] || STATUS_CONFIG.green;

  return (
    <div className="flex flex-col h-full">
      {/* 指标矩阵 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {/* 红黄绿灯指标 */}
        {metrics && Object.entries(metrics).map(([key, val]: [string, any]) => {
          const s = STATUS_CONFIG[val?.status] || STATUS_CONFIG.green;
          return (
            <div key={key} className={`border rounded-lg p-2.5 ${s.bg} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-white text-sm">{METRIC_LABELS[key] || key}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-mono text-sm">
                  {val?.value != null ? `${Number(val.value).toFixed(1)}` : '--'}
                </span>
                <span className="text-xs text-slate-200">{val?.label}</span>
              </div>
            </div>
          );
        })}

        {/* 施工建议 */}
        {actions && actions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-200 font-medium mb-2">
              <i className="fas fa-clipboard-list mr-1" />施工建议
            </div>
            {actions.map((a: any, i: number) => (
              <div key={i} className={`rounded-lg p-2.5 mb-2 border ${
                a.priority === 'critical' ? 'bg-red-900/20 border-red-700/40' : 'bg-yellow-900/20 border-yellow-700/40'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    a.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                  }`}>
                    {a.priority === 'critical' ? '紧急' : '建议'}
                  </span>
                  <span className="text-white text-sm font-medium">{a.action}</span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">{a.detail}</p>
              </div>
            ))}
          </div>
        )}

        {(!actions || actions.length === 0) && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 text-center">
            <span className="text-green-400 text-sm">
              <i className="fas fa-check-circle mr-1" />所有指标正常，可正常施工
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstructionGuidePanel;
