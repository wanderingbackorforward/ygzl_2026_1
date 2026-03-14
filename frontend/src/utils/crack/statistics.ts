/**
 * Basic statistical utilities for crack intelligence algorithms
 * Used by: wavelet, entropy, hurst, cusum, spatial, thermal modules
 */

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const va = a[i] - ma;
    const vb = b[i] - mb;
    num += va * vb;
    da += va * va;
    db += vb * vb;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Linear regression slope (least squares) */
export function linearSlope(arr: number[]): number {
  const n = arr.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += arr[i];
    sumXY += i * arr[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  return denom ? (n * sumXY - sumX * sumY) / denom : 0;
}

/** Coefficient of variation */
export function cv(arr: number[]): number {
  const m = mean(arr);
  return m !== 0 ? stddev(arr) / Math.abs(m) : 0;
}

/** Rolling window computation */
export function rolling<T>(
  arr: number[],
  windowSize: number,
  fn: (window: number[]) => T
): T[] {
  const results: T[] = [];
  for (let i = windowSize; i <= arr.length; i++) {
    results.push(fn(arr.slice(i - windowSize, i)));
  }
  return results;
}

/** Compute daily growth rates from cumulative values */
export function growthRates(values: number[]): number[] {
  const rates: number[] = [];
  for (let i = 1; i < values.length; i++) {
    rates.push(values[i] - values[i - 1]);
  }
  return rates;
}
