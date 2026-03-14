/**
 * CrackGradeCards — GB 50292-2015 grade distribution
 * 4 large cards showing count per grade (a/b/c/d)
 * Color-coded backgrounds, click to filter
 */
import React, { useMemo } from 'react';
import { useCracks } from '../../../contexts/CracksContext';
import { classifyGB50292, gradeDistribution } from '../../../utils/crack';
import type { CardComponentProps } from '../../../types/layout';

interface GradeCardData {
  grade: 'a' | 'b' | 'c' | 'd';
  label: string;
  count: number;
  color: string;
  bgClass: string;
  description: string;
}

const GRADE_META: Record<string, { label: string; color: string; bgClass: string; description: string }> = {
  a: {
    label: 'A - Intact',
    color: '#22c55e',
    bgClass: 'bg-green-900/30 border-green-700/50',
    description: '<0.05mm hairline',
  },
  b: {
    label: 'B - Slight',
    color: '#eab308',
    bgClass: 'bg-yellow-900/30 border-yellow-700/50',
    description: '0.05-0.2mm minor',
  },
  c: {
    label: 'C - Significant',
    color: '#f97316',
    bgClass: 'bg-orange-900/30 border-orange-700/50',
    description: '0.2-1.0mm capacity affected',
  },
  d: {
    label: 'D - Severe',
    color: '#ef4444',
    bgClass: 'bg-red-900/30 border-red-700/50',
    description: '>1.0mm failure risk',
  },
};

export const CrackGradeCards: React.FC<CardComponentProps> = () => {
  const { points, overview, slopeData } = useCracks();

  const gradeCards = useMemo((): GradeCardData[] => {
    if (!points.length) {
      return ['a', 'b', 'c', 'd'].map(g => ({
        grade: g as any,
        label: GRADE_META[g].label,
        count: 0,
        color: GRADE_META[g].color,
        bgClass: GRADE_META[g].bgClass,
        description: GRADE_META[g].description,
      }));
    }

    // Estimate widths and classify
    const avgWidth = (overview as any)?.avg_width ?? 0.1;
    const widths = points.map(id => {
      const slope = slopeData?.find(s => s.point === id)?.slope ?? 0;
      return Math.max(0, avgWidth + slope * 10); // mock estimation
    });

    const dist = gradeDistribution(widths);

    return (['a', 'b', 'c', 'd'] as const).map(g => ({
      grade: g,
      label: GRADE_META[g].label,
      count: dist[g],
      color: GRADE_META[g].color,
      bgClass: GRADE_META[g].bgClass,
      description: GRADE_META[g].description,
    }));
  }, [points, overview, slopeData]);

  return (
    <div className="dashboard-card__content p-4">
      <div className="grid grid-cols-2 gap-4">
        {gradeCards.map(card => (
          <div
            key={card.grade}
            className={`rounded-lg border p-4 ${card.bgClass} hover:scale-105 transition-transform cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">{card.label}</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: card.color }}
              />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{card.count}</div>
            <div className="text-xs text-slate-300">{card.description}</div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="text-xs text-slate-300">
          <span className="font-semibold text-white">GB 50292-2015 Standard:</span>
          {' '}Total {points.length} points monitored.
          {gradeCards.find(c => c.grade === 'd')!.count > 0 && (
            <span className="text-red-400 ml-2">⚠ {gradeCards.find(c => c.grade === 'd')!.count} severe cracks require immediate action</span>
          )}
          {gradeCards.find(c => c.grade === 'c')!.count > 0 && (
            <span className="text-orange-400 ml-2">⚠ {gradeCards.find(c => c.grade === 'c')!.count} significant cracks need repair</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrackGradeCards;
