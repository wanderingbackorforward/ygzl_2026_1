import { useMemo } from 'react'
import { EChartsWrapper } from '../charts/EChartsWrapper'
import type { DeviationRecord, PredictionResult } from './types'
import { slidingMean } from './types'
import type { EChartsOption } from 'echarts'

interface Props {
  records: DeviationRecord[]
  selectedRing: number | null
  onRingSelect: (ring: number) => void
  prediction: PredictionResult | null
}

export default function DeviationProfile({ records, selectedRing, onRingSelect, prediction }: Props) {
  const rings = useMemo(() => records.map((r) => r.ring_no), [records])
  const hDevs = useMemo(() => records.map((r) => r.h_dev_mm), [records])
  const vDevs = useMemo(() => records.map((r) => r.v_dev_mm), [records])
  const hMean = useMemo(() => slidingMean(hDevs, 10), [hDevs])
  const vMean = useMemo(() => slidingMean(vDevs, 10), [vDevs])

  // prediction extension
  const predRings = useMemo(() => prediction?.h_prediction?.map((p) => p.ring_no) || [], [prediction])
  const hPredVals = useMemo(() => prediction?.h_prediction?.map((p) => p.predicted_mm) || [], [prediction])
  const hPredUpper = useMemo(() => prediction?.h_prediction?.map((p) => p.upper_mm) || [], [prediction])
  const hPredLower = useMemo(() => prediction?.h_prediction?.map((p) => p.lower_mm) || [], [prediction])
  const vPredVals = useMemo(() => prediction?.v_prediction?.map((p) => p.predicted_mm) || [], [prediction])
  const vPredUpper = useMemo(() => prediction?.v_prediction?.map((p) => p.upper_mm) || [], [prediction])
  const vPredLower = useMemo(() => prediction?.v_prediction?.map((p) => p.lower_mm) || [], [prediction])

  const allRings = useMemo(() => [...rings, ...predRings], [rings, predRings])

  const markLineData = [
    { yAxis: 50, lineStyle: { color: '#ef4444', type: 'dashed' as const }, label: { formatter: '+50mm', color: '#ef4444' } },
    { yAxis: -50, lineStyle: { color: '#ef4444', type: 'dashed' as const }, label: { formatter: '-50mm', color: '#ef4444' } },
  ]

  const hOption = useMemo((): EChartsOption => ({
    backgroundColor: 'transparent',
    grid: { left: 55, right: 20, top: 30, bottom: 50 },
    tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#fff' } },
    xAxis: { type: 'category', data: allRings, name: '环号', nameGap: 25, axisLabel: { color: '#cbd5e1' }, nameTextStyle: { color: '#cbd5e1' } },
    yAxis: { type: 'value', name: '水平偏差(mm)', axisLabel: { color: '#cbd5e1' }, nameTextStyle: { color: '#cbd5e1' }, splitLine: { lineStyle: { color: '#334155' } } },
    dataZoom: [{ type: 'slider', height: 20, bottom: 5, textStyle: { color: '#cbd5e1' } }],
    series: [
      { name: '水平偏差', type: 'line', data: [...hDevs, ...Array(predRings.length).fill(null)], smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#22d3ee' }, markLine: { silent: true, data: markLineData } },
      { name: '滑动均值', type: 'line' as const, data: [...hMean, ...Array(predRings.length).fill(null)], smooth: true, symbol: 'none', lineStyle: { width: 1, color: '#94a3b8', type: 'dashed' as const } },
      ...(hPredVals.length ? [
        { name: '预测', type: 'line' as const, data: [...Array(rings.length).fill(null), ...hPredVals], smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#a78bfa', type: 'dashed' as const } },
        { name: '预测上界', type: 'line' as const, data: [...Array(rings.length).fill(null), ...hPredUpper], symbol: 'none', lineStyle: { width: 0 }, areaStyle: { color: 'rgba(167,139,250,0.15)' } },
        { name: '预测下界', type: 'line' as const, data: [...Array(rings.length).fill(null), ...hPredLower], symbol: 'none', lineStyle: { width: 0 } },
      ] : []),
    ],
  }), [allRings, hDevs, hMean, hPredVals, hPredUpper, hPredLower, rings.length, predRings.length])

  const vOption = useMemo((): EChartsOption => ({
    backgroundColor: 'transparent',
    grid: { left: 55, right: 20, top: 30, bottom: 50 },
    tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#fff' } },
    xAxis: { type: 'category', data: allRings, name: '环号', nameGap: 25, axisLabel: { color: '#cbd5e1' }, nameTextStyle: { color: '#cbd5e1' } },
    yAxis: { type: 'value', name: '竖直偏差(mm)', axisLabel: { color: '#cbd5e1' }, nameTextStyle: { color: '#cbd5e1' }, splitLine: { lineStyle: { color: '#334155' } } },
    dataZoom: [{ type: 'slider', height: 20, bottom: 5, textStyle: { color: '#cbd5e1' } }],
    series: [
      { name: '竖直偏差', type: 'line', data: [...vDevs, ...Array(predRings.length).fill(null)], smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#f97316' }, markLine: { silent: true, data: markLineData } },
      { name: '滑动均值', type: 'line' as const, data: [...vMean, ...Array(predRings.length).fill(null)], smooth: true, symbol: 'none', lineStyle: { width: 1, color: '#94a3b8', type: 'dashed' as const } },
      ...(vPredVals.length ? [
        { name: '预测', type: 'line' as const, data: [...Array(rings.length).fill(null), ...vPredVals], smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#a78bfa', type: 'dashed' as const } },
        { name: '预测上界', type: 'line' as const, data: [...Array(rings.length).fill(null), ...vPredUpper], symbol: 'none', lineStyle: { width: 0 }, areaStyle: { color: 'rgba(167,139,250,0.15)' } },
        { name: '预测下界', type: 'line' as const, data: [...Array(rings.length).fill(null), ...vPredLower], symbol: 'none', lineStyle: { width: 0 } },
      ] : []),
    ],
  }), [allRings, vDevs, vMean, vPredVals, vPredUpper, vPredLower, rings.length, predRings.length])

  if (!records.length) {
    return <div className="text-center text-white py-8">暂无偏差数据</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-1 text-sm font-medium text-white">水平偏差纵断面</div>
        <div style={{ height: 280 }}>
          <EChartsWrapper option={hOption} />
        </div>
      </div>
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-1 text-sm font-medium text-white">竖直偏差纵断面</div>
        <div style={{ height: 280 }}>
          <EChartsWrapper option={vOption} />
        </div>
      </div>
      {prediction?.regression && (
        <div className="flex gap-4 text-sm text-white">
          <span>水平趋势斜率: {prediction.regression.h_slope} (R2={prediction.regression.h_r2})</span>
          <span>竖直趋势斜率: {prediction.regression.v_slope} (R2={prediction.regression.v_r2})</span>
          {prediction.h_exceed_ring && <span className="text-red-400">预计第{prediction.h_exceed_ring}环水平超限</span>}
          {prediction.v_exceed_ring && <span className="text-red-400">预计第{prediction.v_exceed_ring}环竖直超限</span>}
        </div>
      )}
    </div>
  )
}
