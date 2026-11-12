'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { wantsWebGL } from '../webgl-support'
import { VoxelGlyph } from './glyphs'
import type { VoxelIconKey } from './icons'
import type { VoxelScene } from './scene'
import styles from './voxel-stage.module.css'

type Mode = 'static' | 'loading' | 'live'

/** The stage sits beside the intro: start loading as soon as it is near. */
const LOAD_MARGIN = '200px 0px'

/**
 * The /about page's chapter companion: the icon of the chapter being read, built out
 * of voxels (scene.ts). Decorative: the chapter list beside it says the same thing in
 * words, so the stage is hidden from assistive technology. It is server-rendered as
 * the flat icon (the no-JS, data-saver and no-WebGL experience, which still follows
 * the chapters); on capable devices a lazily loaded Three.js scene takes over. Never
 * loads while hidden (the rail hides it below the `lg` breakpoint).
 */
export default function VoxelStage({ icon, className }: { icon: VoxelIconKey; className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VoxelScene | null>(null)
  const iconRef = useRef(icon)
  const [mode, setMode] = useState<Mode>()

  useEffect(() => {
    iconRef.current = icon
    sceneRef.current?.show(icon)
  }, [icon])

  useEffect(() => {
    if (!wantsWebGL()) {
      setMode('static')
      return
    }
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const rtl = document.documentElement.dir === 'rtl'
    let cancelled = false
    let scene: VoxelScene | null = null

    const stop = () => {
      cancelled = true
      scene?.dispose()
      scene = null
      sceneRef.current = null
    }

    const start = async () => {
      const { createVoxelScene } = await import('./scene')
      if (cancelled) return
      scene = createVoxelScene({
        canvas,
        still: motion.matches,
        rtl,
        onReady: () => setMode('live'),
        onContextLost: () => {
          stop()
          setMode('static')
        },
      })
      sceneRef.current = scene
      scene.show(iconRef.current)
    }

    // A hidden stage (display: none) never intersects, so Three.js is never fetched for it.
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        near.disconnect()
        start().catch((error: unknown) => {
          if (cancelled) return
          console.warn('About 3D scene disabled:', error)
          stop()
          setMode('static')
        })
      },
      { rootMargin: LOAD_MARGIN },
    )
    near.observe(stage)
    setMode('loading')

    const onMotionChange = () => scene?.setStill(motion.matches)
    motion.addEventListener('change', onMotionChange)
    return () => {
      near.disconnect()
      motion.removeEventListener('change', onMotionChange)
      stop()
    }
  }, [])

  return (
    <div
      ref={stageRef}
      data-voxel-stage
      data-mode={mode}
      data-icon={icon}
      aria-hidden="true"
      className={cn(styles.stage, className)}
    >
      <div className={styles.fallback}>
        <VoxelGlyph key={icon} name={icon} strokeWidth={1.5} className={styles.glyph} />
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
