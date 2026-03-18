import { useState } from 'react'
import * as THREE from 'three'

interface Props {
  actions: Record<string, THREE.AnimationAction> | null
  mixer: THREE.AnimationMixer | null
}

export default function AnimationPanel({ actions, mixer }: Props) {
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1.0)

  if (!actions || !mixer || Object.keys(actions).length === 0) return null

  const togglePlay = () => {
    const next = !playing
    setPlaying(next)
    Object.values(actions).forEach(a => {
      if (next) a?.play()
      else a?.stop()
    })
  }

  const handleSpeed = (v: number) => {
    setSpeed(v)
    mixer.timeScale = v
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 bg-slate-800/90 border border-cyan-500/30 rounded-lg px-4 py-3 flex flex-col gap-2 min-w-[180px]">
      <div className="text-white text-sm font-medium">动画控制</div>
      <div className="flex items-center gap-2">
        <button
          className="bg-cyan-600 text-white text-xs px-3 py-1 rounded hover:bg-cyan-500"
          onClick={togglePlay}
        >
          {playing ? '暂停' : '播放'}
        </button>
        <span className="text-slate-200 text-xs">速度：{speed.toFixed(2)}x</span>
      </div>
      <input
        type="range" min={0.05} max={2.0} step={0.05} value={speed}
        className="w-full cursor-pointer accent-cyan-500"
        onChange={e => handleSpeed(parseFloat(e.target.value))}
      />
    </div>
  )
}
