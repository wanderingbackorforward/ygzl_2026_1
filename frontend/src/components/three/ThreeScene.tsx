import { useEffect, useRef, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { ModelDef, MonitoringPoint, ViewpointData } from '../../types/three'
import TunnelModel from './TunnelModel'
import MonitoringMarkers from './MonitoringMarkers'
import CameraController from './CameraController'

function SceneSetup() {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color(0x0a1628)
  }, [scene])
  return null
}

interface ThreeSceneProps {
  model: ModelDef
  points: MonitoringPoint[]
  dataType: 'settlement' | 'temperature'
  hoveredPoint: MonitoringPoint | null
  cameraTarget: ViewpointData | null
  onHover: (point: MonitoringPoint | null) => void
  onPointClick: (point: MonitoringPoint) => void
  onAnimationsFound?: (actions: Record<string, THREE.AnimationAction>, mixer: THREE.AnimationMixer) => void
  controlsRef: React.RefObject<OrbitControlsImpl>
}

export default function ThreeScene({
  model,
  points,
  dataType,
  hoveredPoint,
  cameraTarget,
  onHover,
  onPointClick,
  onAnimationsFound,
  controlsRef,
}: ThreeSceneProps) {
  return (
    <Canvas
      camera={{ fov: 60, near: 0.01, far: 2000000, position: [0, 2, 10] }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneSetup />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7.5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -7.5]} intensity={0.4} />
      <gridHelper args={[50000, 50, 0x00f2ff, 0x444444]} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.1}
        maxDistance={100000}
      />
      <Suspense fallback={null}>
        <TunnelModel key={model.id} modelDef={model} onAnimationsFound={onAnimationsFound} />
        <MonitoringMarkers
          points={points}
          dataType={dataType}
          hoveredPoint={hoveredPoint}
          onHover={onHover}
          onClick={onPointClick}
        />
      </Suspense>
      <CameraController target={cameraTarget} controlsRef={controlsRef} />
    </Canvas>
  )
}
