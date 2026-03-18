import { useState, useRef } from 'react'
import { useProgress } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { MODEL_DEFS } from '../types/three'
import type { ModelDef, MonitoringPoint, ViewpointData } from '../types/three'
import ThreeScene from '../components/three/ThreeScene'
import ModelSelector from '../components/three/ModelSelector'
import AnimationPanel from '../components/three/AnimationPanel'
import { useMonitoringPoints } from '../hooks/useMonitoringPoints'

function LoadingOverlay() {
  const { progress, active } = useProgress()
  if (!active) return null
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-6 text-center min-w-[200px]">
        <div className="text-white text-base mb-3">加载模型中...</div>
        <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-slate-200 text-sm mt-2">{progress.toFixed(0)}%</div>
      </div>
    </div>
  )
}

export default function ThreeModel() {
  const [currentModel, setCurrentModel] = useState<ModelDef>(MODEL_DEFS[0])
  const [dataType, setDataType] = useState<'settlement' | 'temperature'>('settlement')
  const [hoveredPoint, setHoveredPoint] = useState<MonitoringPoint | null>(null)
  const [cameraTarget, setCameraTarget] = useState<ViewpointData | null>(null)
  const [animActions, setAnimActions] = useState<Record<string, THREE.AnimationAction> | null>(null)
  const [animMixer, setAnimMixer] = useState<THREE.AnimationMixer | null>(null)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { points } = useMonitoringPoints(dataType)

  const handlePointClick = (point: MonitoringPoint) => {
    setCameraTarget({
      position: [point.x + 2, point.y + 1, point.z + 2],
      target: [point.x, point.y, point.z],
    })
  }

  return (
    <div className="relative w-full bg-slate-900" style={{ height: 'calc(100vh - 64px)' }}>
      <ThreeScene
        model={currentModel}
        points={points}
        dataType={dataType}
        hoveredPoint={hoveredPoint}
        cameraTarget={cameraTarget}
        onHover={setHoveredPoint}
        onPointClick={handlePointClick}
        onAnimationsFound={(actions, mixer) => {
          setAnimActions(actions)
          setAnimMixer(mixer)
        }}
        controlsRef={controlsRef}
      />
      <LoadingOverlay />
      <ModelSelector current={currentModel} onChange={(m) => {
        setAnimActions(null)
        setAnimMixer(null)
        setCurrentModel(m)
      }} />
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            dataType === 'settlement' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
          onClick={() => setDataType('settlement')}
        >
          沉降
        </button>
        <button
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            dataType === 'temperature' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
          onClick={() => setDataType('temperature')}
        >
          温度
        </button>
      </div>
      <AnimationPanel actions={animActions} mixer={animMixer} />
    </div>
  )
}
