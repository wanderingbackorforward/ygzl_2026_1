import { useMemo, useEffect } from 'react'
import type { DeviationRecord } from './types'
import { deviationToColor } from './types'

interface Props {
  record: DeviationRecord
  records: DeviationRecord[]
  onClose: () => void
  onNavigate: (ring: number) => void
}

export default function RingDetailDrawer({ record, records, onClose, onNavigate }: Props) {
  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const idx = useMemo(() => records.findIndex((r) => r.ring_no === record.ring_no), [records, record.ring_no])
  const prevRing = idx > 0 ? records[idx - 1].ring_no : null
  const nextRing = idx < records.length - 1 ? records[idx + 1].ring_no : null

  const maxDev = Math.max(Math.abs(record.h_dev_mm), Math.abs(record.v_dev_mm))
  const devColor = deviationToColor(maxDev)

  const params = [
    { label: '推力', value: record.thrust_kN, unit: 'kN' },
    { label: '扭矩', value: record.torque_kNm, unit: 'kNm' },
    { label: '面压', value: record.face_pressure_kPa, unit: 'kPa' },
    { label: '推进速率', value: record.advance_rate_mm_min, unit: 'mm/min' },
    { label: '刀盘转速', value: record.cutterhead_rpm, unit: 'rpm' },
  ]

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl">
        {/* header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div className="text-white font-semibold">
            环 {record.ring_no}
            <span className="ml-2 text-sm text-slate-200 font-normal">{record.chainage_m}m</span>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-400 text-lg font-bold px-2">X</button>
        </div>

        {/* content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* timestamp */}
          {record.ts && <div className="text-xs text-slate-200">时间: {record.ts}</div>}

          {/* attitude */}
          <div className="rounded border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-sm font-medium text-white mb-2">姿态角</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-slate-200">俯仰 (Pitch)</div>
                <div className="text-lg font-bold text-white">{record.pitch_deg.toFixed(3)}&deg;</div>
              </div>
              <div>
                <div className="text-xs text-slate-200">偏航 (Yaw)</div>
                <div className="text-lg font-bold text-white">{record.yaw_deg.toFixed(3)}&deg;</div>
              </div>
              <div>
                <div className="text-xs text-slate-200">滚转 (Roll)</div>
                <div className="text-lg font-bold text-white">{record.roll_deg.toFixed(3)}&deg;</div>
              </div>
            </div>
          </div>

          {/* deviation */}
          <div className="rounded border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-sm font-medium text-white mb-2">累积偏差</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xs text-slate-200">水平偏差</div>
                <div className="text-xl font-bold" style={{ color: deviationToColor(record.h_dev_mm) }}>
                  {record.h_dev_mm.toFixed(1)}<span className="text-sm font-normal">mm</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-200">竖直偏差</div>
                <div className="text-xl font-bold" style={{ color: deviationToColor(record.v_dev_mm) }}>
                  {record.v_dev_mm.toFixed(1)}<span className="text-sm font-normal">mm</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-center">
              <span className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: devColor + '33', border: `1px solid ${devColor}` }}>
                {maxDev <= 20 ? '正常' : maxDev <= 35 ? '关注' : maxDev <= 50 ? '警告' : '超限'}
              </span>
            </div>
          </div>

          {/* TBM params */}
          <div className="rounded border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-sm font-medium text-white mb-2">TBM运行参数</div>
            <div className="space-y-1">
              {params.map((p) => (
                <div key={p.label} className="flex justify-between text-sm">
                  <span className="text-white">{p.label}</span>
                  <span className="text-white font-medium">
                    {p.value != null ? `${typeof p.value === 'number' ? p.value.toFixed(1) : p.value} ${p.unit}` : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* footer nav */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-700 px-4 py-2">
          <button
            disabled={prevRing === null}
            onClick={() => prevRing !== null && onNavigate(prevRing)}
            className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm text-white disabled:opacity-30"
          >
            上一环
          </button>
          <span className="text-sm text-white">环 {record.ring_no} / {records.length}</span>
          <button
            disabled={nextRing === null}
            onClick={() => nextRing !== null && onNavigate(nextRing)}
            className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm text-white disabled:opacity-30"
          >
            下一环
          </button>
        </div>
      </div>
    </>
  )
}
