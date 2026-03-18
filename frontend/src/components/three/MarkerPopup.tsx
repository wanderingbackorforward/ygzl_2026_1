import { Html } from '@react-three/drei'
import type { MonitoringPoint } from '../../types/three'

interface Props {
  point: MonitoringPoint
  dataType: 'settlement' | 'temperature'
}

const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  warning: '预警',
  danger: '超限',
}
const STATUS_COLORS: Record<string, string> = {
  normal: 'text-cyan-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400',
}

export default function MarkerPopup({ point, dataType }: Props) {
  const unit = dataType === 'settlement' ? 'mm' : '°C'
  const label = dataType === 'settlement' ? '沉降值' : '温度'
  const statusLabel = STATUS_LABELS[point.status] ?? point.status
  const statusColor = STATUS_COLORS[point.status] ?? 'text-white'

  return (
    <Html
      position={[point.x, point.y + 0.15, point.z]}
      center
      style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
      zIndexRange={[9999, 9999]}
    >
      <div className="bg-slate-800 border border-cyan-500/40 rounded-lg px-3 py-2 text-sm shadow-xl">
        <div className="text-cyan-400 font-semibold text-base mb-1">{point.name || point.id}</div>
        <div className="text-white">
          {label}：{point.value != null ? `${point.value.toFixed(2)} ${unit}` : '—'}
        </div>
        <div className={`text-xs mt-1 ${statusColor}`}>状态：{statusLabel}</div>
      </div>
    </Html>
  )
}
