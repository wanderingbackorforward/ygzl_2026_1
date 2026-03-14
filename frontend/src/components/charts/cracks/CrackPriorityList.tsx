/**
 * CrackPriorityList — Actionable priority ranking
 * Inspired by Linear.app's issue list with status dots
 * Replaces radar chart with scannable ranked list
 */
import React, { useMemo } from 'react';
import { useCracks } from '../../../contexts/CracksContext';
import { classifyGB50292, gradeAssessment } from '../../../utils/crack';
import type { CardComponentProps } from '../../../types/layout';

interface PriorityItem {
  pointId: string;
  grade: 'a' | 'b' | 'c' | 'd';
  gradeLabel: string;
  color: string;
  currentWidth: number;
  dailyRate: number;
  action: string;
  daysToDegrade: number | null;
  riskScore: number; // for sorting
}

const GRADE_COLORS: Record<string, string> = {
  a: '#22c55e',
  b: '#eab308',
  c: '#f97316',
  d: '#ef4444',
};

export const CrackPriorityList: React.FC<CardComponentProps> = () => {
  const { points, overview, slopeData } = useCracks();

  const priorityItems = useMemo((): PriorityItem[] => {
    if (!points.length || !slopeData) return [];

    const avgWidth = (overview as any)?.avg_width ?? 0.1;
    const items: PriorityItem[] = points.map(id => {
      const slope = slopeData.find(s => s.point === id)?.slope ?? 0;
      const estimatedWidth = Math.max(0, avgWidth + slope * 10); // mock
      const dailyRate = slope;

      const assessment = gradeAssessment(estimatedWidth, dailyRate);

      // Risk score: grade weight + rate weight
      const gradeWeight = { a: 0, b: 25, c: 50, d: 100 }[assessment.grade];
      const rateWeight = Math.abs(dailyRate) * 100;
      const riskScore = gradeWeight + rateWeight;

      return {
        pointId: id,
        grade: assessment.grade,
        gradeLabel: assessment.label,
        color: assessment.color,
        currentWidth: estimatedWidth,
        dailyRate,
        action: assessment.action,
        daysToDegrade: assessment.daysToDegrade,
        riskScore,
      };
    });

    // Sort by risk score descending
    return items.sort((a, b) => b.riskScore - a.riskScore);
  }, [points, overview, slopeData]);

  if (!priorityItems.length) {
    return (
      <div className="dashboard-card__content flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }

  return (
    <div className="dashboard-card__content overflow-y-auto">
      <div className="space-y-2 p-4">
        {priorityItems.map((item, idx) => (
          <div
            key={item.pointId}
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            {/* Rank */}
            <div className="shrink-0 w-8 text-center">
              <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>
            </div>

            {/* Status dot */}
            <div
              className="shrink-0 w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />

            {/* Point ID */}
            <div className="shrink-0 w-24">
              <span className="text-sm font-semibold text-white">{item.pointId}</span>
            </div>

            {/* Grade badge */}
            <div className="shrink-0">
              <span
                className="text-xs font-bold px-2 py-1 rounded"
                style={{
                  backgroundColor: `${item.color}20`,
                  color: item.color,
                  border: `1px solid ${item.color}40`,
                }}
              >
                {item.grade.toUpperCase()}
              </span>
            </div>

            {/* Metrics */}
            <div className="flex-1 flex items-center gap-4 text-xs text-slate-300">
              <span>Width: {item.currentWidth.toFixed(2)}mm</span>
              <span>Rate: {item.dailyRate.toFixed(3)}mm/d</span>
              {item.daysToDegrade && (
                <span className="text-yellow-400">
                  ⚠ {item.daysToDegrade}d to next grade
                </span>
              )}
            </div>

            {/* Action */}
            <div className="shrink-0 text-xs text-slate-400 max-w-xs truncate">
              {item.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CrackPriorityList;
