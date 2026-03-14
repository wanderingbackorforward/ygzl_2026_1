/**
 * Creep Phase Detection — Tertiary Creep Model
 * Identifies crack evolution stage from growth rate trends
 *
 * Stage I (Primary):   Decelerating growth — stress redistribution
 * Stage II (Secondary): Steady-state — fatigue/sustained load
 * Stage III (Tertiary): Accelerating — approaching critical length — DANGER
 * Dormant:             No significant growth
 */
import { mean, stddev, linearSlope, cv, rolling, growthRates } from './statistics';

export type CreepStage = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'DORMANT';

export interface PhaseSegment {
  startIndex: number;
  endIndex: number;
  stage: CreepStage;
  label: string;
  risk: 'negligible' | 'low' | 'moderate' | 'critical';
  avgRate: number;
  slope: number;
  durationDays: number;
}

export interface PhaseResult {
  currentStage: CreepStage;
  currentRisk: string;
  segments: PhaseSegment[];
  pointPhases: Array<{ index: number; stage: CreepStage }>;
}

const STAGE_META: Record<CreepStage, { label: string; risk: PhaseSegment['risk'] }> = {
  DORMANT:   { label: 'dormant (no significant growth)',     risk: 'negligible' },
  PRIMARY:   { label: 'Stage I - decelerating',              risk: 'low' },
  SECONDARY: { label: 'Stage II - steady-state',             risk: 'moderate' },
  TERTIARY:  { label: 'Stage III - accelerating (DANGER)',   risk: 'critical' },
};

/**
 * Classify a single window into a creep stage
 */
function classifyWindow(rates: number[]): CreepStage {
  const avgRate = mean(rates);
  const slope = linearSlope(rates);
  const coeffVar = cv(rates);

  // Dormant: negligible growth
  if (Math.abs(avgRate) < 1e-6 && Math.abs(slope) < 1e-6) return 'DORMANT';

  // Tertiary: accelerating (slope positive and significant)
  if (slope > 0.001) return 'TERTIARY';

  // Primary: decelerating (slope negative, rate still positive)
  if (slope < -0.001 && avgRate > 0) return 'PRIMARY';

  // Secondary: steady-state (slope near zero, low variability)
  if (Math.abs(slope) <= 0.001 && coeffVar < 0.3) return 'SECONDARY';

  // Default: secondary if rate positive, dormant otherwise
  return avgRate > 1e-6 ? 'SECONDARY' : 'DORMANT';
}

/**
 * Detect creep phases across the full time series
 * @param values - crack width or cumulative change time series
 * @param windowSize - rolling window in days (default 14)
 */
export function detectCreepPhases(values: number[], windowSize = 14): PhaseResult {
  if (values.length < windowSize + 2) {
    return {
      currentStage: 'DORMANT',
      currentRisk: 'negligible',
      segments: [],
      pointPhases: [],
    };
  }

  const rates = growthRates(values);
  const pointPhases: Array<{ index: number; stage: CreepStage }> = [];

  // Classify each window position
  for (let i = windowSize; i <= rates.length; i++) {
    const window = rates.slice(i - windowSize, i);
    const stage = classifyWindow(window);
    pointPhases.push({ index: i, stage });
  }

  // Merge consecutive same-stage points into segments
  const segments: PhaseSegment[] = [];
  if (pointPhases.length > 0) {
    let segStart = pointPhases[0].index;
    let currentStage = pointPhases[0].stage;

    for (let i = 1; i <= pointPhases.length; i++) {
      const isEnd = i === pointPhases.length;
      const changed = !isEnd && pointPhases[i].stage !== currentStage;

      if (isEnd || changed) {
        const endIdx = isEnd ? pointPhases[i - 1].index : pointPhases[i - 1].index;
        const segRates = rates.slice(
          Math.max(0, segStart - windowSize),
          endIdx
        );
        const meta = STAGE_META[currentStage];
        segments.push({
          startIndex: segStart,
          endIndex: endIdx,
          stage: currentStage,
          label: meta.label,
          risk: meta.risk,
          avgRate: mean(segRates),
          slope: linearSlope(segRates),
          durationDays: endIdx - segStart + 1,
        });

        if (!isEnd) {
          segStart = pointPhases[i].index;
          currentStage = pointPhases[i].stage;
        }
      }
    }
  }

  const lastPhase = pointPhases.length > 0
    ? pointPhases[pointPhases.length - 1].stage
    : 'DORMANT' as CreepStage;

  return {
    currentStage: lastPhase,
    currentRisk: STAGE_META[lastPhase].risk,
    segments,
    pointPhases,
  };
}
