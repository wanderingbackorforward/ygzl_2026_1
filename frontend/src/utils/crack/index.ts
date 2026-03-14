/**
 * Crack Intelligence Engine — Index
 *
 * 7 scientific algorithms for structural crack monitoring:
 * 1. Wavelet decomposition (trend/seasonal/noise separation)
 * 2. Permutation Entropy (health index)
 * 3. Hurst exponent (acceleration detection)
 * 4. CUSUM change point detection (early warning)
 * 5. Moran's I spatial clustering (propagation fronts)
 * 6. Thermal-structural separation (temperature decontamination)
 * 7. GB 50292-2015 damage grading (real engineering standards)
 */

// Statistics utilities
export { mean, stddev, median, pearson, linearSlope, cv, rolling, growthRates } from './statistics';

// Wavelet decomposition
export { waveletDecompose, waveletEnergy } from './wavelet';
export type { WaveletResult } from './wavelet';

// Permutation Entropy
export { permutationEntropy, amplitudeAwarePE, entropyToHealth } from './entropy';
export type { EntropyResult } from './entropy';

// Hurst exponent
export { hurstExponent, rollingHurst } from './hurst';
export type { HurstResult } from './hurst';

// CUSUM change point detection
export { cusumDetect, labelChangePoints } from './cusum';
export type { CUSUMResult, ChangePoint } from './cusum';

// Creep phase detection
export { detectCreepPhases } from './creepPhase';
export type { CreepStage, PhaseSegment, PhaseResult } from './creepPhase';

// Spatial analysis (Moran's I)
export { globalMoranI, localMoranI } from './spatial';
export type { MoranResult, SpatialPoint, LISAResult } from './spatial';

// Thermal-structural separation
export { thermalSeparation, settlementCausality } from './thermal';
export type { ThermalSeparationResult, CausalResult } from './thermal';

// GB 50292-2015 standards
export { classifyGB50292, gradeAssessment, gradeDistribution, predictDaysToNextGrade } from './gb50292';
export type { GB50292Grade, GradeResult, GradeDistribution } from './gb50292';

/**
 * Master Caution Logic
 * Combines all algorithms into a single green/yellow/red indicator
 */
export type MasterCautionLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface MasterCautionResult {
  level: MasterCautionLevel;
  label: string;
  reasons: string[];
}

export function computeMasterCaution(inputs: {
  worstGrade: 'a' | 'b' | 'c' | 'd';
  hasActiveAlarms: boolean;
  maxHurst: number;
  worstCreepStage: string;
  spatialClustering: boolean;
}): MasterCautionResult {
  const reasons: string[] = [];

  // RED conditions
  if (inputs.worstGrade === 'd') reasons.push('GB50292 D级 严重损伤');
  if (inputs.worstCreepStage === 'TERTIARY') reasons.push('III期加速扩展');
  if (inputs.maxHurst > 0.8) reasons.push(`Hurst ${inputs.maxHurst.toFixed(2)} 强持续性`);

  if (reasons.length > 0) {
    return { level: 'RED', label: '危险 — 需立即处理', reasons };
  }

  // YELLOW conditions
  if (inputs.worstGrade === 'c') reasons.push('GB50292 C级 明显损伤');
  if (inputs.hasActiveAlarms) reasons.push('CUSUM检测到变点');
  if (inputs.maxHurst > 0.6) reasons.push(`Hurst ${inputs.maxHurst.toFixed(2)} 轻度持续性`);
  if (inputs.spatialClustering) reasons.push('空间聚类异常');

  if (reasons.length > 0) {
    return { level: 'YELLOW', label: '关注 — 加强监测', reasons };
  }

  return { level: 'GREEN', label: '系统正常', reasons: [] };
}
