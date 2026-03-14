/**
 * Moran's I Spatial Autocorrelation
 * Ref: Structural Control & Health Monitoring 2022; Sensors 2024 CrackLG
 *
 * Detects whether cracks are spatially clustered (common structural cause)
 * or randomly distributed (independent mechanisms)
 *
 * I > 0.3  → strong clustering — investigate common cause
 * I ≈ 0    → random distribution
 * I < -0.1 → dispersed — independent mechanisms
 */
import { mean } from './statistics';

export interface MoranResult {
  moransI: number;
  expected: number;
  pattern: 'CLUSTERED' | 'RANDOM' | 'DISPERSED';
  interpretation: string;
  risk: 'high' | 'medium' | 'low';
}

export interface SpatialPoint {
  id: string;
  x: number;
  y: number;
  value: number; // crack severity metric (width, rate, etc.)
}

export interface LISAResult {
  id: string;
  localI: number;
  cluster: 'HH' | 'LL' | 'HL' | 'LH' | 'NS'; // High-High, Low-Low, etc.
  isHotspot: boolean;
}

/**
 * Global Moran's I — single number summarizing spatial clustering
 * @param points - monitoring points with coordinates and values
 * @param distanceThreshold - max distance for spatial weight (default auto)
 */
export function globalMoranI(
  points: SpatialPoint[],
  distanceThreshold?: number
): MoranResult {
  const n = points.length;
  if (n < 4) {
    return {
      moransI: 0,
      expected: 0,
      pattern: 'RANDOM',
      interpretation: 'insufficient points for spatial analysis',
      risk: 'low',
    };
  }

  // Auto threshold: median inter-point distance * 1.5
  if (!distanceThreshold) {
    const dists: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        dists.push(Math.sqrt(
          (points[i].x - points[j].x) ** 2 +
          (points[i].y - points[j].y) ** 2
        ));
      }
    }
    dists.sort((a, b) => a - b);
    distanceThreshold = dists[Math.floor(dists.length / 2)] * 1.5;
  }

  const xBar = mean(points.map(p => p.value));
  let numerator = 0;
  let denominator = 0;
  let W = 0;

  for (let i = 0; i < n; i++) {
    denominator += (points[i].value - xBar) ** 2;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = Math.sqrt(
        (points[i].x - points[j].x) ** 2 +
        (points[i].y - points[j].y) ** 2
      );
      const wij = dist <= distanceThreshold && dist > 0 ? 1 / dist : 0;
      W += wij;
      numerator += wij * (points[i].value - xBar) * (points[j].value - xBar);
    }
  }

  if (denominator === 0 || W === 0) {
    return {
      moransI: 0, expected: -1 / (n - 1), pattern: 'RANDOM',
      interpretation: 'no variation in values', risk: 'low',
    };
  }

  const I = (n / W) * (numerator / denominator);
  const expected = -1 / (n - 1);

  const pattern: MoranResult['pattern'] =
    I > expected + 0.15 ? 'CLUSTERED'
    : I < expected - 0.15 ? 'DISPERSED'
    : 'RANDOM';

  const risk: MoranResult['risk'] =
    pattern === 'CLUSTERED' && I > 0.3 ? 'high'
    : pattern === 'CLUSTERED' ? 'medium'
    : 'low';

  const interpretation =
    I > 0.3 ? 'strong spatial clustering — investigate common structural cause'
    : I > 0.1 ? 'mild clustering — possible structural pattern'
    : I < -0.1 ? 'dispersed — independent crack mechanisms'
    : 'random distribution — no spatial pattern';

  return {
    moransI: Number(I.toFixed(3)),
    expected: Number(expected.toFixed(3)),
    pattern,
    interpretation,
    risk,
  };
}

/**
 * Local Indicators of Spatial Association (LISA)
 * Identifies per-point hotspots and cold spots
 */
export function localMoranI(
  points: SpatialPoint[],
  distanceThreshold?: number
): LISAResult[] {
  const n = points.length;
  if (n < 4) return points.map(p => ({
    id: p.id, localI: 0, cluster: 'NS' as const, isHotspot: false,
  }));

  if (!distanceThreshold) {
    const dists: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        dists.push(Math.sqrt(
          (points[i].x - points[j].x) ** 2 +
          (points[i].y - points[j].y) ** 2
        ));
      }
    }
    dists.sort((a, b) => a - b);
    distanceThreshold = dists[Math.floor(dists.length / 2)] * 1.5;
  }

  const xBar = mean(points.map(p => p.value));
  const variance = points.reduce((s, p) => s + (p.value - xBar) ** 2, 0) / n;

  return points.map((pi, i) => {
    const zi = pi.value - xBar;
    let localI = 0;
    let neighborMean = 0;
    let neighborCount = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = Math.sqrt(
        (pi.x - points[j].x) ** 2 + (pi.y - points[j].y) ** 2
      );
      if (dist <= distanceThreshold! && dist > 0) {
        const wij = 1 / dist;
        const zj = points[j].value - xBar;
        localI += wij * zi * zj;
        neighborMean += points[j].value;
        neighborCount++;
      }
    }

    if (variance > 0) localI /= variance;
    if (neighborCount > 0) neighborMean /= neighborCount;

    // Classify cluster type
    const isHigh = pi.value > xBar;
    const neighborHigh = neighborMean > xBar;
    const cluster: LISAResult['cluster'] =
      Math.abs(localI) < 0.1 ? 'NS'
      : isHigh && neighborHigh ? 'HH'
      : !isHigh && !neighborHigh ? 'LL'
      : isHigh && !neighborHigh ? 'HL'
      : 'LH';

    return {
      id: pi.id,
      localI: Number(localI.toFixed(3)),
      cluster,
      isHotspot: cluster === 'HH',
    };
  });
}
