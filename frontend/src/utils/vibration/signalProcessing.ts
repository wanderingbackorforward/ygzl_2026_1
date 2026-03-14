/**
 * 信号处理工具函数
 * 包含滤波、FFT、三轴合成等核心算法
 */

import Fili from 'fili'
import FFT from 'fft.js'
import type {
  ThreeAxisData,
  SingleAxisData,
  FFTResult,
  PPVResult
} from './types'

// ==================== Butterworth 带通滤波器 ====================

/**
 * 创建 Butterworth 带通滤波器
 * @param samplingRate 采样率 (Hz)
 * @param lowCutoff 低截止频率 (Hz)
 * @param highCutoff 高截止频率 (Hz)
 * @param order 滤波器阶数（默认4阶）
 */
export function createButterworthBandpass(
  samplingRate: number,
  lowCutoff: number,
  highCutoff: number,
  order: number = 4
) {
  const iirCalculator = new Fili.CalcCascades()

  // 计算滤波器系数
  const coeffs = iirCalculator.bandpass({
    order,
    characteristic: 'butterworth',
    Fs: samplingRate,
    Fc: lowCutoff,
    F2: highCutoff,
    BW: 1,  // 带宽参数
    gain: 0,
    preGain: false
  })

  // 创建滤波器实例
  const filter = new Fili.IirFilter(coeffs)

  return filter
}

/**
 * 应用 Butterworth 带通滤波
 * @param data 输入信号
 * @param samplingRate 采样率 (Hz)
 * @param lowCutoff 低截止频率 (Hz，默认0.5)
 * @param highCutoff 高截止频率 (Hz，默认100)
 * @param order 滤波器阶数（默认4）
 */
export function butterworthBandpass(
  data: number[],
  samplingRate: number,
  lowCutoff: number = 0.5,
  highCutoff: number = 100,
  order: number = 4
): number[] {
  if (data.length === 0) return []

  const filter = createButterworthBandpass(samplingRate, lowCutoff, highCutoff, order)

  // 应用滤波（单次滤波）
  const filtered = filter.multiStep(data)

  return filtered
}

// ==================== FFT 计算 ====================

/**
 * 执行 FFT 并计算频谱
 * @param signal 时域信号
 * @param samplingRate 采样率 (Hz)
 * @returns FFT 结果
 */
export function performFFT(signal: number[], samplingRate: number): FFTResult {
  const n = signal.length

  // FFT 要求长度为2的幂次，补零到最近的2的幂次
  const fftSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const paddedSignal = new Array(fftSize).fill(0)
  for (let i = 0; i < n; i++) {
    paddedSignal[i] = signal[i]
  }

  // 创建 FFT 实例
  const fft = new FFT(fftSize)

  // 执行 FFT
  const out = fft.createComplexArray()
  fft.realTransform(out, paddedSignal)
  fft.completeSpectrum(out)

  // 计算幅值谱（只取前半部分，因为对称）
  const halfSize = fftSize / 2
  const amplitudes: number[] = []
  const frequencies: number[] = []

  for (let i = 0; i < halfSize; i++) {
    const real = out[2 * i]
    const imag = out[2 * i + 1]
    const amplitude = Math.sqrt(real * real + imag * imag) / fftSize
    amplitudes.push(amplitude)
    frequencies.push((i * samplingRate) / fftSize)
  }

  // 找到峰值频率
  let peakIndex = 0
  let peakAmplitude = amplitudes[0]
  for (let i = 1; i < amplitudes.length; i++) {
    if (amplitudes[i] > peakAmplitude) {
      peakAmplitude = amplitudes[i]
      peakIndex = i
    }
  }
  const peakFrequency = frequencies[peakIndex]

  // 计算半功率带宽（-3dB带宽）
  const halfPower = peakAmplitude / Math.sqrt(2)
  let lowerIndex = peakIndex
  let upperIndex = peakIndex

  // 向左找下限
  while (lowerIndex > 0 && amplitudes[lowerIndex] > halfPower) {
    lowerIndex--
  }

  // 向右找上限
  while (upperIndex < amplitudes.length - 1 && amplitudes[upperIndex] > halfPower) {
    upperIndex++
  }

  const bandwidth = frequencies[upperIndex] - frequencies[lowerIndex]

  return {
    frequencies,
    amplitudes,
    peakFrequency,
    peakAmplitude,
    bandwidth
  }
}

// ==================== 三轴合成 PPV 计算 ====================

/**
 * 计算三轴合成 PPV（符合 GB 6722-2014）
 * @param data 三轴振动数据
 * @returns PPV 计算结果
 */
export function calculateThreeAxisPPV(data: ThreeAxisData): PPVResult {
  const { x, y, z, samplingRate } = data

  // 1. 带通滤波 0.5-100Hz（工程振动有效频段）
  const filteredX = butterworthBandpass(x, samplingRate, 0.5, 100, 4)
  const filteredY = butterworthBandpass(y, samplingRate, 0.5, 100, 4)
  const filteredZ = butterworthBandpass(z, samplingRate, 0.5, 100, 4)

  // 2. 三轴合成速度 V(t) = √(Vx² + Vy² + Vz²)
  const composite: number[] = []
  for (let i = 0; i < filteredX.length; i++) {
    const vx = filteredX[i]
    const vy = filteredY[i]
    const vz = filteredZ[i]
    composite.push(Math.sqrt(vx * vx + vy * vy + vz * vz))
  }

  // 3. 峰值质点速度 PPV
  const ppv = Math.max(...composite)
  const peakIndex = composite.indexOf(ppv)
  const peakTime = peakIndex / samplingRate

  // 4. 振动持续时间（超过 0.1*PPV 的时长，GB 要求）
  const threshold = ppv * 0.1
  const exceedIndices: number[] = []
  for (let i = 0; i < composite.length; i++) {
    if (composite[i] > threshold) {
      exceedIndices.push(i)
    }
  }

  const duration =
    exceedIndices.length > 0
      ? (exceedIndices[exceedIndices.length - 1] - exceedIndices[0]) / samplingRate
      : 0

  // 5. 主频和带宽（FFT 分析）
  const fftResult = performFFT(composite, samplingRate)

  return {
    ppv,
    duration,
    dominantFreq: fftResult.peakFrequency,
    bandwidth: fftResult.bandwidth,
    peakTime,
    composite,
    isThreeAxis: true
  }
}

/**
 * 计算单轴 PPV（兼容模式，未三轴合成）
 * @param data 单轴振动数据
 * @returns PPV 计算结果
 */
export function calculateSingleAxisPPV(data: SingleAxisData): PPVResult {
  const { amplitude, samplingRate } = data

  // 1. 带通滤波 0.5-100Hz
  const filtered = butterworthBandpass(amplitude, samplingRate, 0.5, 100, 4)

  // 2. 峰值（单轴绝对值最大）
  const ppv = Math.max(...filtered.map(Math.abs))
  const peakIndex = filtered.findIndex(v => Math.abs(v) === ppv)
  const peakTime = peakIndex / samplingRate

  // 3. 振动持续时间
  const threshold = ppv * 0.1
  const exceedIndices: number[] = []
  for (let i = 0; i < filtered.length; i++) {
    if (Math.abs(filtered[i]) > threshold) {
      exceedIndices.push(i)
    }
  }

  const duration =
    exceedIndices.length > 0
      ? (exceedIndices[exceedIndices.length - 1] - exceedIndices[0]) / samplingRate
      : 0

  // 4. 主频和带宽
  const fftResult = performFFT(filtered, samplingRate)

  return {
    ppv,
    duration,
    dominantFreq: fftResult.peakFrequency,
    bandwidth: fftResult.bandwidth,
    peakTime,
    composite: filtered,
    isThreeAxis: false  // 标记为单轴兼容模式
  }
}

// ==================== 工具函数 ====================

/**
 * 降采样（用于图表显示）
 * @param data 原始数据
 * @param targetLength 目标长度
 */
export function downsample(data: number[], targetLength: number): number[] {
  if (data.length <= targetLength) return data

  const step = data.length / targetLength
  const result: number[] = []

  for (let i = 0; i < targetLength; i++) {
    const index = Math.floor(i * step)
    result.push(data[index])
  }

  return result
}

/**
 * 归一化（用于雷达图）
 * @param value 原始值
 * @param min 最小值
 * @param max 最大值
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}
