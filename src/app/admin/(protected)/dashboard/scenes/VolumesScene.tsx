'use client'

// Registers anime.js's Three.js adapter, so animate() can tween Object3D
// properties (scaleY…) directly: the volumes grow with the same engine that
// counts the dashboard's numbers up.
import 'animejs/adapters/three'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, RoundedBox, Sparkles, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { animate, stagger } from 'animejs'
import SceneCanvas, { useScene } from '@/components/admin/three/SceneCanvas'
import { formatCount } from '@/lib/format-count'
import type { RecordKind } from '../analytics'
import type { VolumeModel } from '../volumes'

const MAX_HEIGHT = 3
const SIZE = 1.12
const GAP = 1.75
const FOV = 26
const LABEL_SPACE = 0.9
const BASE_ROTATION = -0.1
const VIEW = new THREE.Vector3(7.2, 5.6, 8).normalize()
const { damp, lerp } = THREE.MathUtils

// Day (light theme) and night (dark theme); the scene cross-fades on a theme switch.
const PLATE = [new THREE.Color('#f4f3ef'), new THREE.Color('#18181b')] as const
const SKY = [new THREE.Color('#ffffff'), new THREE.Color('#4d64a3')] as const
const GROUND = [new THREE.Color('#d8d2c6'), new THREE.Color('#050505')] as const
const SUN = [new THREE.Color('#fff3e0'), new THREE.Color('#8ea4ff')] as const
const WHITE = new THREE.Color('#ffffff')

/** Mutable values shared by the frame loops (no React re-renders). */
interface Shared {
  /** 0 = day, 1 = night, eased towards the current theme. */
  night: { current: number }
  /** Intro progress of the cores filling up, tweened by anime.js. */
  fill: { p: number }
  time: { current: number }
}

export interface VolumesProps {
  volumes: VolumeModel[]
  dark: boolean
  active: RecordKind | null
  onHover: (kind: RecordKind | null) => void
  onSelect: (href: string) => void
  /** Progress (0…1) of the card through the viewport (GSAP ScrollTrigger). */
  scroll: { current: number }
}

interface VolumeProps {
  model: VolumeModel
  index: number
  active: boolean
  shared: Shared
  onHover: (kind: RecordKind | null) => void
  onSelect: (href: string) => void
  growthRef: (group: THREE.Group | null) => void
}

function Volume({ model, index, active, shared, onHover, onSelect, growthRef }: VolumeProps) {
  const { reduced } = useScene()
  const lift = useRef<THREE.Group>(null)
  const core = useRef<THREE.Group>(null)
  const glass = useRef<THREE.MeshPhysicalMaterial>(null)
  const coreMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const pad = useRef<THREE.MeshBasicMaterial>(null)
  const hover = useRef(0)
  const height = model.height * MAX_HEIGHT
  const coreHeight = height * model.share
  const accent = useMemo(() => new THREE.Color(model.color), [model.color])
  const outline = useMemo(() => {
    const plane = new THREE.PlaneGeometry(SIZE, SIZE)
    const edges = new THREE.EdgesGeometry(plane)
    plane.dispose()
    return edges
  }, [])
  useEffect(() => () => outline.dispose(), [outline])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const night = shared.night.current
    hover.current = reduced ? (active ? 1 : 0) : damp(hover.current, active ? 1 : 0, 10, dt)
    if (lift.current) lift.current.position.y = hover.current * 0.14
    if (core.current) core.current.scale.y = Math.max(0.001, Math.min(1, shared.fill.p))
    if (glass.current) {
      glass.current.color.copy(accent).lerp(WHITE, lerp(0.5, 0.15, night))
      glass.current.opacity = lerp(0.34, 0.22, night) + hover.current * 0.12
    }
    if (coreMaterial.current) coreMaterial.current.emissiveIntensity = lerp(0.04, 0.85, night) + hover.current * 0.3
    if (pad.current) pad.current.opacity = lerp(0.16, 0.32, night) + hover.current * 0.2
  })

  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHover(model.kind)
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHover(null)
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onSelect(model.href)
    },
  }

  return (
    <group position={[(index - 1.5) * GAP, 0, 0]}>
      {/* Coloured footprint on the plate. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]}>
        <planeGeometry args={[SIZE + 0.22, SIZE + 0.22]} />
        <meshBasicMaterial ref={pad} color={model.color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={growthRef}>
        <group ref={lift}>
          {height > 0 ? (
            <>
              {model.share > 0 && (
                // The solid core: published, unread or open records. It fills up from the plate.
                <group ref={core}>
                  <RoundedBox args={[SIZE * 0.84, coreHeight, SIZE * 0.84]} radius={0.08} smoothness={4} position={[0, coreHeight / 2 + 0.002, 0]} castShadow>
                    <meshStandardMaterial ref={coreMaterial} color={model.color} emissive={model.color} roughness={0.35} metalness={0.08} />
                  </RoundedBox>
                </group>
              )}
              {/* The frosted glass volume: every record of the type. */}
              <RoundedBox args={[SIZE, height, SIZE]} radius={0.1} smoothness={4} position={[0, height / 2, 0]} {...handlers}>
                <meshPhysicalMaterial ref={glass} transparent roughness={0.18} metalness={0} clearcoat={1} clearcoatRoughness={0.12} depthWrite={false} />
              </RoundedBox>
            </>
          ) : (
            // Nothing yet: an outlined plot, still hoverable.
            <>
              <lineSegments geometry={outline} rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
                <lineBasicMaterial color={model.color} transparent opacity={0.7} />
              </lineSegments>
              <mesh position={[0, 0.35, 0]} {...handlers}>
                <boxGeometry args={[SIZE, 0.7, SIZE]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
              </mesh>
            </>
          )}
          <Html position={[0, height + 0.42, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="d3-vol-label" data-active={active ? '' : undefined} style={{ '--tower': model.color } as CSSProperties}>
              <strong>{formatCount(model.total)}</strong>
              {active && (
                <span>
                  {model.litLabel} · {model.restLabel}
                </span>
              )}
            </div>
          </Html>
        </group>
      </group>
    </group>
  )
}

function Lights({ shared }: { shared: Shared }) {
  const ambient = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const night = shared.night.current
    if (ambient.current) ambient.current.intensity = lerp(0.6, 0.22, night)
    if (hemi.current) {
      hemi.current.intensity = lerp(1.45, 0.8, night)
      hemi.current.color.copy(SKY[0]).lerp(SKY[1], night)
      hemi.current.groundColor.copy(GROUND[0]).lerp(GROUND[1], night)
    }
    if (sun.current) {
      sun.current.intensity = lerp(2.4, 0.9, night)
      sun.current.color.copy(SUN[0]).lerp(SUN[1], night)
    }
  })
  return (
    <>
      <ambientLight ref={ambient} />
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        position={[4.5, 9, 5]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
    </>
  )
}

/**
 * Frames the whole set at any aspect ratio: the camera backs off just enough
 * for every corner of the plate and the tallest volume (with its label) to fit,
 * whichever way the rig is turned.
 */
function CameraRig({ top }: { top: number }) {
  const camera = useThree(state => state.camera)
  const width = useThree(state => state.size.width)
  const height = useThree(state => state.size.height)
  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height)
    const up = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(up, VIEW).normalize()
    const cameraUp = new THREE.Vector3().crossVectors(VIEW, right).normalize()
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const tanH = tanV * aspect
    const center = new THREE.Vector3(0, top / 2 - 0.15, 0)
    const corner = new THREE.Vector3()
    let distance = 0
    for (const angle of [-0.35, 0, 0.35])
      for (const x of [-3.75, 3.75])
        for (const y of [-0.3, top])
          for (const z of [-1.3, 1.3]) {
            corner.set(x, y, z).applyAxisAngle(up, angle).sub(center)
            const depth = corner.dot(VIEW)
            distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / tanH, depth + Math.abs(corner.dot(cameraUp)) / tanV)
          }
    camera.position.copy(center).addScaledVector(VIEW, distance * 1.02)
    camera.lookAt(center)
    camera.updateProjectionMatrix()
  }, [camera, width, height, top])
  return null
}

function Volumes({ volumes, dark, active, onHover, onSelect, scroll }: VolumesProps) {
  const { visible, reduced, pointer } = useScene()
  const invalidate = useThree(state => state.invalidate)
  const rig = useRef<THREE.Group>(null)
  const bob = useRef<THREE.Group>(null)
  const growth = useRef<(THREE.Group | null)[]>([])
  const plate = useRef<THREE.MeshStandardMaterial>(null)
  const [shared] = useState<Shared>(() => ({ night: { current: dark ? 1 : 0 }, fill: { p: 0 }, time: { current: 0 } }))
  const [started, setStarted] = useState(false)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  const top = Math.max(...volumes.map(v => v.height), 0.1) * MAX_HEIGHT + LABEL_SPACE

  // Volumes start flat and rise the first time the scene is on screen.
  useLayoutEffect(() => {
    if (!reduced) growth.current.forEach(group => group?.scale.set(1, 0.001, 1))
    // Only the initial state: the intro below takes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (visible) setStarted(true)
  }, [visible])
  useEffect(() => {
    if (!started) return
    const groups = growth.current.filter((group): group is THREE.Group => group !== null)
    if (reduced) {
      groups.forEach(group => group.scale.set(1, 1, 1))
      shared.fill.p = 1
      invalidate()
      return
    }
    groups.forEach(group => group.scale.set(1, 0.001, 1))
    shared.fill.p = 0
    const grow = animate(groups, { scaleY: [0.001, 1], duration: 1700, delay: stagger(150, { start: 150 }), ease: 'outElastic(1, .8)' })
    const fill = animate(shared.fill, { p: [0, 1], duration: 1400, delay: 1000, ease: 'inOutCubic' })
    return () => {
      grow.revert()
      fill.revert()
    }
  }, [started, reduced, shared, invalidate])

  // Still frames (reduced motion / off screen) still follow theme and hover.
  useEffect(() => {
    invalidate()
  }, [dark, active, invalidate])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    shared.time.current += dt
    shared.night.current = reduced ? (dark ? 1 : 0) : damp(shared.night.current, dark ? 1 : 0, 3, dt)
    if (plate.current) plate.current.color.copy(PLATE[0]).lerp(PLATE[1], shared.night.current)
    const p = pointer.current
    if (rig.current) {
      const turn = reduced ? BASE_ROTATION : BASE_ROTATION + Math.sin(shared.time.current * 0.16) * 0.09 + p.x * 0.24 + (scroll.current - 0.5) * 0.4
      const tilt = reduced ? 0 : -p.y * 0.05
      rig.current.rotation.y = reduced ? turn : damp(rig.current.rotation.y, turn, 2.6, dt)
      rig.current.rotation.x = reduced ? tilt : damp(rig.current.rotation.x, tilt, 2.6, dt)
    }
    if (bob.current) bob.current.position.y = reduced ? 0 : Math.sin(shared.time.current * 0.7) * 0.05
  })

  const hover = (kind: RecordKind | null) => {
    setHovered(kind !== null)
    onHover(kind)
  }

  return (
    <>
      <CameraRig top={top} />
      <Lights shared={shared} />
      <group ref={rig} rotation-y={BASE_ROTATION}>
        <group ref={bob}>
          <RoundedBox args={[7.5, 0.28, 2.6]} radius={0.14} smoothness={4} position={[0, -0.14, 0]} receiveShadow>
            <meshStandardMaterial ref={plate} roughness={0.92} />
          </RoundedBox>
          {volumes.map((volume, i) => (
            <Volume
              key={volume.kind}
              model={volume}
              index={i}
              active={active === volume.kind}
              shared={shared}
              onHover={hover}
              onSelect={onSelect}
              growthRef={group => {
                growth.current[i] = group
              }}
            />
          ))}
        </group>
      </group>
      {dark && <Sparkles count={36} scale={[9, 3.6, 4]} position={[0, 2, 0]} size={2.4} speed={reduced ? 0 : 0.3} opacity={0.7} color="#2a6aff" noise={0.6} />}
    </>
  )
}

export default function VolumesScene({ className, ...props }: VolumesProps & { className?: string }) {
  return (
    <SceneCanvas className={className} shadows="percentage" camera={{ fov: FOV, near: 0.5, far: 80, position: [7.2, 5.6, 8] }} fallback={<div className="d3-scene-fallback" />}>
      <Volumes {...props} />
    </SceneCanvas>
  )
}
