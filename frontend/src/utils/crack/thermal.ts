/**
 * Thermal-Structural Separation
 * Separates crack width changes into thermal expansion component vs structural damage
 * Ref: Concrete thermal expansion coefficient ~10-12 x 10^-6 /degC
 *
 * |r| > 0.7 → thermal-dominant (low risk, seasonal)
 * |r| < 0.3 → structural-dominant (high risk, independent of temperature)
 */
import { pearson, mean } from './statistics';

export interface ThermalSeparationResult {
  correlation: number;
  bestLag: number;               // optimal lag in days (positive = crack lags temp)
  regime: 'THERMAL_DOMINANT' | 'MIXED' | 'STRUCTURAL_DOMINANT';
  riskLevel: 'low' | 'medium' | 'high';
  label: string;
  thermalComponent: number[];    // estimated thermal-driven change
  structuralComponent: number[]; // residual = structural damage
  lagCorrelations: Array<{ lag: number; r: number }>;
}

/**
 * Cross-correlation between crack and temperature series
 * Finds the optimal time lag
 */
function crossCorrelation(
  crack: number[],
  temp: number[],
  maxLag: number
): Array<{ lag: number; r: number }> {
  const n = Math.min(crack.length, temp.length);
  const results: Array<{ lag: number; r: number }> = [];

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j >= 0 && j < n) {
        pairs.push([crack[i], temp[j]]);
      }
    }
    if (pairs.length < 5) continue;

    const a = pairs.map(p => p[0]);
    const b = pairs.map(p => p[1]);
    results.push({ lag, r: pearson(a, b) });
  }

  return results;
}

/**
 * Separate crack signal into thermal and structural components
 * @param crackValues - crack width time series
 * @param tempValues - temperature time series (aligned dates)
 * @param alpha - thermal expansion coefficient (default 11e-6 /degC)
 * @param gaugeLength - gauge length in mm (default 100mm)
 * @param maxLag - maximum lag days to test (default 7)
 */
export function thermalSeparation(
  crackValues: number[],
  tempValues: number[],
  alpha = 11e-6,
  gaugeLength = 100,
  maxLag = 7
): ThermalSeparationResult {
  const n = Math.min(crackValues.length, tempValues.length);

  if (n < 10) {
    return {
      correlation: 0,
      bestLag: 0,
      regime: 'MIXED',
      riskLevel: 'medium',
      label: '数据不足，无法进行分析',
      thermalComponent: crackValues.map(() => 0),
      structuralComponent: [...crackValues],
      lagCorrelations: [],
    };
  }

  const cv = crackValues.slice(0, n);
  const tv = tempValues.slice(0, n);

  // Cross-correlation to find optimal lag
  const lagCorrelations = crossCorrelation(cv, tv, maxLag);
  const best = lagCorrelations.reduce(
    (acc, cur) => (Math.abs(cur.r) > Math.abs(acc.r) ? cur : acc),
    { lag: 0, r: 0 }
  );

  // Compute thermal component using physical model
  const refTemp = mean(tv);
  const thermalComponent = tv.map(t => alpha * gaugeLength * (t - refTemp));

  // Structural component = measured - thermal
  const structuralComponent = cv.map((v, i) => v - thermalComponent[i]);

  // Classify regime
  const absR = Math.abs(best.r);
  const regime: ThermalSeparationResult['regime'] =
    absR > 0.7 ? 'THERMAL_DOMINANT'
    : absR > 0.3 ? 'MIXED'
    : 'STRUCTURAL_DOMINANT';

  const riskLevel: ThermalSeparationResult['riskLevel'] =
    regime === 'THERMAL_DOMINANT' ? 'low'
    : regime === 'MIXED' ? 'medium'
    : 'high';

  const label =
    regime === 'THERMAL_DOMINANT'
      ? `热主导型 (r=${best.r.toFixed(2)}, 滞后${best.lag}天) - 季节性波动`
      : regime === 'STRUCTURAL_DOMINANT'
      ? `结构主导型 (r=${best.r.toFixed(2)}) - 与温度无关的变化`
      : `混合型 (r=${best.r.toFixed(2)}, 滞后${best.lag}天)`;

  return {
    correlation: Number(best.r.toFixed(3)),
    bestLag: best.lag,
    regime,
    riskLevel,
    label,
    thermalComponent,
    structuralComponent,
    lagCorrelations,
  };
}

/**
 * Cross-correlation between crack and settlement series
 * Identifies causal relationship: does settlement CAUSE cracks?
 */
export interface CausalResult {
  peakCorrelation: number;
  peakLag: number;
  interpretation: string;
  lagCorrelations: Array<{ lag: number; r: number }>;
}

export function settlementCausality(
  crackValues: number[],
  settlementValues: number[],
  maxLag = 30
): CausalResult {
  const lagCorrelations = crossCorrelation(crackValues, settlementValues, maxLag);
  if (!lagCorrelations.length) {
    return {
      peakCorrelation: 0,
      peakLag: 0,
      interpretation: '数据不足',
      lagCorrelations: [],
    };
  }

  const peak = lagCorrelations.reduce(
    (acc, cur) => (Math.abs(cur.r) > Math.abs(acc.r) ? cur : acc),
    { lag: 0, r: 0 }
  );

  const interpretation =
    peak.lag > 0
      ? `裂缝滞后沉降 ${peak.lag} 天 (r=${peak.r.toFixed(2)}) — 沉降可能是主因`
      : peak.lag < 0
      ? `裂缝先于沉降 ${-peak.lag} 天 (r=${peak.r.toFixed(2)}) — 早期预警信号`
      : `同步响应 (r=${peak.r.toFixed(2)})`;

  return {
    peakCorrelation: Number(peak.r.toFixed(3)),
    peakLag: peak.lag,
    interpretation,
    lagCorrelations,
  };
}
