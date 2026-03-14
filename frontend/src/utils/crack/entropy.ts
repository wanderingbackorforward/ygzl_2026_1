/**
 * Permutation Entropy (PE) and Amplitude-Aware PE (AAPE)
 * Ref: Sensors 2024 — AAPE for SHM; Mech Sys & Signal Processing 2024
 *
 * Low entropy → regular, healthy structure
 * High entropy → irregular, complex signals → damage accumulating
 */

export interface EntropyResult {
  entropy: number;          // 0-1 normalized
  healthScore: number;      // 100 (healthy) to 0 (damaged)
  status: 'healthy' | 'attention' | 'warning' | 'critical';
}

/**
 * Compute permutation entropy of a time series
 * @param data - time series values
 * @param m - embedding dimension (default 3, typical 3-7)
 * @param tau - time delay (default 1)
 */
export function permutationEntropy(data: number[], m = 3, tau = 1): number {
  const n = data.length;
  if (n < m * tau + 1) return 0;

  // Count occurrences of each ordinal pattern
  const patternCounts = new Map<string, number>();
  let totalPatterns = 0;

  for (let i = 0; i <= n - m * tau; i++) {
    // Extract embedding vector
    const indices: number[] = [];
    for (let j = 0; j < m; j++) {
      indices.push(i + j * tau);
    }

    // Get ordinal pattern (rank ordering)
    const values = indices.map(idx => data[idx]);
    const ranked = values
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => a.v - b.v || a.idx - b.idx)
      .map((_, newIdx, sorted) => sorted.findIndex(s => s.idx === _));

    // Use rank order as pattern key
    const order = values
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => a.v - b.v || a.idx - b.idx)
      .map(item => item.idx);
    const key = order.join(',');

    patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
    totalPatterns++;
  }

  if (totalPatterns === 0) return 0;

  // Shannon entropy of pattern distribution
  let entropy = 0;
  for (const count of patternCounts.values()) {
    const p = count / totalPatterns;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // Normalize by maximum entropy (log2(m!))
  let mFactorial = 1;
  for (let i = 2; i <= m; i++) mFactorial *= i;
  const maxEntropy = Math.log2(mFactorial);

  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Amplitude-Aware Permutation Entropy (AAPE)
 * Accounts for amplitude differences, not just ordinal patterns
 * Superior to standard PE for real-world crack signals
 */
export function amplitudeAwarePE(data: number[], m = 3, tau = 1, alpha = 0.5): number {
  const n = data.length;
  if (n < m * tau + 1) return 0;

  const patternWeights = new Map<string, number>();
  let totalWeight = 0;

  for (let i = 0; i <= n - m * tau; i++) {
    const values: number[] = [];
    for (let j = 0; j < m; j++) values.push(data[i + j * tau]);

    // Ordinal pattern
    const order = values
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => a.v - b.v || a.idx - b.idx)
      .map(item => item.idx);
    const key = order.join(',');

    // Amplitude weight: mean absolute deviation of the embedding vector
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const amplitude = values.reduce((s, v) => s + Math.abs(v - avg), 0) / values.length;

    // Combined weight: alpha * amplitude + (1-alpha) * 1
    const weight = alpha * (amplitude + 1e-10) + (1 - alpha);

    patternWeights.set(key, (patternWeights.get(key) || 0) + weight);
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;

  let entropy = 0;
  for (const w of patternWeights.values()) {
    const p = w / totalWeight;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  let mFactorial = 1;
  for (let i = 2; i <= m; i++) mFactorial *= i;
  const maxEntropy = Math.log2(mFactorial);

  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Convert entropy to health assessment
 * Low entropy = healthy (predictable), High entropy = damaged (chaotic)
 */
export function entropyToHealth(entropy: number): EntropyResult {
  const healthScore = Math.round((1 - entropy) * 100);
  const status: EntropyResult['status'] =
    entropy < 0.3 ? 'healthy'
    : entropy < 0.5 ? 'attention'
    : entropy < 0.7 ? 'warning'
    : 'critical';

  return { entropy: Number(entropy.toFixed(3)), healthScore, status };
}
