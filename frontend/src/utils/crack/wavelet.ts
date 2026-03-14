/**
 * Simplified Wavelet Decomposition (Haar Wavelet)
 * Ref: MDPI Buildings 2024 — Wavelet-Based Vibration Denoising for SHM
 *
 * Separates crack signal into:
 * - Approximation (low freq): long-term structural trend
 * - Detail levels (mid freq): thermal/seasonal cycles
 * - Detail level 1 (high freq): measurement noise
 *
 * Uses Haar wavelet for simplicity (frontend-friendly, no dependencies)
 */

export interface WaveletResult {
  approximation: number[];  // long-term trend
  details: number[][];      // detail coefficients at each level
  trend: number[];          // reconstructed trend (same length as input)
  seasonal: number[];       // reconstructed seasonal component
  noise: number[];          // reconstructed noise component
  levels: number;
}

/**
 * Single-level Haar wavelet decomposition
 */
function haarDecompose(signal: number[]): { approx: number[]; detail: number[] } {
  const n = Math.floor(signal.length / 2);
  const approx: number[] = [];
  const detail: number[] = [];

  for (let i = 0; i < n; i++) {
    approx.push((signal[2 * i] + signal[2 * i + 1]) / Math.SQRT2);
    detail.push((signal[2 * i] - signal[2 * i + 1]) / Math.SQRT2);
  }

  return { approx, detail };
}

/**
 * Single-level Haar wavelet reconstruction
 */
function haarReconstruct(approx: number[], detail: number[]): number[] {
  const n = approx.length;
  const signal: number[] = new Array(n * 2);

  for (let i = 0; i < n; i++) {
    signal[2 * i] = (approx[i] + detail[i]) / Math.SQRT2;
    signal[2 * i + 1] = (approx[i] - detail[i]) / Math.SQRT2;
  }

  return signal;
}

/**
 * Multi-level wavelet decomposition
 * @param data - input time series
 * @param maxLevels - decomposition depth (default 4)
 */
export function waveletDecompose(data: number[], maxLevels = 4): WaveletResult {
  if (data.length < 8) {
    return {
      approximation: [...data],
      details: [],
      trend: [...data],
      seasonal: data.map(() => 0),
      noise: data.map(() => 0),
      levels: 0,
    };
  }

  // Pad to power of 2 if needed
  let padded = [...data];
  const originalLen = data.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(padded.length)));
  while (padded.length < nextPow2) {
    padded.push(padded[padded.length - 1]); // edge padding
  }

  // Decompose
  const allDetails: number[][] = [];
  let current = padded;
  const actualLevels = Math.min(maxLevels, Math.floor(Math.log2(padded.length)) - 1);

  for (let level = 0; level < actualLevels; level++) {
    const { approx, detail } = haarDecompose(current);
    allDetails.push(detail);
    current = approx;
  }

  const approximation = current;

  // Reconstruct components
  // Trend: reconstruct from approximation only (zero all details)
  let trendRecon = [...approximation];
  for (let level = actualLevels - 1; level >= 0; level--) {
    const zeros = new Array(allDetails[level].length).fill(0);
    trendRecon = haarReconstruct(trendRecon, zeros);
  }

  // Noise: reconstruct from detail level 0 only
  let noiseRecon = new Array(approximation.length).fill(0);
  for (let level = actualLevels - 1; level >= 0; level--) {
    if (level === 0) {
      noiseRecon = haarReconstruct(noiseRecon, allDetails[level]);
    } else {
      const zeros = new Array(allDetails[level].length).fill(0);
      noiseRecon = haarReconstruct(noiseRecon, zeros);
    }
  }

  // Seasonal: mid-frequency details (levels 1-2)
  let seasonalRecon = new Array(approximation.length).fill(0);
  for (let level = actualLevels - 1; level >= 0; level--) {
    if (level >= 1 && level <= 2) {
      seasonalRecon = haarReconstruct(seasonalRecon, allDetails[level]);
    } else {
      const zeros = new Array(allDetails[level].length).fill(0);
      seasonalRecon = haarReconstruct(seasonalRecon, zeros);
    }
  }

  // Trim back to original length
  return {
    approximation,
    details: allDetails,
    trend: trendRecon.slice(0, originalLen),
    seasonal: seasonalRecon.slice(0, originalLen),
    noise: noiseRecon.slice(0, originalLen),
    levels: actualLevels,
  };
}

/**
 * Wavelet packet energy distribution
 * Tracks how energy shifts between frequency bands over time
 * A shift indicates structural state change
 */
export function waveletEnergy(details: number[][]): number[] {
  return details.map(d => {
    const energy = d.reduce((s, v) => s + v * v, 0);
    return Number(energy.toFixed(4));
  });
}
