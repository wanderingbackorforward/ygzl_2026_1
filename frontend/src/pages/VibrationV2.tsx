/**
 * 振动监测 V2 主页面
 * 乔布斯式设计：Hero数字 + 主图 + 侧边抽屉
 */

import React, { useState, useEffect } from 'react'
import { HeroPPV } from '@/components/vibration/HeroPPV'
import type {
  VibrationDataset,
  StructureType,
  StructureCondition,
  SiteType,
  SafetyLevel
} from '@/utils/vibration/types'

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

  // 计算结果（临时mock数据）
  const [ppv, setPpv] = useState<number>(12.5)
  const [level, setLevel] = useState<SafetyLevel>('caution')
  const [score, setScore] = useState<number>(87)
  const [alertCount, setAlertCount] = useState<number>(3)
  const [exceedRatio, setExceedRatio] = useState<number>(2.1)

  // 侧边抽屉
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // 设置抽屉
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)

  // ==================== 数据加载 ====================

  useEffect(() => {
    // TODO: 从 API 加载数据集列表
    // fetch('/api/vibration/datasets')
    //   .then(res => res.json())
    //   .then(data => setDatasets(data))
  }, [])

  useEffect(() => {
    if (selectedDatasetId) {
      // TODO: 加载选中数据集的详细数据
      // TODO: 调用算法层计算 PPV/阈值/评分
    }
  }, [selectedDatasetId, structureType, structureCondition, distance])

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
              className="rounded-md bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-600"
              onClick={() => {
                // TODO: 导出功能
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
          ppv={ppv}
          level={level}
          score={score}
          alertCount={alertCount}
          exceedRatio={exceedRatio}
        />
      </div>

      {/* 主内容区域 */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧：PPV 趋势图（占 65%） */}
        <div className="flex min-h-0 flex-1 flex-col border-r border-slate-700 p-6">
          <div className="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
            <p className="text-slate-400">PPV 趋势图（待实现）</p>
          </div>
        </div>

        {/* 右侧：通道概览 + 报警记录（占 35%） */}
        <div className="flex w-[35%] min-h-0 flex-col">
          {/* 通道概览 */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-slate-700 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">通道概览</h3>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {/* TODO: 通道列表 */}
              <p className="text-sm text-slate-400">通道列表（待实现）</p>
            </div>
          </div>

          {/* 报警记录 */}
          <div className="flex shrink-0 flex-col border-t border-slate-700 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">报警记录</h3>
            <div className="space-y-2">
              {/* TODO: 报警记录列表 */}
              <p className="text-sm text-slate-400">报警记录（待实现）</p>
            </div>
          </div>
        </div>
      </div>

      {/* 侧边抽屉（通道详情） */}
      {isDrawerOpen && selectedChannelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* 抽屉内容 */}
          <div className="relative h-full w-[40%] bg-slate-900 shadow-xl">
            <div className="flex h-full flex-col">
              {/* 抽屉头部 */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white">
                  通道 {selectedChannelId} 详情
                </h2>
                <button
                  className="text-slate-400 hover:text-white"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* 抽屉内容 */}
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <p className="text-slate-400">通道详情（待实现）</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设置抽屉 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsSettingsOpen(false)}
          />

          {/* 抽屉内容 */}
          <div className="relative h-full w-[30%] bg-slate-900 shadow-xl">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VibrationV2
