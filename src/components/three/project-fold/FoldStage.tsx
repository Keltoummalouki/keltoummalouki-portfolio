'use client'

import { Suspense, use, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefCallback } from 'react'
import { getImageProps } from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight } from 'lucide-react'
import {
  FramableLivePreview,
  LIVE_VIEWPORT_HEIGHT,
  LIVE_VIEWPORT_WIDTH,
  LiveFrame,
  useLiveFrame,
} from '@/components/projects/LivePreview'
import ProjectWindow, { ProjectCover } from '@/components/projects/ProjectWindow'
import { projectHost, splitProjectTitle, type ProjectCardData } from '@/features/content/projects.map'
import { getPathname, useRouter } from '@/i18n/navigation'
import { trackClick, trackEvent } from '@/lib/analytics/events'
import { isOptimizableImageSrc } from '@/lib/images'
import { cn } from '@/lib/utils'
import { wantsWebGL } from '../webgl-support'
import { quadToMatrix3d, type Quad } from './layout'
import type { FoldPanelInput, FoldScene } from './scene'
import styles from './fold-stage.module.css'

type Mode = 'static' | 'loading' | 'live'

/** Same for the DOM covers and the 3D faces, so the browser downloads each picture once. */
const COVER_SIZES = '(max-width: 1023px) 92vw, 640px'
/** Starts Three.js well before the stage arrives: the unfolding is scroll-linked. */
const LOAD_MARGIN = '1000px 0px'
/** A resting panel waits this long before loading its demo, so flipping through costs nothing. */
const LIVE_SETTLE_MS = 350

function panelInput(project: ProjectCardData, index: number): FoldPanelInput {
  const number = String(index + 1).padStart(2, '0')
  const monogram = project.title.slice(0, 2).toUpperCase()
  const host = projectHost(project.demo)
  if (!project.image) return { number, host, monogram, cover: null }
  const { props } = getImageProps({
    src: project.image,
    alt: '',
    fill: true,
    sizes: COVER_SIZES,
    unoptimized: !isOptimizableImageSrc(project.image),
  })
  return { number, host, monogram, cover: { src: props.src, srcSet: props.srcSet, sizes: props.sizes } }
}

/**
 * The featured projects as a 3D concertina, driven by the list beside it. It is
 * server-rendered as a plain browser window showing the active project (the
 * no-JS, data-saver and no-WebGL experience); on capable devices a lazily loaded
 * Three.js scene takes over. The canvas is decorative for assistive technology:
 * everything it shows and does is in the list.
 */
export default function FoldStage({
  projects,
  active,
  peek,
  onSelect,
  onHover,
  livePreviews,
  className,
}: {
  projects: ProjectCardData[]
  active: number
  /** A panel to ease open: the list's row under the pointer. */
  peek: number | null
  onSelect: (index: number) => void
  /** The panel under the pointer, or null. */
  onHover: (index: number | null) => void
  /** Demo URLs the server finds framable (see getFramableDemos). */
  livePreviews?: Promise<string[]>
  className?: string
}) {
  const tp = useTranslations('projectPages')
  const locale = useLocale()
  const router = useRouter()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveBoxRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<FoldScene | null>(null)
  const restingRef = useRef(false)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const liveMatrixRef = useRef<string | null>(null)
  const [mode, setMode] = useState<Mode>()
  const [hovered, setHovered] = useState<number | null>(null)
  const [resting, setResting] = useState(false)

  // The scene's callbacks and its first frame read these. Written during effects
  // only; the first values are right for a scene created later on.
  const latest = useRef({ active, peek, projects, onSelect, onHover, locale, router })
  useEffect(() => {
    latest.current = { active, peek, projects, onSelect, onHover, locale, router }
  })

  useEffect(() => {
    sceneRef.current?.setActive(active)
  }, [active])
  useEffect(() => {
    sceneRef.current?.setPeek(peek)
  }, [peek])

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
    let scene: FoldScene | null = null
    let unfold: ScrollTrigger | null = null

    const stop = () => {
      cancelled = true
      unfold?.kill()
      unfold = null
      scene?.dispose()
      scene = null
      sceneRef.current = null
    }

    const start = async () => {
      const { createFoldScene } = await import('./scene')
      if (cancelled) return
      scene = createFoldScene({
        canvas,
        panels: latest.current.projects.map(panelInput),
        active: latest.current.active,
        still: motion.matches,
        rtl,
        onReady: () => setMode('live'),
        onContextLost: () => {
          stop()
          setMode('static')
        },
        onSelect: (index) => latest.current.onSelect(index),
        onOpen: (index, newTab) => {
          const { projects: list, router: nav, locale: language } = latest.current
          const project = list[index]
          if (!project) return
          const href = `/projects/${project.slug}`
          trackEvent('project-case-study', { project: project.slug, from: 'home' })
          if (newTab) window.open(getPathname({ href, locale: language }), '_blank', 'noopener')
          else nav.push(href)
        },
        onHover: (index) => {
          setHovered(index)
          latest.current.onHover(index)
        },
        onRest: (screen) => placeLive(screen),
      })
      sceneRef.current = scene
      scene.setPeek(latest.current.peek)

      if (!motion.matches) {
        gsap.registerPlugin(ScrollTrigger)
        unfold = ScrollTrigger.create({
          trigger: stage,
          start: 'top 92%',
          end: 'top 52%',
          onUpdate: (self) => scene?.setOpen(self.progress),
        })
        scene.setOpen(unfold.progress)
      }
    }

    const placeLive = (screen: Quad | null) => {
      const matrix = screen && quadToMatrix3d(LIVE_VIEWPORT_WIDTH, LIVE_VIEWPORT_HEIGHT, screen)
      if (matrix) {
        liveMatrixRef.current = matrix
        if (liveBoxRef.current) liveBoxRef.current.style.transform = matrix
      }
      const next = screen !== null
      if (next === restingRef.current) return
      restingRef.current = next
      setResting(next)
    }

    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        near.disconnect()
        start().catch((error: unknown) => {
          if (cancelled) return
          console.warn('Project fold 3D scene disabled:', error)
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

  // The scene only reports the panel's corners when it draws, and a resting scene
  // doesn't draw. A demo that mounts during that rest starts from the last ones.
  const attachLiveBox = useCallback((element: HTMLDivElement | null) => {
    liveBoxRef.current = element
    if (element && liveMatrixRef.current) element.style.transform = liveMatrixRef.current
  }, [])

  const placePill = useCallback(() => {
    const pill = pillRef.current
    const canvas = canvasRef.current
    const pointer = pointerRef.current
    if (!pill || !canvas || !pointer) return
    const box = canvas.getBoundingClientRect()
    const x = Math.min(pointer.x - box.left + 14, box.width - pill.offsetWidth - 8)
    pill.style.translate = `${x}px ${pointer.y - box.top + 18}px`
  }, [])

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    pointerRef.current = { x: event.clientX, y: event.clientY }
    placePill()
  }

  const current = projects[active] ?? projects[0]
  const liveTitle = tp('liveDemoAria', { title: current.title })
  const opensCaseStudy = hovered === active
  const pillLabel =
    hovered === null ? null : opensCaseStudy ? tp('readCaseStudy') : splitProjectTitle(projects[hovered]?.title ?? '').name

  // A new label can be wider: keep it inside the canvas without waiting for the pointer.
  useEffect(() => placePill(), [pillLabel, placePill])

  return (
    <div ref={stageRef} data-mode={mode} onPointerMove={onPointerMove} className={cn(styles.stage, className)}>
      <div className={styles.windowBox}>
        <ProjectWindow
          host={projectHost(current.demo)}
          href={`/projects/${current.slug}`}
          linkLabel={tp('readCaseStudyAria', { title: current.title })}
          linkProps={trackClick('project-case-study', { project: current.slug, from: 'home' })}
        >
          {projects.map((project, index) => (
            <div key={project.id} data-current={index === active ? '' : undefined} className={styles.slide}>
              <ProjectCover project={project} alt={tp('coverAlt', { title: project.title })} sizes={COVER_SIZES} />
            </div>
          ))}
          {mode === 'static' && current.demo && livePreviews && (
            <Suspense fallback={null}>
              <FramableLivePreview key={current.id} framable={livePreviews} url={current.demo} title={liveTitle} />
            </Suspense>
          )}
        </ProjectWindow>
      </div>

      <canvas ref={canvasRef} aria-hidden="true" className={styles.canvas} />

      <div aria-hidden="true" className={styles.overlay}>
        {mode === 'live' && current.demo && livePreviews && (
          <Suspense fallback={null}>
            <FramablePanelLive
              key={current.id}
              framable={livePreviews}
              url={current.demo}
              title={liveTitle}
              resting={resting}
              boxRef={attachLiveBox}
            />
          </Suspense>
        )}
        <div ref={pillRef} data-show={pillLabel ? '' : undefined} className={styles.pill}>
          <span dir="auto">{pillLabel}</span>
          {opensCaseStudy && <ArrowUpRight size={14} aria-hidden="true" className="rtl:-scale-x-100" />}
        </div>
      </div>
    </div>
  )
}

function FramablePanelLive({ framable, ...props }: PanelLiveProps & { framable: Promise<string[]> }) {
  return use(framable).includes(props.url) ? <PanelLive {...props} /> : null
}

interface PanelLiveProps {
  url: string
  title: string
  resting: boolean
  boxRef: RefCallback<HTMLDivElement>
}

/**
 * The live demo on the open panel: a DOM iframe laid exactly over the panel's
 * screen (the scene reports its corners, `matrix3d` follows). While the panel
 * moves the picture on the panel itself shows instead.
 */
function PanelLive({ url, title, resting, boxRef }: PanelLiveProps) {
  const [armed, setArmed] = useState(false)
  const { mounted, ready, onLoad } = useLiveFrame(url, armed)

  useEffect(() => {
    if (!resting || armed) return
    const timer = setTimeout(() => setArmed(true), LIVE_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [resting, armed])

  return (
    <div
      ref={boxRef}
      inert
      data-show={ready && resting ? '' : undefined}
      className={styles.liveBox}
      style={{ width: LIVE_VIEWPORT_WIDTH, height: LIVE_VIEWPORT_HEIGHT }}
    >
      {mounted && <LiveFrame url={url} title={title} onLoad={onLoad} />}
    </div>
  )
}
