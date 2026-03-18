import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MonitoringPoint } from '../../types/three'

interface MarkerProps {
  point: MonitoringPoint
  isHovered: boolean
  onHover: (p: MonitoringPoint | null) => void
  onClick: (p: MonitoringPoint) => void
}

function Marker({ point, isHovered, onHover, onClick }: MarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color =
    point.status === 'danger' ? '#ef4444'
    : point.status === 'warning' ? '#facc15'
    : '#22d3ee'

  return (
    <mesh
      ref={meshRef}
      position={[point.x, point.y, point.z]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(point) }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => { e.stopPropagation(); onClick(point) }}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial
        color={isHovered ? '#ffffff' : color}
        emissive={color}
        emissiveIntensity={isHovered ? 1.0 : 0.4}
      />
    </mesh>
  )
}

interface Props {
  points: MonitoringPoint[]
  dataType: 'settlement' | 'temperature'
  hoveredPoint: MonitoringPoint | null
  onHover: (p: MonitoringPoint | null) => void
  onClick: (p: MonitoringPoint) => void
}

export default function MonitoringMarkers({ points, hoveredPoint, onHover, onClick }: Props) {
  if (!points.length) return null
  return (
    <group>
      {points.map(point => (
        <Marker
          key={point.id}
          point={point}
          isHovered={hoveredPoint?.id === point.id}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </group>
  )
}
