/**
 * VitalSignsStrip — Layer 1: 2-second scan
 * Inspired by Tesla's permanent vital signs strip
 * 5 key metrics that NEVER scroll, color-coded backgrounds
 */
import React, { useMemo } from 'react';
import { useCracks } from '../../../contexts/CracksContext';
import { classifyGB50292, gradeDistribution } from '../../../utils/crack';

interface VitalCardProps {
  label: string;
  value: string;
  status: 'green' | 'yellow' | 'red';
  subtitle?: string;
}

const STATUS_STYLES: Record<string, string> = {
  green: 'bg-green-900/40 border-green-700/50',
  yellow: 'bg-yellow-900/40 border-yellow-700/50',
  red: 'bg-red-900/40 border-red-700/50',
};

const DOT_STYLES: Record<string, string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

const VitalCard: React.FC<VitalCardProps> = ({ label, value, status, subtitle }) => (
  <div className={`rounded-lg border p-3 ${STATUS_STYLES[status]} flex flex-col items-center justify-center`}>
    <div className="flex items-center gap-1.5 mb-1">
      <div className={`w-2 h-2 rounded-full ${DOT_STYLES[status]}`} />
      <span className="text-xs text-slate-200 font-medium">{label}</span>
    </div>
    <span className="text-xl font-bold text-white">{value}</span>
    {subtitle && <span className="text-xs text-slate-300 mt-0.5">{subtitle}</span>}
  </div>
);

export const VitalSignsStrip: React.FC = () => {
  const { overview, points, slopeData } = useCracks();

  const vitals = useMemo(() => {
    if (!overview || !points.length) {
      return {
        maxWidth: { value: '--', status: 'green' as const, subtitle: '' },
        accelPoints: { value: '--', status: 'green' as const, subtitle: '' },
        avgRate: { value: '--', status: 'green' as const, subtitle: '' },
        gradeC: { value: '--', status: 'green' as const, subtitle: '' },
        totalPoints: { value: '--', status: 'green' as const, subtitle: '' },
      };
    }

    // Max crack width
    const maxW = (overview as any).max_width ?? (overview as any).max_value ?? 0;
    const maxGrade = classifyGB50292(maxW);
    const maxStatus = maxGrade === 'a' ? 'green' : maxGrade === 'b' ? 'green' : maxGrade === 'c' ? 'yellow' : 'red';

    // Accelerating points (positive slope)
    const accelCount = slopeData?.filter(s => s.slope > 0.01)?.length ?? 0;
    const accelStatus = accelCount === 0 ? 'green' : accelCount <= 2 ? 'yellow' : 'red';

    // Average daily change rate
    const avgRate = overview.avg_daily_change ?? 0;
    const rateStatus = Math.abs(avgRate) < 0.01 ? 'green' : Math.abs(avgRate) < 0.05 ? 'yellow' : 'red';

    // Grade C/D count
    const expanding = (overview as any).expanding_points ?? overview.expanding ?? 0;
    const dangerCount = expanding; // approximate
    const gradeStatus = dangerCount === 0 ? 'green' : dangerCount <= 2 ? 'yellow' : 'red';

    return {
      maxWidth: {
        value: `${maxW.toFixed(2)}mm`,
        status: maxStatus as 'green' | 'yellow' | 'red',
        subtitle: `GB ${maxGrade.toUpperCase()}-grade`,
      },
      accelPoints: {
        value: `${accelCount}`,
        status: accelStatus as 'green' | 'yellow' | 'red',
        subtitle: 'accelerating',
      },
      avgRate: {
        value: `${avgRate.toFixed(3)}`,
        status: rateStatus as 'green' | 'yellow' | 'red',
        subtitle: 'mm/day avg',
      },
      gradeC: {
        value: `${dangerCount}`,
        status: gradeStatus as 'green' | 'yellow' | 'red',
        subtitle: 'expanding pts',
      },
      totalPoints: {
        value: `${points.length}`,
        status: 'green' as const,
        subtitle: 'monitored',
      },
    };
  }, [overview, points, slopeData]);

  return (
    <div className="shrink-0 px-4 py-3">
      <div className="grid grid-cols-5 gap-3">
        <VitalCard label="Max Width" {...vitals.maxWidth} />
        <VitalCard label="Accelerating" {...vitals.accelPoints} />
        <VitalCard label="Avg Rate" {...vitals.avgRate} />
        <VitalCard label="Expanding" {...vitals.gradeC} />
        <VitalCard label="Total Points" {...vitals.totalPoints} />
      </div>
    </div>
  );
};

export default VitalSignsStrip;
