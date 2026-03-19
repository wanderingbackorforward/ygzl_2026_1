import { useMemo, useState, useCallback } from 'react'
import { EChartsWrapper } from '../charts/EChartsWrapper'
import { apiPost } from '../../lib/api'
import type { RiskBinsResponse } from './types'
import type { EChartsOption } from 'echarts'

interface Props {
  riskData: RiskBinsResponse | null
  projectId: string
  alignmentId: string
  machineId: string
  onRefresh: () => void
}

export default function RiskPanel({ riskData, projectId, alignmentId, machineId, onRefresh }: Props) {
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketResult, setTicketResult] = useState<{ created: number; skipped: number } | null>(null)
  const [thresholdScore, setThresholdScore] = useState(70)

  const bins = useMemo(() => riskData?.bins || [], [riskData])
  const topBins = useMemo(
    () => [...bins].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10),
    [bins],
  )

  const chartOption: EChartsOption = useMemo(() => {
    const xs = bins.map((b) => `${Math.round(b.chainage_start)}~${Math.round(b.chainage_end)}`)
    const ys = bins.map((b) => b.risk_score)
    const colors = bins.map((b) =>
      b.risk_score >= 85 ? '#ef4444' : b.risk_score >= 70 ? '#f97316' :
      b.risk_score >= 50 ? '#eab308' : '#22c55e',
    )
    return {
      backgroundColor: 'transparent',
      grid: { left: 50, right: 20, top: 30, bottom: 60 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          const bin = bins[p.dataIndex]
          if (!bin) return ''
          return `<b>${xs[p.dataIndex]}m</b><br/>风险分: ${bin.risk_score}<br/>等级: ${bin.risk_priority}<br/>原因: ${(bin.reasons || []).join('、') || '无'}`
        },
      },
      xAxis: {
        type: 'category', data: xs, name: '里程段(m)', nameGap: 30,
        axisLabel: { color: '#cbd5e1', rotate: 45, fontSize: 10 },
        nameTextStyle: { color: '#cbd5e1' },
      },
      yAxis: {
        type: 'value', min: 0, max: 100, name: '风险分',
        axisLabel: { color: '#cbd5e1' }, nameTextStyle: { color: '#cbd5e1' },
        splitLine: { lineStyle: { color: '#334155' } },
      },
      series: [{
        type: 'bar',
        data: ys.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
        barMaxWidth: 30,
      }],
      dataZoom: [{ type: 'slider', height: 18, bottom: 5, textStyle: { color: '#cbd5e1' } }],
    }
  }, [bins])

  const runAutoTickets = useCallback(async () => {
    if (!projectId) return
    setTicketLoading(true)
    setTicketResult(null)
    try {
      const res = await apiPost<{ created: any[]; skipped: any[] }>('/tunnel/risk/auto-tickets', {
        project_id: projectId,
        alignment_id: alignmentId || undefined,
        machine_id: machineId || undefined,
        bin_m: 20,
        threshold_score: thresholdScore,
        creator_id: 'system',
        creator_name: '系统',
      })
      setTicketResult({ created: res?.created?.length || 0, skipped: res?.skipped?.length || 0 })
      onRefresh()
    } catch {
      setTicketResult({ created: 0, skipped: 0 })
    } finally {
      setTicketLoading(false)
    }
  }, [projectId, alignmentId, machineId, thresholdScore, onRefresh])

  const priorityColor = (p: string) =>
    p === 'CRITICAL' ? 'text-red-400' : p === 'HIGH' ? 'text-orange-400' :
    p === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className="space-y-4">
      {/* risk chart */}
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-1 text-sm font-medium text-white">里程风险纵断面</div>
        <div style={{ height: 300 }}>
          <EChartsWrapper option={chartOption} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* top risk table */}
        <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
          <div className="mb-2 text-sm font-medium text-white">高风险区段 (Top 10)</div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm text-white">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="py-1 text-left text-white">里程段</th>
                  <th className="py-1 text-right text-white">风险分</th>
                  <th className="py-1 text-center text-white">等级</th>
                  <th className="py-1 text-left text-white">原因</th>
                </tr>
              </thead>
              <tbody>
                {topBins.map((b) => (
                  <tr key={`${b.chainage_start}-${b.chainage_end}`} className="border-b border-slate-800">
                    <td className="py-1 text-white">{Math.round(b.chainage_start)}~{Math.round(b.chainage_end)}m</td>
                    <td className="py-1 text-right text-white">{b.risk_score}</td>
                    <td className={`py-1 text-center font-medium ${priorityColor(b.risk_priority)}`}>{b.risk_priority}</td>
                    <td className="py-1 text-white text-xs">{(b.reasons || []).join('、') || '-'}</td>
                  </tr>
                ))}
                {!topBins.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-white">暂无风险数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* auto ticket */}
        <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
          <div className="mb-2 text-sm font-medium text-white">自动工单</div>
          <div className="flex items-end gap-3 mb-3">
            <div>
              <div className="text-xs text-slate-200 mb-1">工单阈值</div>
              <input
                type="number" min={0} max={100} value={thresholdScore}
                onChange={(e) => setThresholdScore(Number(e.target.value))}
                className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
              />
            </div>
            <button
              onClick={runAutoTickets}
              disabled={ticketLoading || !projectId}
              className="rounded bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {ticketLoading ? '生成中...' : '生成工单'}
            </button>
          </div>
          {ticketResult && (
            <div className="text-sm text-white">
              创建: <span className="text-cyan-400">{ticketResult.created}</span> |
              跳过(已存在): <span className="text-slate-200">{ticketResult.skipped}</span>
            </div>
          )}
          <div className="mt-2 text-xs text-slate-200">
            风险分 &ge; {thresholdScore} 的里程段将自动创建工单，已有工单的不会重复创建
          </div>
        </div>
      </div>
    </div>
  )
}
