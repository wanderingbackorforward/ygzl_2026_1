/**
 * 振动监测 V2 主页面
 * 乔布斯式设计：Hero数字 + 主图 + 侧边抽屉
 */

import React, { useState, useEffect, useMemo } from 'react'
import { HeroPPV } from '@/components/vibration/HeroPPV'
import { PPVTrendChart } from '@/components/vibration/PPVTrendChart'
import { ChannelList } from '@/components/vibration/ChannelList'
import { AlertHistory } from '@/components/vibration/AlertHistory'
import { ChannelDetailDrawer } from '@/components/vibration/ChannelDetailDrawer'
import { SadovskyCalculator } from '@/components/vibration/SadovskyCalculator'
import { SafeDistanceCalculator } from '@/components/vibration/SafeDistanceCalculator'
import type {
  VibrationDataset,
  StructureType,
  StructureCondition,
  SiteType,
  SafetyLevel,
  ChannelInfo,
  AlertRecord,
  Thresholds
} from '@/utils/vibration/types'
import { getDynamicThreshold, calculateSafetyScore, getAlertLevel } from '@/utils/vibration/gb6722'
import { exportChannelsCSV } from '@/utils/vibration/exportUtils'

// 通道颜色配置
const CHANNEL_COLORS = [
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
  '#f97316'  // orange-500
]

export const VibrationV2: React.FC = () => {
  // ==================== 状态管理 ====================

  // 数据集列表
  const [datasets, setDatasets] = useState<VibrationDataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')

  // 配置
  const [structureType, setStructureType] = useState<StructureType>('brick')
  const [structureCondition, setStructureCondition] = useState<StructureCondition>('good')
  const [siteType, setSiteType] = useState<SiteType>('soil')
  const [distance, setDistance] = useState<number>(100)

  // 通道数据（mock）
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [channelTrendData, setChannelTrendData] = useState<any[]>([])

  // 报警记录（mock）
  const [alerts, setAlerts] = useState<AlertRecord[]>([])

  // 侧边抽屉
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // 设置抽屉
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)

  // ==================== Mock 数据生成 ====================

  useEffect(() => {
    // 生成 mock 数据集列表
    const mockDatasets: VibrationDataset[] = [
      {
        id: '1',
        name: '2026-03-15 爆破监测数据',
        uploadTime: new Date('2026-03-15T14:30:00'),
        description: '某隧道爆破振动监测',
        channelCount: 8,
        samplingRate: 1000
      }
    ]
    setDatasets(mockDatasets)
    setSelectedDatasetId('1')

    // 生成 mock 通道数据
    const mockChannels: ChannelInfo[] = []
    const mockTrendData: any[] = []
    const mockAlerts: AlertRecord[] = []

    for (let i = 1; i <= 8; i++) {
      // 生成随机 PPV 和主频
      const ppv = Math.random() * 15 + 2  // 2-17 mm/s
      const dominantFreq = Math.random() * 40 + 10  // 10-50 Hz

      // 计算阈值
      const thresholds = getDynamicThreshold({
        structureType,
        dominantFreq,
        distance,
        condition: structureCondition
      })

      // 判定预警等级
      const alertLevel = getAlertLevel(ppv, thresholds)

      mockChannels.push({
        channelId: i,
        ppv,
        dominantFreq,
        status: alertLevel === 'safe' ? 'normal' : alertLevel === 'warn' ? 'warning' : 'alert',
        alertLevel,
        samplingRate: 1000
      })

      // 生成趋势数据（模拟 10 秒数据）
      const timestamps: number[] = []
      const ppvTimeSeries: number[] = []
      for (let t = 0; t <= 10; t += 0.01) {
        timestamps.push(t)
        // 模拟振动波形（衰减正弦波）
        const amplitude = ppv * Math.exp(-t / 3) * (1 + 0.3 * Math.sin(2 * Math.PI * dominantFreq * t / 10))
        ppvTimeSeries.push(Math.max(0, amplitude))
      }

      mockTrendData.push({
        channelId: i,
        ppvTimeSeries,
        timestamps,
        color: CHANNEL_COLORS[i - 1],
        visible: true
      })

      // 生成报警记录
      if (alertLevel !== 'safe') {
        mockAlerts.push({
          id: `alert-${i}`,
          timestamp: new Date(Date.now() - Math.random() * 3600000),  // 过去1小时内
          channelId: i,
          ppv,
          threshold: thresholds.warn,
          level: alertLevel,
          message: `通道${i} PPV=${ppv.toFixed(1)} mm/s`
        })
      }
    }

    // 按时间倒序排序
    mockAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    setChannels(mockChannels)
    setChannelTrendData(mockTrendData)
    setAlerts(mockAlerts)
  }, [structureType, structureCondition, distance])

  // ==================== 计算汇总数据 ====================

  const summaryData = useMemo(() => {
    if (channels.length === 0) {
      return {
        maxPPV: 0,
        level: 'safe' as SafetyLevel,
        score: 100,
        alertCount: 0,
        exceedRatio: 0,
        thresholds: { warn: 0, alert: 0, stop: 0 }
      }
    }

    // 找到最大 PPV
    const maxPPV = Math.max(...channels.map(ch => ch.ppv))
    const maxChannel = channels.find(ch => ch.ppv === maxPPV)!

    // 计算阈值（使用最大 PPV 通道的主频）
    const thresholds = getDynamicThreshold({
      structureType,
      dominantFreq: maxChannel.dominantFreq,
      distance,
      condition: structureCondition
    })

    // 计算报警次数
    const alertCount = channels.filter(ch => ch.alertLevel !== 'safe').length

    // 计算超限率（假设每个通道有1000个采样点）
    const totalPoints = channels.length * 1000
    const exceedPoints = channels.reduce((sum, ch) => {
      return sum + (ch.ppv > thresholds.warn ? 100 : 0)  // 简化计算
    }, 0)
    const exceedRatio = (exceedPoints / totalPoints) * 100

    // 计算安全评分
    const scoreResult = calculateSafetyScore({
      ppvMax: maxPPV,
      threshold: thresholds.stop,
      duration: 0.5,  // mock 持续时间
      alertCount,
      dominantFreq: maxChannel.dominantFreq,
      exceedRatio
    })

    return {
      maxPPV,
      level: scoreResult.level,
      score: scoreResult.score,
      alertCount,
      exceedRatio,
      thresholds
    }
  }, [channels, structureType, structureCondition, distance])

  // ==================== 事件处理 ====================

  const handleChannelClick = (channelId: number) => {
    setSelectedChannelId(channelId)
    setIsDrawerOpen(true)
  }

  // ==================== 结构类型选项 ====================

  const structureTypeOptions: { value: StructureType; label: string }[] = [
    { value: 'earthen', label: '土窑洞/土坯房' },
    { value: 'brick', label: '一般砖房' },
    { value: 'concrete', label: '钢筋混凝土' },
    { value: 'industrial', label: '工业建筑' },
    { value: 'historic', label: '古建筑' },
    { value: 'tunnel', label: '隧道' },
    { value: 'softSoil', label: '软土地基' }
  ]

  const structureConditionOptions: { value: StructureCondition; label: string }[] = [
    { value: 'new', label: '新建' },
    { value: 'good', label: '良好' },
    { value: 'fair', label: '一般' },
    { value: 'poor', label: '较差' },
    { value: 'damaged', label: '危房' }
  ]

  // ==================== 渲染 ====================

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      {/* 顶栏 */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左侧：标题 + 选择器 */}
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">振动监测</h1>

            {/* 数据集选择 */}
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">选择数据集</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>

            {/* 结构类型选择 */}
            <select
              value={structureType}
              onChange={(e) => setStructureType(e.target.value as StructureType)}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {structureTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-3">
            <button
              className="rounded-md bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
              onClick={() => {
                exportChannelsCSV(channels, summaryData.thresholds, {
                  score: summaryData.score,
                  level: summaryData.level,
                  factors: [],
                  recommendation: ''
                })
              }}
            >
              导出
            </button>
            <button
              className="rounded-md bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-600"
              onClick={() => setIsSettingsOpen(true)}
            >
              设置
            </button>
          </div>
        </div>
      </div>

      {/* Hero PPV */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-900">
        <HeroPPV
          ppv={summaryData.maxPPV}
          level={summaryData.level}
          score={summaryData.score}
          alertCount={summaryData.alertCount}
          exceedRatio={summaryData.exceedRatio}
        />
      </div>

      {/* 主内容区域 */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧：PPV 趋势图（占 65%） */}
        <div className="flex min-h-0 flex-1 flex-col border-r border-slate-700 p-6">
          <PPVTrendChart
            channelsData={channelTrendData}
            thresholds={summaryData.thresholds}
            highlightedChannelId={selectedChannelId}
            onChannelClick={handleChannelClick}
          />
        </div>

        {/* 右侧：通道概览 + 报警记录（占 35%） */}
        <div className="flex w-[35%] min-h-0 flex-col">
          {/* 通道概览 */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-slate-700 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">通道概览</h3>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChannelList
                channels={channels}
                selectedChannelId={selectedChannelId}
                onChannelClick={handleChannelClick}
              />
            </div>
          </div>

          {/* 报警记录 */}
          <div className="flex shrink-0 flex-col border-t border-slate-700 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">报警记录</h3>
            <AlertHistory alerts={alerts} maxCount={5} />
          </div>
        </div>
      </div>

      {/* 侧边抽屉（通道详情） */}
      {isDrawerOpen && selectedChannelId !== null && (() => {
        const channel = channels.find(ch => ch.channelId === selectedChannelId)
        const trendData = channelTrendData.find(td => td.channelId === selectedChannelId)

        if (!channel || !trendData) return null

        // 生成 mock 特征数据
        const mockFeatures = {
          mean_value: Math.random() * 2,
          standard_deviation: Math.random() * 5,
          kurtosis: Math.random() * 8,
          root_mean_square: channel.ppv * 0.7,
          wave_form_factor: 1 + Math.random() * 0.5,
          peak_factor: 2 + Math.random() * 2,
          pulse_factor: 2 + Math.random() * 2,
          clearance_factor: 3 + Math.random() * 5,
          peak_value: channel.ppv,
          waveform_center: Math.random() * 3,
          time_width: Math.random() * 1.5,
          center_frequency: channel.dominantFreq,
          frequency_variance: Math.random() * 300,
          mean_square_frequency: Math.random() * 800,
          root_mean_square_frequency: channel.dominantFreq * 0.8,
          frequency_standard_deviation: Math.random() * 20
        }

        // 生成 mock PPV 结果
        const mockPPVResult = {
          ppv: channel.ppv,
          duration: 0.3 + Math.random() * 0.5,
          dominantFreq: channel.dominantFreq,
          bandwidth: 3 + Math.random() * 5,
          peakTime: 2 + Math.random() * 3,
          composite: trendData.ppvTimeSeries,
          isThreeAxis: true
        }

        return (
          <ChannelDetailDrawer
            channel={channel}
            timeData={trendData.timestamps}
            amplitude={trendData.ppvTimeSeries}
            ppvResult={mockPPVResult}
            thresholds={summaryData.thresholds}
            features={mockFeatures}
            onClose={() => setIsDrawerOpen(false)}
          />
        )
      })()}

      {/* 设置抽屉 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsSettingsOpen(false)}
          />

          {/* 抽屉内容 */}
          <div className="relative h-full w-[30%] bg-slate-900 shadow-xl animate-in slide-in-from-right duration-300">
            <div className="flex h-full flex-col">
              {/* 抽屉头部 */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white">设置</h2>
                <button
                  className="text-slate-400 hover:text-white"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* 抽屉内容 */}
              <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                {/* 结构状态 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    结构状态
                  </label>
                  <select
                    value={structureCondition}
                    onChange={(e) => setStructureCondition(e.target.value as StructureCondition)}
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {structureConditionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 爆源距离 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    爆源距离 (m)
                  </label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    min="0"
                    step="10"
                  />
                </div>

                {/* GB 6722-2014 说明 */}
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-cyan-400">
                    GB 6722-2014 规范说明
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    阈值根据结构类型、主频、距离和结构状态动态计算。
                    预警值=60%阈值，报警值=80%阈值，停工值=100%阈值。
                  </p>
                </div>

                {/* 分隔线 */}
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="mb-4 text-sm font-semibold text-white">PPV 预测工具</h3>
                  <SadovskyCalculator
                    siteType={siteType}
                    onSiteTypeChange={setSiteType}
                  />
                </div>

                {/* 安全距离计算 */}
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="mb-4 text-sm font-semibold text-white">安全距离计算</h3>
                  <SafeDistanceCalculator siteType={siteType} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VibrationV2
