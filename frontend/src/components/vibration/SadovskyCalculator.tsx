/**
 * Sadovsky 预测工具组件
 * 输入药量/距离，预测PPV
 */

import React, { useState, useMemo } from 'react'
import { predictPPV, SITE_COEFFICIENTS } from '@/utils/vibration/gb6722'
import type { SiteType } from '@/utils/vibration/types'

interface SadovskyCalculatorProps {
  siteType: SiteType
  onSiteTypeChange: (siteType: SiteType) => void
}

export const SadovskyCalculator: React.FC<SadovskyCalculatorProps> = ({
  siteType,
  onSiteTypeChange
}) => {
  const [Q, setQ] = useState<number>(100)  // 药量 kg
  const [R, setR] = useState<number>(100)  // 距离 m

  // 获取场地系数
  const coefficients = SITE_COEFFICIENTS[siteType]

  // 预测 PPV
  const predictedPPV = useMemo(() => {
    return predictPPV({
      K: coefficients.K,
      alpha: coefficients.alpha,
      Q,
      R
    })
  }, [coefficients, Q, R])

  // 场地类型选项
  const siteTypeOptions: { value: SiteType; label: string }[] = [
    { value: 'hardRock', label: '坚硬岩石' },
    { value: 'softRock', label: '软岩' },
    { value: 'soil', label: '土层' },
    { value: 'softSoil', label: '软土' }
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
        <h4 className="mb-2 text-sm font-semibold text-cyan-400">
          Sadovsky 公式
        </h4>
        <div className="font-mono text-xs text-slate-300">
          V = K · (Q<sup>1/3</sup> / R)<sup>α</sup>
        </div>
      </div>

      {/* 场地类型 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          场地类型
        </label>
        <select
          value={siteType}
          onChange={(e) => onSiteTypeChange(e.target.value as SiteType)}
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          {siteTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="mt-1 text-xs text-slate-400">
          K = {coefficients.K}, α = {coefficients.alpha}
        </div>
      </div>

      {/* 齐发药量 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          齐发药量 (kg)
        </label>
        <input
          type="number"
          value={Q}
          onChange={(e) => setQ(Number(e.target.value))}
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          min="1"
          step="10"
        />
      </div>

      {/* 距离 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          距离 (m)
        </label>
        <input
          type="number"
          value={R}
          onChange={(e) => setR(Number(e.target.value))}
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          min="1"
          step="10"
        />
      </div>

      {/* 预测结果 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="text-xs text-slate-400 mb-2">预测 PPV</div>
        <div className="text-3xl font-bold text-cyan-400">
          {predictedPPV.toFixed(2)}
          <span className="text-lg text-slate-400 ml-2">mm/s</span>
        </div>
      </div>
    </div>
  )
}
