/**
 * GB 6722-2014 爆破安全规程
 * 阈值计算、Sadovsky公式、安全评分
 */

import type {
  StructureType,
  FrequencyBand,
  StructureCondition,
  ThresholdRange,
  GB6722Table2,
  ThresholdParams,
  Thresholds,
  SadovskyParams,
  SiteType,
  SiteCoefficients,
  SafetyScoreInput,
  SafetyScoreResult,
  SafetyLevel,
  AlertLevel,
  ConstructionAdvice
} from './types'

// ==================== GB 6722-2014 表2 数据 ====================

/**
 * GB 6722-2014 表2：爆破振动安全允许标准
 * 单位：cm/s（注意：前端统一用 mm/s，需要转换）
 */
export const GB_TABLE_2: GB6722Table2 = {
  earthen: {
    // 土窑洞、土坯房、毛石房
    low: { min: 1.5, max: 4.5 },   // <10Hz: 0.15-0.45 cm/s = 1.5-4.5 mm/s
    mid: { min: 4.5, max: 9.0 },   // 10-50Hz: 0.45-0.9 cm/s
    high: { min: 9.0, max: 15.0 }  // >50Hz: 0.9-1.5 cm/s
  },
  brick: {
    // 一般砖房、非抗震大型砌块房
    low: { min: 5.0, max: 10.0 },
    mid: { min: 10.0, max: 20.0 },
    high: { min: 20.0, max: 30.0 }
  },
  concrete: {
    // 钢筋混凝土框架房
    low: { min: 7.0, max: 12.0 },
    mid: { min: 12.0, max: 25.0 },
    high: { min: 25.0, max: 35.0 }
  },
  industrial: {
    // 工业/商业建筑
    low: { min: 15.0, max: 25.0 },
    mid: { min: 25.0, max: 40.0 },
    high: { min: 40.0, max: 50.0 }
  },
  historic: {
    // 古建筑/历史建筑
    low: { min: 1.0, max: 3.0 },
    mid: { min: 3.0, max: 5.0 },
    high: { min: 5.0, max: 8.0 }
  },
  tunnel: {
    // 水工隧道/交通隧道
    low: { min: 70.0, max: 150.0 },
    mid: { min: 150.0, max: 250.0 },
    high: { min: 250.0, max: 400.0 }
  },
  softSoil: {
    // 液化土/软土地基
    low: { min: 6.0, max: 10.0 },
    mid: { min: 10.0, max: 15.0 },
    high: { min: 15.0, max: 20.0 }
  }
}

// ==================== 频率段判定 ====================

/**
 * 根据主频判定频率段
 * @param freq 主频 (Hz)
 */
export function getFrequencyBand(freq: number): FrequencyBand {
  if (freq < 10) return 'low'
  if (freq <= 50) return 'mid'
  return 'high'
}

// ==================== 动态阈值计算 ====================

/**
 * 计算动态阈值（GB规范 + 频率/距离/结构状态修正）
 * @param params 阈值参数
 * @returns 三级阈值
 */
export function getDynamicThreshold(params: ThresholdParams): Thresholds {
  const { structureType, dominantFreq, distance, condition } = params

  // 1. 从 GB 表2 获取基准值
  const freqBand = getFrequencyBand(dominantFreq)
  const range = GB_TABLE_2[structureType][freqBand]

  // 2. 结构状态修正系数
  const conditionFactor: Record<StructureCondition, number> = {
    new: 1.0,      // 新建，取上限
    good: 0.85,    // 良好
    fair: 0.7,     // 一般
    poor: 0.5,     // 较差
    damaged: 0.3   // 危房，取下限
  }

  // 基准阈值 = 上限 * 结构状态系数
  let baseThreshold = range.max * conditionFactor[condition]

  // 3. 距离修正（近场效应，<50m 需降低阈值）
  const distanceFactor = distance < 50
    ? 0.7 + (distance / 50) * 0.3  // 线性插值 0.7-1.0
    : 1.0

  // 4. 低频修正（<10Hz 对结构损伤更大）
  const freqFactor = dominantFreq < 10 ? 0.7 : 1.0

  // 最终阈值
  const finalThreshold = baseThreshold * distanceFactor * freqFactor

  return {
    warn: finalThreshold * 0.6,   // 60%阈值预警
    alert: finalThreshold * 0.8,  // 80%阈值报警
    stop: finalThreshold          // 100%阈值停工
  }
}

// ==================== Sadovsky 公式 ====================

/**
 * 场地系数（经验值）
 */
export const SITE_COEFFICIENTS: Record<SiteType, SiteCoefficients> = {
  hardRock: { K: 250, alpha: 1.5 },   // 坚硬岩石
  softRock: { K: 150, alpha: 1.7 },   // 软岩
  soil: { K: 100, alpha: 1.9 },       // 土层
  softSoil: { K: 50, alpha: 2.0 }     // 软土
}

/**
 * 预测 PPV（Sadovsky 公式）
 * V = K · (Q^(1/3) / R)^α
 * @param params Sadovsky 参数
 * @returns 预测的 PPV (mm/s)
 */
export function predictPPV(params: SadovskyParams): number {
  const { K, alpha, Q, R } = params
  return K * Math.pow(Math.pow(Q, 1 / 3) / R, alpha)
}

/**
 * 计算安全距离（Sadovsky 公式反算）
 * R = (K/V)^(1/α) · Q^(1/3)
 * @param K 场地系数
 * @param alpha 衰减指数
 * @param Q 齐发药量 (kg)
 * @param V_limit 允许振速 (mm/s)
 * @returns 安全距离 (m)
 */
export function calculateSafeDistance(
  K: number,
  alpha: number,
  Q: number,
  V_limit: number
): number {
  return Math.pow(K / V_limit, 1 / alpha) * Math.pow(Q, 1 / 3)
}

// ==================== 安全评分算法 ====================

/**
 * 计算安全评分（基于 GB 规范 + Miner 累积损伤）
 * @param data 评分输入数据
 * @returns 安全评分结果
 */
export function calculateSafetyScore(data: SafetyScoreInput): SafetyScoreResult {
  let score = 100
  const factors: string[] = []

  // 1. PPV 超限程度 (0-40分)
  const ppvRatio = data.ppvMax / data.threshold
  if (ppvRatio > 1.0) {
    const penalty = Math.min(40, (ppvRatio - 1.0) * 50)  // 超限50%扣满40分
    score -= penalty
    factors.push(`PPV超限${((ppvRatio - 1) * 100).toFixed(1)}%`)
  } else if (ppvRatio > 0.8) {
    score -= (ppvRatio - 0.8) * 100  // 80%-100%线性扣分
    factors.push(`PPV接近阈值`)
  }

  // 2. 振动持续时间 (0-20分，GB 要求考虑持续时间)
  if (data.duration > 0.5) {
    const penalty = Math.min(20, (data.duration - 0.5) * 10)  // >0.5s 开始扣分
    score -= penalty
    factors.push(`持续时间${data.duration.toFixed(2)}s`)
  }

  // 3. 低频风险 (0-15分，GB 表2 低频阈值更严)
  if (data.dominantFreq < 10) {
    score -= 15
    factors.push(`低频振动${data.dominantFreq.toFixed(1)}Hz`)
  } else if (data.dominantFreq < 15) {
    score -= 8
    factors.push(`中低频振动`)
  }

  // 4. 累积报警次数 (0-15分，Miner 累积损伤法则)
  const alertPenalty = Math.min(15, data.alertCount * 3)
  score -= alertPenalty
  if (data.alertCount > 0) {
    factors.push(`累积报警${data.alertCount}次`)
  }

  // 5. 超限率 (0-10分)
  if (data.exceedRatio > 5) {
    score -= 10
    factors.push(`超限率${data.exceedRatio.toFixed(1)}%`)
  } else if (data.exceedRatio > 2) {
    score -= 5
    factors.push(`超限率偏高`)
  }

  score = Math.max(0, Math.round(score))

  // 判定安全等级
  const level: SafetyLevel = score >= 80 ? 'safe' : score >= 60 ? 'caution' : 'danger'

  // 生成总体建议
  let recommendation = ''
  if (level === 'safe') {
    recommendation = '振动水平安全，保持常规监测'
  } else if (level === 'caution') {
    recommendation = '振动水平偏高，建议降低爆破参数并加密监测'
  } else {
    recommendation = '振动水平危险，立即停工并进行结构安全评估'
  }

  return { score, level, factors, recommendation }
}

// ==================== 预警等级判定 ====================

/**
 * 判定预警等级
 * @param ppv 峰值质点速度 (mm/s)
 * @param thresholds 三级阈值
 * @returns 预警等级
 */
export function getAlertLevel(ppv: number, thresholds: Thresholds): AlertLevel {
  if (ppv >= thresholds.stop) return 'stop'
  if (ppv >= thresholds.alert) return 'alert'
  if (ppv >= thresholds.warn) return 'warn'
  return 'safe'
}

// ==================== 施工建议生成 ====================

/**
 * 生成施工建议（规则引擎）
 * @param ppv 峰值质点速度 (mm/s)
 * @param freq 主频 (Hz)
 * @param level 预警等级
 * @returns 施工建议
 */
export function getConstructionAdvice(
  ppv: number,
  freq: number,
  level: AlertLevel
): ConstructionAdvice {
  const adviceMap: Record<AlertLevel, ConstructionAdvice> = {
    safe: {
      level: 'safe',
      icon: '🛡️',
      color: 'text-green-400',
      message: '保持常规监测',
      actions: []
    },
    warn: {
      level: 'warn',
      icon: '⚠️',
      color: 'text-yellow-400',
      message: '降低药量30%',
      actions: ['增加延时间隔', '加密监测频次']
    },
    alert: {
      level: 'alert',
      icon: '🚨',
      color: 'text-orange-400',
      message: '暂停爆破作业',
      actions: ['检查周围建筑裂缝', '降低单段药量50%以上']
    },
    stop: {
      level: 'stop',
      icon: '🛑',
      color: 'text-red-500',
      message: '立即停工评审',
      actions: ['启动应急预案', '所有工序暂停', '结构安全评估']
    }
  }

  const advice = adviceMap[level]

  // 低频额外建议
  if (freq < 15 && level !== 'safe') {
    advice.actions.push('注意低频振动对建筑基础的影响')
  }

  return advice
}
