'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { animate, scrambleText, svg } from 'animejs'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { ICE_BEAR } from './bear'
import type { IceBearScene } from './scene'
import styles from './ice-bear.module.css'

/** His lines, in the order a visitor discovers them by poking him. */
const QUIPS = ['code', 'friday', 'darkMode', 'review', 'coffee', 'bugs'] as const

/** Glyphs for the caption's scramble. Never `<`, `>` or `&`: scrambleText writes innerHTML. */
function scrambleChars(): string {
  return document.documentElement.lang === 'ar' ? 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي' : 'A-Za-z0-9{}[]()/=+*#%$_'
}

/** Skip the 3D scene where it would cost the visitor (data saver, very low memory). */
function wantsWebGL(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  if (nav.connection?.saveData) return false
  return nav.deviceMemory === undefined || nav.deviceMemory >= 2
}

/**
 * A standalone copy of the page's picture for WebGL. The <img> uses srcset,
 * so its naturalWidth is density-corrected (340 for a 384px file) and a
 * texture sized from it would not fit the upload. Same URL: a cache hit.
 */
async function loadTextureImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  try {
    await image.decode()
  } catch {
    // Checked below: a broken image has no size.
  }
  if (!image.naturalWidth) throw new Error('The Ice Bear picture did not load')
  const copy = document.createElement('img') // `Image` is next/image in this module
  copy.decoding = 'async'
  copy.src = image.currentSrc || image.src
  await copy.decode()
  return copy
}

type Mode = 'static' | 'loading' | 'live'

/**
 * The hero mascot. Server-rendered as a plain picture (the no-JS, reduced-motion
 * and no-WebGL experience); on capable devices a lazily loaded Three.js scene
 * builds him in a snowstorm and takes over (./scene.ts). Poking him (click,
 * tap, Enter) wobbles him and changes his line.
 */
export default function IceBearStage() {
  const t = useTranslations('hero.iceBear')
  const anchorRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const noteRef = useRef<HTMLDivElement>(null)
  const noteTextRef = useRef<HTMLSpanElement>(null)
  const notePathRef = useRef<SVGPathElement>(null)
  const sceneRef = useRef<IceBearScene | null>(null)
  const quipRef = useRef(0)
  /** His current line once poked (null: still the server-rendered one). */
  const lineRef = useRef<string | null>(null)
  const [mode, setMode] = useState<Mode>()
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches || !wantsWebGL()) {
      setMode('static')
      return
    }
    let cancelled = false
    let scene: IceBearScene | null = null
    const stop = () => {
      cancelled = true
      scene?.dispose()
      scene = null
      sceneRef.current = null
    }
    // Turning on "reduce motion" mid-visit hands back the still picture.
    const onMotionChange = () => {
      if (!motion.matches) return
      stop()
      setMode('static')
    }
    motion.addEventListener('change', onMotionChange)
    setMode('loading')

    // After the intro: the caption's line draws in, then its text decodes.
    const showNote = () => {
      const note = noteRef.current
      const text = noteTextRef.current
      const path = notePathRef.current
      if (cancelled || !note || !text || !path) return
      note.setAttribute('data-on', '')
      animate(svg.createDrawable(path), { draw: ['0 0', '0 1'], duration: 900, ease: 'inOutQuad' })
      animate(text, {
        innerHTML: scrambleText({
          text: lineRef.current ?? text.textContent ?? '',
          chars: scrambleChars(),
          cursor: '_',
          settleDuration: 420,
          revealRate: 32,
        }),
        delay: 300,
      })
    }

    const start = async () => {
      const image = imageRef.current
      const canvas = canvasRef.current
      const anchor = anchorRef.current
      const hero = anchor?.closest('section')
      if (!image || !canvas || !anchor || !hero) throw new Error('The Ice Bear stage is incomplete')
      const [texture, { createIceBearScene }] = await Promise.all([loadTextureImage(image), import('./scene')])
      if (cancelled) return
      scene = createIceBearScene({
        canvas,
        hero,
        anchor,
        image: texture,
        // Picture already on screen (the scene came late): swap in place, no storm.
        intro: Number.parseFloat(getComputedStyle(image).opacity) < 0.05,
        onReady: () => setMode('live'),
        onIntroDone: showNote,
        onContextLost: () => {
          scene?.dispose()
          scene = null
          sceneRef.current = null
          setMode('static')
        },
      })
      sceneRef.current = scene
    }

    start().catch((error: unknown) => {
      if (cancelled) return
      console.warn('Ice Bear 3D scene disabled:', error)
      setMode('static')
    })

    return () => {
      motion.removeEventListener('change', onMotionChange)
      stop()
    }
  }, [])

  const poke = (event: MouseEvent<HTMLButtonElement>) => {
    quipRef.current = (quipRef.current + 1) % QUIPS.length
    const line = t(`quips.${QUIPS[quipRef.current]}`)
    lineRef.current = line
    setAnnouncement(line)
    const text = noteTextRef.current
    if (text) {
      if (prefersReducedMotion()) text.textContent = line
      else animate(text, { innerHTML: scrambleText({ text: line, chars: scrambleChars(), cursor: '_', settleDuration: 300, revealRate: 45 }) })
    }

    // Where he was poked (a keyboard press pokes his belly).
    let u = 0.55
    let v = 0.42
    const box = anchorRef.current?.getBoundingClientRect()
    if (box && event.detail !== 0) {
      u = (event.clientX - box.left) / box.width
      v = 1 - (event.clientY - box.top) / box.height
    }
    if (sceneRef.current) {
      sceneRef.current.poke(u, v)
    } else if (imageRef.current && !prefersReducedMotion()) {
      animate(imageRef.current, { rotate: [0, -5, 4, -2, 0], translateY: [0, -10, 0], duration: 800, ease: 'outQuad' })
    }
  }

  return (
    <div data-mode={mode} className={cn(styles.stage, 'flex justify-center')}>
      <div aria-hidden="true" className={styles.orb} />
      <div aria-hidden="true" className={styles.ring} />
      <div aria-hidden="true" className={styles.ground} />

      <div
        ref={anchorRef}
        className="relative aspect-830/1390 h-70 sm:h-84 md:h-100 lg:h-[min(32rem,calc(100svh-15rem))] xl:h-[min(35rem,calc(100svh-14rem))]"
      >
        <Image
          ref={imageRef}
          src={ICE_BEAR.src}
          alt={t('alt')}
          fill
          priority
          draggable={false}
          sizes="(min-width: 1280px) 340px, (min-width: 1024px) 310px, (min-width: 768px) 250px, (min-width: 640px) 210px, 170px"
          className={cn(styles.static, 'select-none object-contain')}
        />
        <button
          type="button"
          onClick={poke}
          aria-label={t('poke')}
          title={t('poke')}
          className="absolute inset-x-[6%] inset-y-[1%] z-10 cursor-pointer rounded-[45%]"
        />
      </div>

      <div aria-hidden="true" className={cn(styles.ring, styles.ringFront)} />

      {/* His caption (decorative; pokes are announced by the live region). */}
      <div
        ref={noteRef}
        aria-hidden="true"
        className={cn(
          styles.note,
          'pointer-events-none absolute start-[calc(100%+1.25rem)] top-[7%] z-10 hidden w-[13ch] font-mono text-[0.8125rem] sm:block lg:hidden xl:block',
        )}
      >
        <svg viewBox="0 0 56 48" fill="none" className="absolute end-[calc(100%+0.25rem)] top-3 h-12 w-14 text-primary-text/70 rtl:-scale-x-100">
          <path ref={notePathRef} d="M54 4 C 40 2, 18 10, 3 44" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        <span ref={noteTextRef} className="block leading-snug text-foreground/85">
          {t('quips.code')}
        </span>
      </div>

      <canvas ref={canvasRef} aria-hidden="true" className={styles.canvas} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
