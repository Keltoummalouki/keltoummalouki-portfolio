'use client'

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { cn } from '@/lib/utils'
import type { BriefSceneState } from '@/features/freelance/brief'
import { wantsWebGL } from '../webgl-support'
import StackArt from './StackArt'
import type { BriefScene, StagePoint } from './scene'
import styles from './brief-stage.module.css'

export interface BriefStageHandle {
  /** A keystroke in the form: one bright packet runs up through the stack. */
  pulse: () => void
}

export interface BriefStageCallout {
  label: string
  /** One line per answer. */
  lines: readonly string[]
  /** The answer is in (full ink instead of muted). */
  filled: boolean
}

type Mode = 'static' | 'loading' | 'live'

/** Callouts need the room of a wide column; narrower layouts show the model alone. */
const WIDE_QUERY = '(min-width: 1280px)'
/** Moves the model away from the callouts on wide layouts. */
const WIDE_FOCUS_OFFSET = 0.085
/** From the callout's top edge to its caption's middle, where the leader line starts. */
const LEADER_START_Y = 8

/**
 * The 3D model of the visitor's project. Decorative: every answer it shows is
 * in the form, so the whole stage is hidden from assistive technology. It is
 * server-rendered as a drawing (the no-JS, data-saver and no-WebGL experience);
 * on capable devices a lazily loaded Three.js scene takes over. Under reduced
 * motion the scene still reacts to answers, as still frames.
 */
export default function BriefStage({
  state,
  callouts,
  ref,
  className,
}: {
  state: BriefSceneState
  callouts: readonly BriefStageCallout[]
  ref?: Ref<BriefStageHandle>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BriefScene | null>(null)
  const stateRef = useRef(state)
  const calloutRefs = useRef<(HTMLDivElement | null)[]>([])
  const leaderRefs = useRef<(SVGLineElement | null)[]>([])
  const dotRefs = useRef<(SVGCircleElement | null)[]>([])
  const [mode, setMode] = useState<Mode>()

  useImperativeHandle(ref, () => ({ pulse: () => sceneRef.current?.pulse() }), [])

  useEffect(() => {
    stateRef.current = state
    sceneRef.current?.update(state)
  }, [state])

  useEffect(() => {
    if (!wantsWebGL()) {
      setMode('static')
      return
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const wide = window.matchMedia(WIDE_QUERY)
    const rtl = document.documentElement.dir === 'rtl'
    let cancelled = false
    let idle = 0
    let scene: BriefScene | null = null
    /** Callouts are placed once per layout; only their leader lines follow the model. */
    let slots: number[] | null = null

    const stop = () => {
      cancelled = true
      scene?.dispose()
      scene = null
      sceneRef.current = null
    }

    const onFrame = (corners: readonly StagePoint[]) => {
      if (!wide.matches) {
        slots = null
        return
      }
      if (!slots) {
        slots = corners.map((corner) => corner.y)
        slots.forEach((slot, index) => {
          const callout = calloutRefs.current[index]
          if (callout) callout.style.transform = `translateY(${slot - LEADER_START_Y}px)`
        })
      }
      corners.forEach((corner, index) => {
        const callout = calloutRefs.current[index]
        const leader = leaderRefs.current[index]
        const dot = dotRefs.current[index]
        if (!callout || !leader || !dot || !slots) return
        const fromX = rtl ? callout.offsetLeft : callout.offsetLeft + callout.offsetWidth
        leader.setAttribute('x1', String(fromX))
        leader.setAttribute('y1', String(slots[index]))
        leader.setAttribute('x2', corner.x.toFixed(1))
        leader.setAttribute('y2', corner.y.toFixed(1))
        dot.setAttribute('cx', corner.x.toFixed(1))
        dot.setAttribute('cy', corner.y.toFixed(1))
      })
    }

    const start = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { createBriefScene } = await import('./scene')
      if (cancelled) return
      scene = createBriefScene({
        canvas,
        still: motion.matches,
        rtl,
        focusOffset: () => (wide.matches ? WIDE_FOCUS_OFFSET : 0),
        onReady: () => setMode('live'),
        onFrame,
        onContextLost: () => {
          stop()
          setMode('static')
        },
      })
      sceneRef.current = scene
      scene.update(stateRef.current)
    }

    const onMotionChange = () => scene?.setStill(motion.matches)
    const onWideChange = () => {
      slots = null
    }
    motion.addEventListener('change', onMotionChange)
    wide.addEventListener('change', onWideChange)
    setMode('loading')

    // After the form is interactive: the 3D is never what a visitor waits for.
    const run = () => {
      start().catch((error: unknown) => {
        if (cancelled) return
        console.warn('Freelance 3D scene disabled:', error)
        stop()
        setMode('static')
      })
    }
    const hasIdle = typeof window.requestIdleCallback === 'function'
    if (hasIdle) idle = window.requestIdleCallback(run, { timeout: 1200 })
    else idle = window.setTimeout(run, 200)

    return () => {
      if (hasIdle) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
      motion.removeEventListener('change', onMotionChange)
      wide.removeEventListener('change', onWideChange)
      stop()
    }
  }, [])

  return (
    <div data-mode={mode} data-phase={state.phase} aria-hidden="true" className={cn(styles.stage, className)}>
      <div className={styles.artBox}>
        <StackArt className={styles.art} />
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.overlay}>
        <svg className={styles.leaders}>
          {callouts.map((callout, index) => (
            <g key={callout.label}>
              <line
                ref={(element) => {
                  leaderRefs.current[index] = element
                }}
              />
              <circle
                r="3"
                ref={(element) => {
                  dotRefs.current[index] = element
                }}
              />
            </g>
          ))}
        </svg>
        {callouts.map((callout, index) => (
          <div
            key={callout.label}
            data-filled={callout.filled ? '' : undefined}
            ref={(element) => {
              calloutRefs.current[index] = element
            }}
            className={styles.callout}
          >
            <span className={styles.calloutLabel}>{callout.label}</span>
            {callout.lines.map((line) => (
              <span key={line} className={styles.calloutValue}>
                {line}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
