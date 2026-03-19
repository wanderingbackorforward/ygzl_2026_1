import { useMemo } from 'react'
import { EChartsWrapper } from '../charts/EChartsWrapper'
import type { DeviationRecord, DeviationSummary, CorrectionAdvice } from './types'
import { computeHistogram } from './types'
import type { EChartsOption } from 'echarts'

interface Props {
  summary: DeviationSummary | null
  correction: CorrectionAdvice | null
  records: DeviationRecord[]
}

export default function DeviationStats({ summary, correction, records }: Props) {
  const histOption: EChartsOption = useMemo(() => {
    const vals = records.map((r) => r.h_dev_mm)
    if (!vals.length) return {}
    const { bins, binWidth, min: mn, max: mx } = computeHistogram(vals, 25)
    // normal curve overlay
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1
    const normalY = bins.map((b) => {
      const z = (b.center - mean) / std
      return Math.round(vals.length * binWidth * Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI)))
    })
    return {
      backgroundColor: 'transparent',
      grid: { left: 45, right: 15, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#fff' } },
      xAxis: { type: 'category', data: bins.map((b) => b.center.toFixed(0)), axisLabel: { color: '#cbd5e1' } },
      yAxis: { type: 'value', axisLabel: { color: '#cbd5e1' }, splitLine: { lineStyle: { color: '#334155' } } },
      series: [
        { type: 'bar', data: bins.map((b) => b.count), barWidth: '80%', itemStyle: { color: '#22d3ee', borderRadius: [2, 2, 0, 0] } },
        { type: 'line', data: normalY, smooth: true, symbol: 'none', lineStyle: { color: '#f97316', width: 2 } },
      ],
    }
  }, [records])

  if (!summary) {
    return <div className="text-center text-white py-4">暂无统计数据</div>
  }

  const rows = [
    { label: '最大值', h: summary.h_dev.max, v: summary.v_dev.max, r: summary.roll.max },
    { label: '最小值', h: summary.h_dev.min, v: summary.v_dev.min, r: summary.roll.min },
    { label: '均值', h: summary.h_dev.mean, v: summary.v_dev.mean, r: summary.roll.mean },
    { label: '标准差', h: summary.h_dev.std, v: summary.v_dev.std, r: summary.roll.std },
    { label: '超限数', h: `${summary.h_dev.exceed_count}/${summary.h_dev.exceed_total}`,
      v: `${summary.v_dev.exceed_count}/${summary.v_dev.exceed_total}`,
      r: `${summary.roll.exceed_count}/${summary.roll.exceed_total}` },
  ]

  const sevColor = (s: string) =>
    s === 'critical' ? 'bg-red-900/60 border-red-700' :
    s === 'warning' ? 'bg-yellow-900/40 border-yellow-700' :
    'bg-slate-800 border-slate-600'

  const sevIcon = (s: string) =>
    s === 'critical' ? '[!]' : s === 'warning' ? '[*]' : '[i]'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* stats table */}
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-2 text-sm font-medium text-white">偏差统计</div>
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-1 text-left text-white">指标</th>
              <th className="py-1 text-right text-white">水平(mm)</th>
              <th className="py-1 text-right text-white">竖直(mm)</th>
              <th className="py-1 text-right text-white">滚转(deg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-slate-800">
                <td className="py-1 text-white">{r.label}</td>
                <td className="py-1 text-right text-white">{typeof r.h === 'number' ? r.h.toFixed(1) : r.h}</td>
                <td className="py-1 text-right text-white">{typeof r.v === 'number' ? r.v.toFixed(1) : r.v}</td>
                <td className="py-1 text-right text-white">{typeof r.r === 'number' ? r.r.toFixed(2) : r.r}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-sm text-white">
          <span>水平趋势: </span>
          <span className={summary.h_trend.label.includes('发散') ? 'text-red-400' : summary.h_trend.label === '稳定' ? 'text-green-400' : 'text-yellow-400'}>
            {summary.h_trend.label}
          </span>
          <span className="ml-3">竖直趋势: </span>
          <span className={summary.v_trend.label.includes('发散') ? 'text-red-400' : summary.v_trend.label === '稳定' ? 'text-green-400' : 'text-yellow-400'}>
            {summary.v_trend.label}
          </span>
        </div>
        <div className="mt-1 text-sm text-white">
          施工质量: <span className={summary.quality.label.includes('异常') ? 'text-red-400' : summary.quality.label.includes('波动') ? 'text-yellow-400' : 'text-green-400'}>
            {summary.quality.label}
          </span>
          <span className="text-slate-200 ml-2">(偏度{summary.quality.skewness} 峰度{summary.quality.kurtosis})</span>
        </div>
      </div>

      {/* correction advice */}
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-2 text-sm font-medium text-white">纠偏建议</div>
        {correction ? (
          <div className="space-y-2">
            <div className="text-sm text-white">
              当前: 水平{correction.h_direction} ({correction.current_h_dev_mm}mm) |
              竖直{correction.v_direction} ({correction.current_v_dev_mm}mm) |
              滚转{correction.current_roll_deg}deg
            </div>
            {correction.advice.length === 0 && (
              <div className="text-sm text-green-400">偏差在正常范围内，无需纠偏</div>
            )}
            {correction.advice.map((a, i) => (
              <div key={i} className={`rounded border p-2 text-sm text-white ${sevColor(a.severity)}`}>
                <span className="font-medium">{sevIcon(a.severity)} </span>
                {a.text}
                {a.monitor_rings > 0 && <span className="text-slate-200 ml-1">({a.monitor_rings}环后复查)</span>}
              </div>
            ))}
            <div className="mt-1 text-sm">
              <span className="text-white">综合状态: </span>
              <span className={correction.overall_status === '正常' ? 'text-green-400' : correction.overall_status === '需关注' ? 'text-yellow-400' : 'text-red-400'}>
                {correction.overall_status}
              </span>
            </div>
          </div>
        ) : <div className="text-sm text-white">加载中...</div>}
      </div>

      {/* histogram */}
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-1 text-sm font-medium text-white">水平偏差分布</div>
        <div style={{ height: 220 }}>
          <EChartsWrapper option={histOption} />
        </div>
        <div className="text-xs text-slate-200 text-center">蓝色柱状=实际分布 | 橙色线=正态拟合</div>
      </div>
    </div>
  )
}
