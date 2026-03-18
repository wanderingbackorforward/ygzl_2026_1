import { MODEL_DEFS } from '../../types/three'
import type { ModelDef } from '../../types/three'

interface Props {
  current: ModelDef
  onChange: (model: ModelDef) => void
}

export default function ModelSelector({ current, onChange }: Props) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-800/90 border border-cyan-500/30 rounded-lg px-3 py-2">
      <label className="text-white text-sm whitespace-nowrap">选择模型：</label>
      <select
        className="bg-slate-700 text-white text-sm border border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
        value={current.id}
        onChange={(e) => {
          const found = MODEL_DEFS.find(m => m.id === e.target.value)
          if (found) onChange(found)
        }}
      >
        {MODEL_DEFS.map(m => (
          <option key={m.id} value={m.id}>
            {m.label}{m.sizeWarning ? ' ⚠️' : ''}
          </option>
        ))}
      </select>
      {current.sizeWarning && (
        <span className="text-yellow-400 text-xs whitespace-nowrap">大文件，加载较慢</span>
      )}
    </div>
  )
}
