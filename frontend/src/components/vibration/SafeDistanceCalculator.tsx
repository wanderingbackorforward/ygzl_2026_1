/**
 * 安全距离计算器组件
 * 输入药量/阈值，计算最小安全距离
 */

import React, { useState, useMemo } from 'react'
import { calculateSafeDistance, SITE_COEFFICIENTS } from '@/utils/vibration/gb6722'
import type { SiteType } from '@/utils/vibration/types'

interface SafeDistanceCalculatorProps {
  siteType: SiteType
}

export const SafeDistanceCalculator: React.FC<SafeDistanceCalculatorProps> = ({
  siteType
}) => {
  const [Q, setQ] = useState<number>(100)        // 药量 kg
  const [V_limit, setVLimit] = useState<number>(20) // 允许振速 mm/s

  const coefficients = SITE_COEFFICIENTS[siteType]

  // 计算安全距离
  const safeDistance = useMemo(() => {
    if (V_limit <= 0 || Q <= 0) return 0
    return calculateSafeDistance(
      coefficients.K,
      coefficients.alpha,
      Q,
      V_limit
    )
  }, [coefficients, Q, V_limit])

  return (
    <div className="space-y-4">
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

      {/* 允许振速 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          允许振速 (mm/s)
        </label>
        <input
          type="number"
          value={V_limit}
          onChange={(e) => setVLimit(Number(e.target.value))}
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          min="0.1"
          step="1"
        />
      </div>

      {/* 计算结果 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="text-xs text-slate-400 mb-2">最小安全距离</div>
        <div className="text-3xl font-bold text-cyan-400">
          {safeDistance.toFixed(1)}
          <span className="text-lg text-slate-400 ml-2">m</span>
        </div>
      </div>

      {/* 公式说明 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="text-cyan-400 font-semibold">公式：</span>
          R = (K/V)<sup>1/α</sup> · Q<sup>1/3</sup>
          <br />
          当前参数：K={coefficients.K}, α={coefficients.alpha}
        </div>
      </div>
    </div>
  )
}
