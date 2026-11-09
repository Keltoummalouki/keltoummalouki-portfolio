'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCanvas, { useScene } from '@/components/admin/three/SceneCanvas'
import { ORB_FRAGMENT, ORB_VERTEX } from './orb-shader'

/**
 * `energy` (how much is waiting for the admin) makes the surface livelier;
 * `excited` (hover / focus on the button) stirs it up further.
 */
function Orb({ energy, excited }: { energy: number; excited: boolean }) {
  const { reduced } = useScene()
  const invalidate = useThree(state => state.invalidate)
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0.4 },
      uColor: { value: new THREE.Color('#2a6aff') },
    }),
    [],
  )
  useEffect(() => {
    invalidate()
  }, [energy, excited, invalidate])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const target = energy + (excited ? 0.6 : 0)
    if (reduced) {
      uniforms.uEnergy.value = target
      return
    }
    uniforms.uTime.value += dt * (1 + uniforms.uEnergy.value * 0.6)
    uniforms.uEnergy.value = THREE.MathUtils.damp(uniforms.uEnergy.value, target, 3, dt)
    if (mesh.current) mesh.current.rotation.y += dt * 0.25
  })

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 40]} />
      <shaderMaterial uniforms={uniforms} vertexShader={ORB_VERTEX} fragmentShader={ORB_FRAGMENT} />
    </mesh>
  )
}

export default function PulseOrb({ className, energy, excited }: { className?: string; energy: number; excited: boolean }) {
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0, 3.3], fov: 38 }} dpr={[1, 2]}>
      <Orb energy={energy} excited={excited} />
    </SceneCanvas>
  )
}
