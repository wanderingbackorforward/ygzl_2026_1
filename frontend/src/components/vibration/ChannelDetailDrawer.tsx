/**
 * 通道详情抽屉组件
 * 集成时域波形、频谱FFT、特征雷达、施工建议
 */

import React, { useMemo } from 'react'
import { TimeSeriesChart } from './TimeSeriesChart'
import { FrequencySpectrumChart } from './FrequencySpectrumChart'
import { FeatureRadarChart } from './FeatureRadarChart'
import { ConstructionAdviceCard } from './ConstructionAdviceCard'
import type {
  ChannelInfo,
  PPVResult,
  FFTResult,
  VibrationFeatures,
  Thresholds,
  ConstructionAdvice
} from '@/utils/vibration/types'
import { performFFT } from '@/utils/vibration/signalProcessing'
import { getConstructionAdvice } from '@/utils/vibration/gb6722'

interface ChannelDetailDrawerProps {
  channel: ChannelInfo
  timeData: number[]
  amplitude: number[]
  ppvResult: PPVResult
  thresholds: Thresholds
  features: VibrationFeatures
  onClose: () => void
}

export const ChannelDetailDrawer: React.FC<ChannelDetailDrawerProps> = ({
  channel,
  timeData,
  amplitude,
  ppvResult,
  thresholds,
  features,
  onClose
}) => {
  // 计算 FFT
  const fftResult: FFTResult = useMemo(() => {
    return performFFT(amplitude, channel.samplingRate)
  }, [amplitude, channel.samplingRate])

  // 生成施工建议
  const advice: ConstructionAdvice = useMemo(() => {
    return getConstructionAdvice(
      channel.ppv,
      channel.dominantFreq,
      channel.alertLevel
    )
  }, [channel.ppv, channel.dominantFreq, channel.alertLevel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div className="relative h-full w-[40%] bg-slate-900 shadow-xl animate-in slide-in-from-right duration-300">
        <div className="flex h-full flex-col">
          {/* 抽屉头部 */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-700 p-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                通道 {channel.channelId} 详情
              </h2>
              <div className="mt-1 flex items-center gap-4 text-sm text-slate-300">
                <span>PPV: <span className="font-semibold text-cyan-400">{channel.ppv.toFixed(2)} mm/s</span></span>
                <span>主频: <span className="font-semibold text-cyan-400">{channel.dominantFreq.toFixed(1)} Hz</span></span>
              </div>
            </div>
            <button
              className="text-slate-400 hover:text-white text-2xl"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* 抽屉内容 */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
            {/* 新增指标卡片 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 振动持续时间 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs text-slate-400 mb-1">振动持续时间</div>
                <div className="text-2xl font-bold text-white">
                  {ppvResult.duration.toFixed(2)}
                  <span className="text-sm text-slate-400 ml-1">s</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {ppvResult.duration > 0.5 ? '持续时间较长' : '持续时间正常'}
                </div>
              </div>

              {/* 主频带宽 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs text-slate-400 mb-1">主频带宽</div>
                <div className="text-2xl font-bold text-white">
                  {ppvResult.bandwidth.toFixed(1)}
                  <span className="text-sm text-slate-400 ml-1">Hz</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {ppvResult.bandwidth < 5 ? '窄带振动' : '宽带振动'}
                </div>
              </div>

              {/* 峰值时刻 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs text-slate-400 mb-1">峰值时刻</div>
                <div className="text-2xl font-bold text-white">
                  {ppvResult.peakTime.toFixed(2)}
                  <span className="text-sm text-slate-400 ml-1">s</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  振动峰值出现时间
                </div>
              </div>

              {/* 三轴合成标识 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs text-slate-400 mb-1">数据类型</div>
                <div className="text-2xl font-bold text-white">
                  {ppvResult.isThreeAxis ? '三轴' : '单轴'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {ppvResult.isThreeAxis ? 'GB规范合成' : '兼容模式'}
                </div>
              </div>
            </div>

            {/* 时域波形图 */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="h-[300px]">
                <TimeSeriesChart
                  timeData={timeData}
                  amplitude={amplitude}
                  ppv={ppvResult.ppv}
                  peakTime={ppvResult.peakTime}
                  channelId={channel.channelId}
                />
              </div>
            </div>

            {/* 频谱FFT图 */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="h-[250px]">
                <FrequencySpectrumChart
                  fftResult={fftResult}
                  channelId={channel.channelId}
                />
              </div>
            </div>

            {/* 特征雷达图 */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="h-[300px]">
                <FeatureRadarChart
                  features={features}
                  channelId={channel.channelId}
                />
              </div>
            </div>

            {/* 施工建议 */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">施工建议</h3>
              <ConstructionAdviceCard advice={advice} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
