/**
 * CUSUM (Cumulative Sum) Change Point Detection
 * Ref: Page (1954); JMLR FO-CuS (2023)
 * Detects mean shifts in crack growth rate 5-15 days earlier than threshold alarms
 */
import { mean, stddev } from './statistics';

export interface CUSUMResult {
  index: number;
  value: number;
  sPos: number;
  sNeg: number;
  alarm: boolean;
  direction: 'acceleration' | 'deceleration' | null;
}

export interface ChangePoint {
  index: number;
  date?: string;
  direction: 'acceleration' | 'deceleration';
  magnitude: number;
}

/**
 * Page's two-sided CUSUM detector
 * @param data - time series of crack measurements or growth rates
 * @param burnIn - number of initial points for baseline estimation (default 30)
 * @param k - allowance value in sigma units (default 0.5)
 * @param h - decision interval in sigma units (default 5.0)
 */
export function cusumDetect(
  data: number[],
  burnIn = 30,
  k = 0.5,
  h = 5.0
): { results: CUSUMResult[]; changePoints: ChangePoint[] } {
  if (data.length < burnIn + 5) {
    return { results: [], changePoints: [] };
  }

  const baseline = data.slice(0, burnIn);
  const mu0 = mean(baseline);
  const sigma = stddev(baseline);
  if (sigma === 0) return { results: [], changePoints: [] };

  const results: CUSUMResult[] = [];
  const changePoints: ChangePoint[] = [];
  let sPos = 0;
  let sNeg = 0;

  for (let i = burnIn; i < data.length; i++) {
    const z = (data[i] - mu0) / sigma;

    // Upper CUSUM (detects increase / acceleration)
    sPos = Math.max(0, sPos + z - k);
    // Lower CUSUM (detects decrease / deceleration)
    sNeg = Math.max(0, sNeg - z - k);

    const alarm = sPos > h || sNeg > h;
    const direction: CUSUMResult['direction'] =
      sPos > h ? 'acceleration' : sNeg > h ? 'deceleration' : null;

    results.push({ index: i, value: data[i], sPos, sNeg, alarm, direction });

    if (alarm) {
      changePoints.push({
        index: i,
        direction: direction!,
        magnitude: Math.max(sPos, sNeg),
      });
      // Reset after alarm
      sPos = 0;
      sNeg = 0;
    }
  }

  return { results, changePoints };
}

/**
 * Attach date labels to change points
 */
export function labelChangePoints(
  changePoints: ChangePoint[],
  dates: string[]
): ChangePoint[] {
  return changePoints.map(cp => ({
    ...cp,
    date: dates[cp.index] || undefined,
  }));
}
