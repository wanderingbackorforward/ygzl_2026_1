/**
 * Hurst Exponent via Rescaled Range (R/S) Analysis
 * Ref: Engineering Fracture Mechanics 2025; ResearchGate 2022
 *
 * H > 0.5 → persistent (trending, accelerating crack) — DANGER
 * H = 0.5 → random walk (unpredictable)
 * H < 0.5 → anti-persistent (mean-reverting, stable)
 */
import { mean, stddev } from './statistics';

export interface HurstResult {
  H: number;
  interpretation: 'persistent' | 'random' | 'anti-persistent';
  risk: 'high' | 'medium' | 'low';
  label: string;
}

/**
 * Compute Hurst exponent using R/S analysis
 * @param data - time series (crack widths or cumulative changes)
 * @param minWindow - minimum window size (default 10)
 */
export function hurstExponent(data: number[], minWindow = 10): HurstResult {
  const n = data.length;
  if (n < minWindow * 2) {
    return { H: 0.5, interpretation: 'random', risk: 'medium', label: '数据不足' };
  }

  const logRS: number[] = [];
  const logN: number[] = [];

  // Test multiple window sizes
  for (let size = minWindow; size <= Math.floor(n / 2); size = Math.floor(size * 1.5)) {
    const numWindows = Math.floor(n / size);
    if (numWindows < 1) break;

    let rsSum = 0;
    let validWindows = 0;

    for (let w = 0; w < numWindows; w++) {
      const segment = data.slice(w * size, (w + 1) * size);
      const m = mean(segment);
      const s = stddev(segment);
      if (s === 0) continue;

      // Cumulative deviation from mean
      let cumDev = 0;
      let maxDev = -Infinity;
      let minDev = Infinity;
      for (let i = 0; i < segment.length; i++) {
        cumDev += segment[i] - m;
        if (cumDev > maxDev) maxDev = cumDev;
        if (cumDev < minDev) minDev = cumDev;
      }

      const R = maxDev - minDev;
      rsSum += R / s;
      validWindows++;
    }

    if (validWindows > 0) {
      logRS.push(Math.log(rsSum / validWindows));
      logN.push(Math.log(size));
    }
  }

  if (logRS.length < 3) {
    return { H: 0.5, interpretation: 'random', risk: 'medium', label: '窗口数不足' };
  }

  // Linear regression: log(R/S) = H * log(n) + c
  const nPts = logRS.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < nPts; i++) {
    sumX += logN[i];
    sumY += logRS[i];
    sumXY += logN[i] * logRS[i];
    sumX2 += logN[i] * logN[i];
  }
  const denom = nPts * sumX2 - sumX * sumX;
  const H = denom ? Math.max(0, Math.min(1, (nPts * sumXY - sumX * sumY) / denom)) : 0.5;

  const interpretation: HurstResult['interpretation'] =
    H > 0.55 ? 'persistent' : H < 0.45 ? 'anti-persistent' : 'random';
  const risk: HurstResult['risk'] =
    H > 0.7 ? 'high' : H > 0.55 ? 'medium' : 'low';
  const label =
    H > 0.7 ? '检测到加速趋势'
    : H > 0.55 ? '轻度持续性'
    : H < 0.45 ? '自限性，稳定'
    : '随机波动';

  return { H: Number(H.toFixed(3)), interpretation, risk, label };
}

/**
 * Rolling Hurst exponent over a sliding window
 * Detects when crack behavior shifts from stable to accelerating
 */
export function rollingHurst(
  data: number[],
  windowSize = 30,
  step = 1
): Array<{ index: number; H: number; risk: HurstResult['risk'] }> {
  const results: Array<{ index: number; H: number; risk: HurstResult['risk'] }> = [];
  for (let i = windowSize; i <= data.length; i += step) {
    const window = data.slice(i - windowSize, i);
    const { H, risk } = hurstExponent(window, 8);
    results.push({ index: i - 1, H, risk });
  }
  return results;
}
