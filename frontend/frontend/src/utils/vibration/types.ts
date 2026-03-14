/**
 * 振动模块 V2 类型定义
 * 符合 GB 6722-2014 爆破安全规程
 */

// ==================== 基础数据类型 ====================

/** 三轴振动数据 */
export interface ThreeAxisData {
  x: number[]  // X轴速度时程 (mm/s)
  y: number[]  // Y轴速度时程 (mm/s)
  z: number[]  // Z轴速度时程 (mm/s)
  samplingRate: number  // 采样率 (Hz)
  timestamps?: number[]  // 时间戳 (可选)
}

/** 单轴振动数据（兼容模式） */
export interface SingleAxisData {
  amplitude: number[]  // 振幅时程 (mm/s)
  samplingRate: number  // 采样率 (Hz)
  timestamps?: number[]  // 时间戳 (可选)
}

/** FFT 结果 */
export interface FFTResult {
  frequencies: number[]  // 频率数组 (Hz)
  amplitudes: number[]   // 幅值数组
  peakFrequency: number  // 主频 (Hz)
  peakAmplitude: number  // 主频幅值
  bandwidth: number      // 半功率带宽 (Hz)
}

// ==================== PPV 计算结果 ====================

/** PPV 计算结果 */
export interface PPVResult {
  ppv: number           // 峰值质点速度 (mm/s)
  duration: number      // 振动持续时间 (s)
  dominantFreq: number  // 主频 (Hz)
  bandwidth: number     // 主频带宽 (Hz)
  peakTime: number      // 峰值时刻 (s)
  composite: number[]   // 三轴合成速度时程 (mm/s)
  isThreeAxis: boolean  // 是否三轴合成（false表示单轴兼容模式）
}

// ==================== GB 6722-2014 规范 ====================

/** 结构类型（对应GB表2） */
export type StructureType =
  | 'earthen'        // 土窑洞、土坯房、毛石房
  | 'brick'          // 一般砖房、非抗震大型砌块房
  | 'concrete'       // 钢筋混凝土框架房
  | 'industrial'     // 工业/商业建筑
  | 'historic'       // 古建筑/历史建筑
  | 'tunnel'         // 水工隧道/交通隧道
  | 'softSoil'       // 液化土/软土地基

/** 频率段（GB表2分段） */
export type FrequencyBand = 'low' | 'mid' | 'high'  // <10Hz, 10-50Hz, >50Hz

/** 结构状态 */
export type StructureCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged'

/** GB 6722-2014 表2 阈值范围 */
export interface ThresholdRange {
  min: number  // 下限（危房/敏感结构）
  max: number  // 上限（新建/良好结构）
}

/** GB 表2 完整数据结构 */
export interface GB6722Table2 {
  [key: string]: {
    low: ThresholdRange   // f < 10Hz
    mid: ThresholdRange   // 10Hz ≤ f ≤ 50Hz
    high: ThresholdRange  // f > 50Hz
  }
}

/** 动态阈值参数 */
export interface ThresholdParams {
  structureType: StructureType
  dominantFreq: number
  distance: number  // 爆源距离 (m)
  condition: StructureCondition
}

/** 三级阈值 */
export interface Thresholds {
  warn: number   // 预警值 (60%阈值)
  alert: number  // 报警值 (80%阈值)
  stop: number   // 停工值 (100%阈值)
}

// ==================== Sadovsky 公式 ====================

/** Sadovsky 公式参数 */
export interface SadovskyParams {
  K: number      // 场地系数 (50-500)
  alpha: number  // 衰减指数 (1.3-2.0)
  Q: number      // 齐发药量 (kg)
  R: number      // 距离 (m)
}

/** 场地类型 */
export type SiteType = 'hardRock' | 'softRock' | 'soil' | 'softSoil'

/** 场地系数 */
export interface SiteCoefficients {
  K: number
  alpha: number
}

// ==================== 安全评分 ====================

/** 安全等级 */
export type SafetyLevel = 'safe' | 'caution' | 'danger'

/** 安全评分输入 */
export interface SafetyScoreInput {
  ppvMax: number
  threshold: number
  duration: number
  alertCount: number
  dominantFreq: number
  exceedRatio: number  // 超限率 (%)
}

/** 安全评分结果 */
export interface SafetyScoreResult {
  score: number           // 0-100
  level: SafetyLevel
  factors: string[]       // 扣分因素
  recommendation: string  // 总体建议
}

// ==================== 施工建议 ====================

/** 预警等级 */
export type AlertLevel = 'safe' | 'warn' | 'alert' | 'stop'

/** 施工建议 */
export interface ConstructionAdvice {
  level: AlertLevel
  icon: string
  color: string
  message: string
  actions: string[]
}

// ==================== 通道数据 ====================

/** 通道状态 */
export type ChannelStatus = 'normal' | 'warning' | 'alert' | 'danger'

/** 通道信息 */
export interface ChannelInfo {
  channelId: number
  ppv: number
  dominantFreq: number
  status: ChannelStatus
  alertLevel: AlertLevel
  samplingRate: number
}

/** 通道详细数据 */
export interface ChannelDetail extends ChannelInfo {
  timeData: number[]
  freqData: FFTResult
  features: Record<string, number>
  ppvResult: PPVResult
  thresholds: Thresholds
  advice: ConstructionAdvice
}

// ==================== 报警记录 ====================

/** 报警记录 */
export interface AlertRecord {
  id: string
  timestamp: Date
  channelId: number
  ppv: number
  threshold: number
  level: AlertLevel
  message: string
}

// ==================== 数据集 ====================

/** 数据集元信息 */
export interface VibrationDataset {
  id: string
  name: string
  uploadTime: Date
  description?: string
  channelCount: number
  samplingRate: number
}

/** 数据集详情 */
export interface VibrationDatasetDetail extends VibrationDataset {
  channels: ChannelInfo[]
  maxPPV: number
  alertCount: number
  exceedRatio: number
  safetyScore: SafetyScoreResult
}

// ==================== 特征值 ====================

/** 16项振动特征 */
export interface VibrationFeatures {
  // 时域特征
  mean_value: number              // 均值
  standard_deviation: number      // 标准差
  kurtosis: number                // 峰度
  root_mean_square: number        // 均方根
  wave_form_factor: number        // 波形因子
  peak_factor: number             // 峰值因子
  pulse_factor: number            // 脉冲因子
  clearance_factor: number        // 间隙因子
  peak_value: number              // 峰值 (PPV)

  // 时频特征
  waveform_center: number         // 波形中心
  time_width: number              // 时间带宽

  // 频域特征
  center_frequency: number        // 中心频率
  frequency_variance: number      // 频率方差
  mean_square_frequency: number   // 均方频率
  root_mean_square_frequency: number  // 均方根频率
  frequency_standard_deviation: number  // 频率标准差
}

/** 精选8项特征（用于雷达图） */
export type SelectedFeatures = Pick<
  VibrationFeatures,
  | 'standard_deviation'
  | 'kurtosis'
  | 'root_mean_square'
  | 'peak_factor'
  | 'pulse_factor'
  | 'peak_value'
  | 'center_frequency'
  | 'frequency_variance'
>

// ==================== 配置 ====================

/** 全局配置 */
export interface VibrationConfig {
  structureType: StructureType
  structureCondition: StructureCondition
  siteType: SiteType
  distance: number  // 爆源距离 (m)
  visibleChannels: number[]  // 可见通道
}
