/**
 * MasterCautionBar — Layer 0: 0.5-second decision
 * Inspired by aircraft cockpit Master Caution light
 * Single indicator: GREEN / YELLOW / RED
 */
import React, { useMemo } from 'react';
import { useCracks } from '../../../contexts/CracksContext';
import {
  classifyGB50292,
  computeMasterCaution,
  type MasterCautionLevel,
} from '../../../utils/crack';

const LEVEL_CONFIG: Record<MasterCautionLevel, {
  dotColor: string;
  bgClass: string;
  label: string;
}> = {
  GREEN:  { dotColor: 'bg-green-400',  bgClass: 'border-green-800/50',  label: '结构健康' },
  YELLOW: { dotColor: 'bg-yellow-400', bgClass: 'border-yellow-800/50', label: '需要关注' },
  RED:    { dotColor: 'bg-red-500',    bgClass: 'border-red-800/50',    label: '立即行动' },
};

export const MasterCautionBar: React.FC = () => {
  const { overview, points, trendData } = useCracks();

  const caution = useMemo(() => {
    if (!overview || !points.length) {
      return computeMasterCaution({
        worstGrade: 'a',
        hasActiveAlarms: false,
        maxHurst: 0.5,
        worstCreepStage: 'DORMANT',
        spatialClustering: false,
      });
    }

    // Determine worst grade from overview data
    const avgWidth = (overview as any).avg_width ?? (overview as any).avg_value ?? 0;
    const maxWidth = (overview as any).max_width ?? (overview as any).max_value ?? avgWidth;
    const worstGrade = classifyGB50292(maxWidth);

    // Simple heuristic from available data until full intelligence engine is integrated
    const dailyRate = overview.avg_daily_change ?? 0;
    const hasActiveAlarms = Math.abs(dailyRate) > 0.1;
    const maxHurst = Math.abs(dailyRate) > 0.05 ? 0.65 : 0.45;

    return computeMasterCaution({
      worstGrade,
      hasActiveAlarms,
      maxHurst,
      worstCreepStage: dailyRate > 0.1 ? 'TERTIARY' : 'SECONDARY',
      spatialClustering: false,
    });
  }, [overview, points, trendData]);

  const config = LEVEL_CONFIG[caution.level];
  const pointCount = points.length;
  const warningCount = caution.reasons.length;

  return (
    <div className={`shrink-0 border-b ${config.bgClass} bg-slate-900/80 backdrop-blur-sm`}>
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: status indicator */}
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${config.dotColor} shadow-lg animate-pulse`}
               style={{ animationDuration: caution.level === 'GREEN' ? '3s' : '1s' }} />
          <span className="text-lg font-bold text-white">{config.label}</span>
          <span className="text-sm text-slate-200">
            {pointCount} 个监测点
            {warningCount > 0 && ` | ${warningCount} 项需关注`}
          </span>
        </div>

        {/* Right: reasons (if any) */}
        {caution.reasons.length > 0 && (
          <div className="flex items-center gap-2">
            {caution.reasons.slice(0, 3).map((r, i) => (
              <span key={i} className="text-xs text-white bg-slate-700/80 px-2 py-1 rounded">
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterCautionBar;
