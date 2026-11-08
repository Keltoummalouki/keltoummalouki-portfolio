'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { animate, stagger } from 'animejs'
import { drawCardFace, type CardVariant } from './card-face'
import SceneCanvas, { useScene } from '@/components/admin/three/SceneCanvas'

export interface StackItem {
  id: string
  title: string
  status: string
  label: string
  date: string
  href: string
}

const W = 3.2
const H = 2
const RADIUS = 0.16
const DEPTH = 0.04
const BEVEL = 0.012
const FACE_Z = DEPTH / 2 + BEVEL + 0.001
const VARIANTS: readonly CardVariant[] = ['brand', 'ink', 'pearl']
const EDGE: Record<CardVariant, string> = { brand: '#1d4ed8', ink: '#111113', pearl: '#d6d3cb' }
const TILT = { x: -0.34, y: 0.3, z: 0.1 }
const { damp } = THREE.MathUtils

function roundedRect(w: number, h: number, r: number) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

/** A bevelled card body plus a separate face whose UVs span the texture exactly. */
function useCardGeometry() {
  const geometry = useMemo(() => {
    const shape = roundedRect(W, H, RADIUS)
    const body = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 10 })
    body.translate(0, 0, -DEPTH / 2)
    const face = new THREE.ShapeGeometry(shape, 10)
    const position = face.attributes.position
    const uv = face.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / W + 0.5, position.getY(i) / H + 0.5)
    uv.needsUpdate = true
    return { body, face }
  }, [])
  useEffect(() => () => {
    geometry.body.dispose()
    geometry.face.dispose()
  }, [geometry])
  return geometry
}

function useFaceTexture(item: StackItem, variant: CardVariant, index: number) {
  const invalidate = useThree(state => state.invalidate)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 640
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    let live = true
    // The admin's own font (next/font sets the family on <html>).
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-manrope').trim() || 'system-ui, sans-serif'
    const paint = () => {
      if (!live) return
      drawCardFace(texture.image as HTMLCanvasElement, { title: item.title, status: item.status, label: item.label, date: item.date, index, variant }, family)
      texture.needsUpdate = true
      invalidate()
    }
    paint()
    document.fonts?.load(`800 62px ${family}`).then(paint, () => undefined)
    return () => {
      live = false
    }
  }, [texture, item.title, item.status, item.label, item.date, index, variant, invalidate])
  return texture
}

interface CardProps {
  item: StackItem
  index: number
  slot: number
  count: number
  spread: boolean
  appear: { v: number }
  geometry: ReturnType<typeof useCardGeometry>
}

function Card({ item, index, slot, count, spread, appear, geometry }: CardProps) {
  const { reduced } = useScene()
  const group = useRef<THREE.Group>(null)
  const variant = VARIANTS[index % VARIANTS.length]
  const texture = useFaceTexture(item, variant, index)
  const previousSlot = useRef(slot)
  const sentBack = useRef<number | null>(null)

  // The front card being sent to the back arcs up and over the others.
  useEffect(() => {
    if (previousSlot.current === 0 && slot === count - 1 && count > 1) sentBack.current = performance.now()
    previousSlot.current = slot
  }, [slot, count])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const s = spread ? 1.4 : 1
    const hidden = 1 - appear.v
    let lift = 0
    if (sentBack.current !== null) {
      const t = (performance.now() - sentBack.current) / 820
      if (t >= 1 || reduced) sentBack.current = null
      else lift = Math.sin(Math.PI * t)
    }
    // Fanned up and to the right, centred on the rig so the deck stays framed.
    const fan = slot - (count - 1) / 2
    const x = fan * 0.86 * s + hidden * 1.4
    const y = fan * 0.46 * s + lift * 1.35 - hidden * 2.4
    const z = -slot * 0.55 * s + lift * 0.8
    const rx = -lift * 0.6 + hidden * 0.9
    const rz = slot * 0.06 * s - hidden * 0.35
    if (reduced) {
      g.position.set(x, y, z)
      g.rotation.set(rx, 0, rz)
      return
    }
    g.position.set(damp(g.position.x, x, 8, dt), damp(g.position.y, y, 8, dt), damp(g.position.z, z, 8, dt))
    g.rotation.x = damp(g.rotation.x, rx, 8, dt)
    g.rotation.z = damp(g.rotation.z, rz, 8, dt)
  })

  return (
    <group ref={group} position={[0, -2.4, 0]}>
      <mesh geometry={geometry.body} castShadow>
        <meshStandardMaterial color={EDGE[variant]} metalness={0.55} roughness={0.3} />
      </mesh>
      <mesh geometry={geometry.face} position-z={FACE_Z}>
        <meshPhysicalMaterial map={texture} roughness={0.3} metalness={0.05} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
    </group>
  )
}

function CameraFit() {
  const camera = useThree(state => state.camera)
  const width = useThree(state => state.size.width)
  const height = useThree(state => state.size.height)
  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height)
    camera.position.set(0, 0.1, 7 * THREE.MathUtils.clamp(Math.pow(1.7 / aspect, 0.9), 0.85, 1.9))
    camera.lookAt(0, 0.1, -0.5)
    camera.updateProjectionMatrix()
  }, [camera, width, height])
  return null
}

function Stack({ items, front, onCycle }: { items: StackItem[]; front: number; onCycle: () => void }) {
  const { visible, reduced, pointer } = useScene()
  const invalidate = useThree(state => state.invalidate)
  const rig = useRef<THREE.Group>(null)
  const time = useRef(0)
  const [hovered, setHovered] = useState(false)
  const [started, setStarted] = useState(false)
  const geometry = useCardGeometry()
  const appear = useMemo(() => items.map(() => ({ v: 0 })), [items])
  useCursor(hovered && items.length > 1)

  useEffect(() => {
    if (visible) setStarted(true)
  }, [visible])
  // Intro: the cards fly in one after the other (anime.js on plain values the frame loop reads).
  useEffect(() => {
    if (!started) return
    if (reduced) {
      appear.forEach(a => {
        a.v = 1
      })
      invalidate()
      return
    }
    const intro = animate(appear, { v: [0, 1], duration: 1400, delay: stagger(140, { start: 120 }), ease: 'outExpo' })
    return () => {
      intro.revert()
    }
  }, [started, reduced, appear, invalidate])
  useEffect(() => {
    invalidate()
  }, [front, hovered, invalidate])

  useFrame((_, delta) => {
    const g = rig.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    time.current += dt
    const p = pointer.current
    const ry = TILT.y + (reduced ? 0 : p.x * 0.22)
    const rx = TILT.x + (reduced ? 0 : -p.y * 0.14)
    g.rotation.y = reduced ? ry : damp(g.rotation.y, ry, 4, dt)
    g.rotation.x = reduced ? rx : damp(g.rotation.x, rx, 4, dt)
    g.position.y = reduced ? 0 : Math.sin(time.current * 0.9) * 0.06
  })

  const count = items.length
  return (
    <>
      <CameraFit />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} castShadow shadow-mapSize={[512, 512]} />
      {/* Reflections from local light panels: no HDR file to download. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 2]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-6, 1, 1]} scale={[4, 8, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 1, 1]} scale={[4, 8, 1]} />
        <Lightformer form="circle" intensity={2.2} color="#a78bfa" position={[2, 2, 6]} scale={2.5} />
        <Lightformer form="circle" intensity={1.8} color="#60a5fa" position={[-3, -1, 5]} scale={2} />
      </Environment>
      <group
        ref={rig}
        rotation={[TILT.x, TILT.y, TILT.z]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onCycle()
        }}
      >
        {items.map((item, i) => (
          <Card key={item.id} item={item} index={i} slot={(i - front + count) % count} count={count} spread={hovered} appear={appear[i]} geometry={geometry} />
        ))}
      </group>
      <ContactShadows position={[0, -1.75, 0]} scale={[10, 7]} opacity={0.42} blur={2.8} far={4} resolution={256} frames={reduced ? 1 : Infinity} />
    </>
  )
}

export default function CardStackScene({ className, items, front, onCycle }: { className?: string; items: StackItem[]; front: number; onCycle: () => void }) {
  return (
    <SceneCanvas className={className} shadows="percentage" camera={{ fov: 30, near: 0.5, far: 50, position: [0, 0.1, 7] }} fallback={<div className="d3-scene-fallback" />}>
      <Stack items={items} front={front} onCycle={onCycle} />
    </SceneCanvas>
  )
}
