import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { ViewpointData } from '../../types/three'

interface Props {
  target: ViewpointData | null
  controlsRef: React.RefObject<OrbitControlsImpl>
}

interface AnimState {
  start: number
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
}

export default function CameraController({ target, controlsRef }: Props) {
  const { camera } = useThree()
  const animRef = useRef<AnimState | null>(null)

  useEffect(() => {
    if (!target) return
    animRef.current = {
      start: performance.now(),
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...target.position),
      fromTarget: controlsRef.current?.target.clone() ?? new THREE.Vector3(),
      toTarget: new THREE.Vector3(...target.target),
    }
  }, [target])

  useFrame(() => {
    const anim = animRef.current
    if (!anim) return
    const elapsed = (performance.now() - anim.start) / 750
    const t = Math.min(elapsed, 1)
    const eased = t * (2 - t) // easeOutQuad
    camera.position.lerpVectors(anim.fromPos, anim.toPos, eased)
    controlsRef.current?.target.lerpVectors(anim.fromTarget, anim.toTarget, eased)
    if (t >= 1) animRef.current = null
  })

  return null
}
