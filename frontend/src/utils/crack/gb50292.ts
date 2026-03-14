/**
 * GB 50292-2015 / EN 1992-1-1 Crack Classification Standards
 * Ref: GB 50292-2015 Standard for Appraisal of Reliability of Civil Buildings
 * Ref: EN 1992-1-1 Eurocode 2 Table 7.1N
 *
 * Provides real engineering standards for crack damage grading
 */
import { linearSlope } from './statistics';

export type GB50292Grade = 'a' | 'b' | 'c' | 'd';

export interface GradeResult {
  grade: GB50292Grade;
  label: string;
  description: string;
  action: string;
  color: string;
  bgColor: string;       // for UI cards
  currentWidth: number;
  nextThreshold: number;  // width threshold for next worse grade
  daysToDegrade: number | null; // estimated days to reach next grade
}

export interface GradeDistribution {
  a: number;
  b: number;
  c: number;
  d: number;
  total: number;
}

const GRADE_DEFS: Record<GB50292Grade, {
  label: string;
  max: number;
  description: string;
  action: string;
  color: string;
  bgColor: string;
}> = {
  a: {
    label: 'A - intact',
    max: 0.05,
    description: 'hairline cracks or invisible',
    action: 'no intervention needed',
    color: '#22c55e',
    bgColor: 'bg-green-900/30',
  },
  b: {
    label: 'B - slight',
    max: 0.20,
    description: 'minor cracks within code limits',
    action: 'monitor, no immediate repair',
    color: '#eab308',
    bgColor: 'bg-yellow-900/30',
  },
  c: {
    label: 'C - significant',
    max: 1.00,
    description: 'cracks exceed code limits, capacity affected',
    action: 'repair required, restrict loading',
    color: '#f97316',
    bgColor: 'bg-orange-900/30',
  },
  d: {
    label: 'D - severe',
    max: Infinity,
    description: 'wide cracks indicating structural failure risk',
    action: 'immediate evacuation and reinforcement',
    color: '#ef4444',
    bgColor: 'bg-red-900/30',
  },
};

/**
 * Classify a crack width into GB 50292-2015 grade
 */
export function classifyGB50292(widthMm: number): GB50292Grade {
  if (widthMm <= 0.05) return 'a';
  if (widthMm <= 0.20) return 'b';
  if (widthMm <= 1.00) return 'c';
  return 'd';
}

/**
 * Get full grade assessment with degradation prediction
 * @param currentWidth - current crack width in mm
 * @param dailyRate - average daily change rate in mm/day
 */
export function gradeAssessment(
  currentWidth: number,
  dailyRate: number
): GradeResult {
  const grade = classifyGB50292(currentWidth);
  const def = GRADE_DEFS[grade];

  // Find next threshold
  const thresholds: Array<{ grade: GB50292Grade; threshold: number }> = [
    { grade: 'a', threshold: 0.05 },
    { grade: 'b', threshold: 0.20 },
    { grade: 'c', threshold: 1.00 },
  ];

  const nextThreshold = thresholds.find(t => t.threshold > currentWidth);
  let daysToDegrade: number | null = null;

  if (nextThreshold && dailyRate > 0) {
    const remaining = nextThreshold.threshold - currentWidth;
    daysToDegrade = Math.ceil(remaining / dailyRate);
    if (daysToDegrade > 3650) daysToDegrade = null; // >10 years = effectively never
  }

  return {
    grade,
    label: def.label,
    description: def.description,
    action: def.action,
    color: def.color,
    bgColor: def.bgColor,
    currentWidth,
    nextThreshold: nextThreshold?.threshold ?? Infinity,
    daysToDegrade,
  };
}

/**
 * Grade a list of monitoring points
 */
export function gradeDistribution(widths: number[]): GradeDistribution {
  const dist: GradeDistribution = { a: 0, b: 0, c: 0, d: 0, total: widths.length };
  for (const w of widths) {
    dist[classifyGB50292(w)]++;
  }
  return dist;
}

/**
 * Predict days until next grade based on time series trend
 * Uses linear extrapolation of recent values
 */
export function predictDaysToNextGrade(
  values: number[],
  windowSize = 14
): number | null {
  if (values.length < windowSize) return null;

  const recent = values.slice(-windowSize);
  const slope = linearSlope(recent); // mm per day

  if (slope <= 0) return null; // not worsening

  const currentWidth = values[values.length - 1];
  const currentGrade = classifyGB50292(currentWidth);

  const thresholds: Record<GB50292Grade, number> = {
    a: 0.05, b: 0.20, c: 1.00, d: Infinity,
  };

  const nextThreshold = thresholds[currentGrade];
  if (nextThreshold === Infinity) return null; // already worst

  // Next grade threshold might be different from current grade's max
  const gradeOrder: GB50292Grade[] = ['a', 'b', 'c', 'd'];
  const nextIdx = gradeOrder.indexOf(currentGrade) + 1;
  if (nextIdx >= gradeOrder.length) return null;

  const target = thresholds[gradeOrder[nextIdx - 1]]; // threshold to next grade
  const remaining = target - currentWidth;

  if (remaining <= 0) return 0; // already past threshold
  const days = Math.ceil(remaining / slope);
  return days > 3650 ? null : days;
}
