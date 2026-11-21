/**
 * 安全距离计算器组件
 * 输入药量/阈值，计算最小安全距离
 */

import React, { useState, useEffect } from 'react'
import { calculateVibration } from '@/lib/api'
import type { SiteType } from '@/utils/vibration/types'

interface SafeDistanceCalculatorProps {
  siteType: SiteType
}

export const SafeDistanceCalculator: React.FC<SafeDistanceCalculatorProps> = ({
  siteType
}) => {
  const [Q, setQ] = useState<number>(100)        // 药量 kg
  const [V_limit, setVLimit] = useState<number>(20) // 允许振速 mm/s
  const [safeDistance, setSafeDistance] = useState<number | null>(null)
  const [coefficients, setCoefficients] = useState<{ K: number; alpha: number } | null>(null)
  const [calcError, setCalcError] = useState<string>('')

  // 安全距离由后端 /api/vibration/calculate 反算（防抖）
  useEffect(() => {
    if (V_limit <= 0 || Q <= 0) {
      setSafeDistance(null)
      setCalcError('药量与允许振速必须大于 0')
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await calculateVibration({ site_type: siteType, Q, v_limit: V_limit })
        if (cancelled) return
        setSafeDistance(result.safe_distance)
        setCoefficients(result.coefficients)
        setCalcError('')
      } catch (err) {
        if (cancelled) return
        setSafeDistance(null)
        setCalcError(err instanceof Error ? err.message : '计算失败')
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [siteType, Q, V_limit])

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
          {safeDistance === null ? '—' : safeDistance.toFixed(1)}
          <span className="text-lg text-slate-400 ml-2">m</span>
        </div>
      </div>

      {/* 公式说明 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="text-cyan-400 font-semibold">公式：</span>
          R = (K/V)<sup>1/α</sup> · Q<sup>1/3</sup>
          <br />
          当前参数：K={coefficients ? coefficients.K : '—'}, α={coefficients ? coefficients.alpha : '—'}
          {calcError && (
            <div className="mt-1 text-red-400">{calcError}</div>
          )}
        </div>
      </div>
    </div>
  )
}
