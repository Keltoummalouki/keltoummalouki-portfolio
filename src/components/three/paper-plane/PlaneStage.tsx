'use client'

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { LetterSceneState } from '@/features/inbox/contact-form'
import { cn } from '@/lib/utils'
import { wantsWebGL } from '../webgl-support'
import PlaneArt from './PlaneArt'
import type { PlaneScene } from './scene'
import styles from './plane-stage.module.css'

export interface PlaneStageHandle {
  /** A keystroke in the form: the letter nods. */
  nudge: () => void
}

type Mode = 'static' | 'loading' | 'live'

/** Starts Three.js a little before the stage arrives: it is the last section of the page. */
const LOAD_MARGIN = '600px 0px'

/**
 * The contact form's letter, in 3D: it writes itself as the form is filled in and
 * folds into a paper plane when the message is sent. Decorative: everything it
 * shows is in the form, so the stage is hidden from assistive technology. It is
 * server-rendered as a drawing (the no-JS, data-saver and no-WebGL experience); on
 * capable devices a lazily loaded Three.js scene takes over. Under reduced motion
 * the scene shows each state as a still frame.
 */
export default function PlaneStage({
  state,
  ref,
  className,
}: {
  state: LetterSceneState
  ref?: Ref<PlaneStageHandle>
  className?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<PlaneScene | null>(null)
  const stateRef = useRef(state)
  const [mode, setMode] = useState<Mode>()

  useImperativeHandle(ref, () => ({ nudge: () => sceneRef.current?.nudge() }), [])

  useEffect(() => {
    stateRef.current = state
    sceneRef.current?.update(state)
  }, [state])

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
    let scene: PlaneScene | null = null

    const stop = () => {
      cancelled = true
      scene?.dispose()
      scene = null
      sceneRef.current = null
    }

    const start = async () => {
      const { createPlaneScene } = await import('./scene')
      if (cancelled) return
      scene = createPlaneScene({
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
      scene.update(stateRef.current)
    }

    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        near.disconnect()
        start().catch((error: unknown) => {
          if (cancelled) return
          console.warn('Contact 3D scene disabled:', error)
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
    <div ref={stageRef} data-mode={mode} data-phase={state.phase} aria-hidden="true" className={cn(styles.stage, className)}>
      <div className={styles.artBox}>
        <PlaneArt className={styles.art} />
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
