'use client'

import { Component, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas, type CanvasProps } from '@react-three/fiber'
import { useReducedMotion } from '@/lib/motion/reduced-motion'

/** Pointer over the scene's box, -1…1 on both axes (y up). */
export interface ScenePointer { x: number; y: number; inside: boolean }

interface SceneState {
  /** On screen (or about to be): the scene renders every frame only then. */
  visible: boolean
  /** prefers-reduced-motion: render still frames, snap instead of animating. */
  reduced: boolean
  pointer: RefObject<ScenePointer>
}

const SceneContext = createContext<SceneState | null>(null)

export function useScene(): SceneState {
  const value = useContext(SceneContext)
  if (!value) throw new Error('useScene() must be called inside <SceneCanvas>')
  return value
}

/** WebGL can be missing or blocked: show the fallback instead of breaking the dashboard. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('Dashboard 3D scene disabled:', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

type SceneCanvasProps = Omit<CanvasProps, 'frameloop' | 'children'> & {
  className?: string
  fallback?: ReactNode
  children: ReactNode
}

/**
 * One decorative WebGL canvas (aria-hidden: every number it shows is also in
 * the HTML). It renders continuously only while on screen, on demand under
 * reduced motion, and without tone mapping so colours match the CSS palette.
 */
export default function SceneCanvas({ className, fallback = null, children, ...canvas }: SceneCanvasProps) {
  const ref = useRef<HTMLDivElement>(null)
  const pointer = useRef<ScenePointer>({ x: 0, y: 0, inside: false })
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '160px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scene = useMemo(() => ({ visible, reduced, pointer }), [visible, reduced])

  return (
    <div
      ref={ref}
      className={className}
      aria-hidden="true"
      onPointerMove={e => {
        const box = e.currentTarget.getBoundingClientRect()
        pointer.current = {
          x: ((e.clientX - box.left) / box.width) * 2 - 1,
          y: -(((e.clientY - box.top) / box.height) * 2 - 1),
          inside: true,
        }
      }}
      onPointerLeave={() => {
        pointer.current = { x: 0, y: 0, inside: false }
      }}
    >
      <SceneBoundary fallback={fallback}>
        <Canvas
          frameloop={visible && !reduced ? 'always' : 'demand'}
          dpr={[1, 1.75]}
          flat
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          {...canvas}
        >
          <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
        </Canvas>
      </SceneBoundary>
    </div>
  )
}
