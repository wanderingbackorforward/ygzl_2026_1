import { useEffect } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { STATIC_BASE } from '../../lib/api'
import type { ModelDef } from '../../types/three'

interface Props {
  modelDef: ModelDef
  onAnimationsFound?: (actions: Record<string, THREE.AnimationAction>, mixer: THREE.AnimationMixer) => void
}

function SingleModel({ path, scale, center }: { path: string; scale: number; center: THREE.Vector3 }) {
  const gltf = useGLTF(`${STATIC_BASE}/static/${path}`)
  return <primitive object={gltf.scene} scale={scale} position={center.clone().multiplyScalar(-scale)} />
}

function CombinedModels({ paths }: { paths: string[] }) {
  const gltfs = paths.map(p => useGLTF(`${STATIC_BASE}/static/${p}`))
  return (
    <group>
      {gltfs.map((gltf, i) => (
        <primitive key={paths[i]} object={gltf.scene} />
      ))}
    </group>
  )
}

function SingleModelWithScale({ modelDef, onAnimationsFound }: Props) {
  const url = `${STATIC_BASE}/static/${modelDef.paths[0]}`
  const gltf = useGLTF(url)
  const { actions, mixer } = useAnimations(gltf.animations, gltf.scene)
  const { camera } = useThree()

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = maxDim > 0 ? 5 / maxDim : 1
    gltf.scene.scale.setScalar(scale)
    gltf.scene.position.copy(center.clone().multiplyScalar(-scale))

    // Auto-fit camera
    const newBox = new THREE.Box3().setFromObject(gltf.scene)
    const newCenter = newBox.getCenter(new THREE.Vector3())
    const newSize = newBox.getSize(new THREE.Vector3())
    const dist = Math.max(newSize.x, newSize.y, newSize.z) * 2
    camera.position.set(newCenter.x + dist * 0.5, newCenter.y + dist * 0.5, newCenter.z + dist)
    camera.lookAt(newCenter)
  }, [gltf.scene])

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0 && onAnimationsFound) {
      onAnimationsFound(actions as Record<string, THREE.AnimationAction>, mixer)
      const first = Object.values(actions)[0]
      first?.play()
    }
  }, [actions])

  useEffect(() => {
    return () => { useGLTF.clear(url) }
  }, [url])

  return <primitive object={gltf.scene} />
}

function CombinedModelGroup({ modelDef }: Props) {
  const urls = modelDef.paths.map(p => `${STATIC_BASE}/static/${p}`)
  const gltfs = urls.map(url => useGLTF(url))
  const { camera } = useThree()

  useEffect(() => {
    const group = new THREE.Group()
    gltfs.forEach(g => group.add(g.scene.clone()))
    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const dist = Math.max(size.x, size.y, size.z) * 1.5
    camera.position.set(center.x, center.y + dist * 0.5, center.z + dist)
    camera.lookAt(center)
  }, [gltfs.length])

  useEffect(() => {
    return () => { urls.forEach(url => useGLTF.clear(url)) }
  }, [modelDef.id])

  return (
    <group>
      {gltfs.map((gltf, i) => (
        <primitive key={modelDef.paths[i]} object={gltf.scene} />
      ))}
    </group>
  )
}

export default function TunnelModel({ modelDef, onAnimationsFound }: Props) {
  if (modelDef.isCombined) {
    return <CombinedModelGroup modelDef={modelDef} />
  }
  return <SingleModelWithScale modelDef={modelDef} onAnimationsFound={onAnimationsFound} />
}
