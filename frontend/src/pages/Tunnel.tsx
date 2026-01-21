import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { apiGet, apiPost } from '../lib/api'
import { EChartsWrapper } from '../components/charts/EChartsWrapper'

type TunnelProject = {
  project_id: string
  name: string
  description?: string | null
  created_at?: string | null
}

type RiskBin = {
  chainage_start: number
  chainage_end: number
  point_count: number
  max_abs_current_value?: number | null
  max_abs_change_rate?: number | null
  worst_alert_level?: string | null
  worst_point_id?: string | null
  risk_score: number
  risk_priority: string
  reasons: string[]
}

type RiskBinsResponse = {
  project_id: string
  alignment_id?: string | null
  machine_id?: string | null
  bin_m: number
  start_chainage?: number | null
  end_chainage?: number | null
  points: number
  bins: RiskBin[]
}

type AutoTicketResult = {
  created: Array<Record<string, unknown>>
  skipped: Array<Record<string, unknown>>
}

export default function Tunnel() {
  const [projects, setProjects] = useState<TunnelProject[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [machineId, setMachineId] = useState<string>('')
  const [binM, setBinM] = useState<number>(20)
  const [thresholdScore, setThresholdScore] = useState<number>(70)
  const [loading, setLoading] = useState(false)
  const [riskData, setRiskData] = useState<RiskBinsResponse | null>(null)
  const [error, setError] = useState<string>('')
  const [autoTicketResult, setAutoTicketResult] = useState<AutoTicketResult | null>(null)

  useEffect(() => {
    apiGet<TunnelProject[]>('/tunnel/projects')
      .then((rows) => {
        setProjects(rows || [])
        if (!projectId && rows && rows.length) setProjectId(rows[0].project_id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [projectId])

  const loadRisk = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    setAutoTicketResult(null)
    try {
      const data = await apiGet<RiskBinsResponse>(`/tunnel/risk/bins?project_id=${encodeURIComponent(projectId)}&bin_m=${encodeURIComponent(String(binM))}`)
      setRiskData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId, binM])

  useEffect(() => {
    if (!projectId) return
    loadRisk()
  }, [projectId, loadRisk])

  const topBins = useMemo(() => {
    const bins = riskData?.bins || []
    return [...bins].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 8)
  }, [riskData])

  const chartOption: EChartsOption = useMemo(() => {
    const bins = riskData?.bins || []
    const xs = bins.map((b) => Number(((b.chainage_start + b.chainage_end) / 2).toFixed(1)))
    const ys = bins.map((b) => b.risk_score || 0)
    return {
      backgroundColor: 'transparent',
      grid: { left: 45, right: 20, top: 25, bottom: 35 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: xs, name: '里程(m)', nameGap: 22 },
      yAxis: { type: 'value', min: 0, max: 100, name: '风险分' },
      series: [
        {
          type: 'line',
          data: ys,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
        },
      ],
    }
  }, [riskData])

  const runAutoTickets = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    setAutoTicketResult(null)
    try {
      const data = await apiPost<AutoTicketResult>('/tunnel/risk/auto-tickets', {
        project_id: projectId,
        machine_id: machineId || undefined,
        bin_m: binM,
        threshold_score: thresholdScore,
        creator_id: 'system',
        creator_name: '系统',
      })
      setAutoTicketResult(data)
      await loadRisk()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId, machineId, binM, thresholdScore, loadRisk])

  return (
    <div className="p-4 text-slate-200">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">项目</div>
          <select
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">选择项目</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.name} ({p.project_id.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">TBM 机号（可选）</div>
          <input
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            placeholder="TBM-01"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">分箱(m)</div>
          <input
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-24"
            type="number"
            value={binM}
            onChange={(e) => setBinM(Number(e.target.value))}
            min={1}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">工单阈值</div>
          <input
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-24"
            type="number"
            value={thresholdScore}
            onChange={(e) => setThresholdScore(Number(e.target.value))}
            min={0}
            max={100}
          />
        </div>

        <button
          className="bg-cyan-700 hover:bg-cyan-600 text-white rounded px-3 py-2 disabled:opacity-50"
          onClick={loadRisk}
          disabled={!projectId || loading}
        >
          刷新
        </button>

        <button
          className="bg-amber-700 hover:bg-amber-600 text-white rounded px-3 py-2 disabled:opacity-50"
          onClick={runAutoTickets}
          disabled={!projectId || loading}
        >
          生成工单
        </button>
      </div>

      {error && <div className="mb-3 text-red-300">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
          <div className="text-sm text-slate-300 mb-2">里程风险纵断面</div>
          <div style={{ height: 320 }}>
            <EChartsWrapper option={chartOption} loading={loading} />
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
          <div className="text-sm text-slate-300 mb-2">高风险区段（Top 8）</div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left py-1">里程段</th>
                  <th className="text-right py-1">风险</th>
                  <th className="text-right py-1">点位</th>
                  <th className="text-left py-1">原因</th>
                </tr>
              </thead>
              <tbody>
                {topBins.map((b) => (
                  <tr key={`${b.chainage_start}-${b.chainage_end}`} className="border-t border-slate-800">
                    <td className="py-1">{Math.round(b.chainage_start)}~{Math.round(b.chainage_end)}m</td>
                    <td className="py-1 text-right">{b.risk_score}</td>
                    <td className="py-1 text-right">{b.point_count}</td>
                    <td className="py-1">{(b.reasons || []).join('、')}</td>
                  </tr>
                ))}
                {!topBins.length && (
                  <tr>
                    <td className="py-2 text-slate-500" colSpan={4}>
                      暂无数据（需要先完成点位里程映射与沉降分析表）
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {autoTicketResult && (
        <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded p-3 text-sm">
          <div className="text-slate-300 mb-1">工单结果</div>
          <div className="text-slate-400">创建：{autoTicketResult.created?.length || 0}，跳过：{autoTicketResult.skipped?.length || 0}</div>
        </div>
      )}
    </div>
  )
}

