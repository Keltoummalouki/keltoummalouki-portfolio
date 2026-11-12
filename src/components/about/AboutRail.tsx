'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import VoxelStage from '@/components/three/voxel-icon/VoxelStage'
import { VoxelGlyph } from '@/components/three/voxel-icon/glyphs'
import { Link } from '@/i18n/navigation'
import { trackClick } from '@/lib/analytics/events'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { getLenisInstance } from '@/lib/motion/smooth-scroll'
import { cn } from '@/lib/utils'
import { activeChapterIndex, readingLine, type AboutChapter, type AboutChapterId } from './chapters'
import { ctaPrimary, ctaSecondary } from './ProfileSection'
import styles from './about-layout.module.css'

/** A pointer resting this long on a chapter previews its icon in the 3D stage. */
const HOVER_INTENT_MS = 70
/** After a jump, the scrollspy waits for the scroll to settle (or this long, if nothing scrolls). */
const JUMP_HOLD_MS = 1200
const SETTLE_MS = 140
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

export interface AboutRailProps {
  chapters: AboutChapter[]
  /** Names the chapter list ("On this page"). */
  label: string
  cvUrl: string
  labels: { downloadCv: string; workWithMe: string }
  className?: string
}

/**
 * The /about page's chapter rail. On phones, a sticky bar of chapter chips; from
 * `lg`, a sticky column with the 3D companion (the current chapter's icon in
 * voxels), the chapter list and the two main actions. One element, restyled by
 * about-layout.module.css. The links are plain in-page anchors, so it works
 * without JavaScript; with it, they glide (Lenis), mark the chapter being read
 * and move focus to its heading.
 */
export default function AboutRail({ chapters, label, cvUrl, labels, className }: AboutRailProps) {
  const [active, setActive] = useState<AboutChapterId>(chapters[0]?.id ?? 'profile')
  const [preview, setPreview] = useState<AboutChapterId | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const holdRef = useRef<number | null>(null)
  const hoverRef = useRef(0)
  const measureRef = useRef<() => void>(() => {})

  const release = useCallback(() => {
    if (holdRef.current !== null) window.clearTimeout(holdRef.current)
    holdRef.current = null
    measureRef.current()
  }, [])

  const hold = useCallback(
    (ms: number) => {
      if (holdRef.current !== null) window.clearTimeout(holdRef.current)
      holdRef.current = window.setTimeout(release, ms)
    },
    [release],
  )

  // Scrollspy: the chapter whose section has crossed the reading line.
  useEffect(() => {
    const targets = chapters.map((chapter) => document.getElementById(chapter.target))
    const marginSource = targets[1] ?? targets[0]
    let frame = 0

    const measure = () => {
      frame = 0
      if (holdRef.current !== null) return
      const margin = marginSource ? Number.parseFloat(getComputedStyle(marginSource).scrollMarginTop) || 0 : 0
      const line = readingLine(margin, window.innerHeight)
      const tops = targets.map((target) => (target ? target.getBoundingClientRect().top : Infinity))
      const page = document.scrollingElement ?? document.documentElement
      const atEnd = window.scrollY > 0 && window.scrollY + window.innerHeight >= page.scrollHeight - 2
      const chapter = chapters[activeChapterIndex(tops, line, atEnd)]
      if (chapter) setActive(chapter.id)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measureRef.current = schedule

    const onScroll = () => {
      // During a jump, wait for the scroll to settle instead of flicking through every chapter.
      if (holdRef.current !== null) hold(SETTLE_MS)
      else schedule()
    }
    // The visitor taking over cancels the wait.
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) release()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('wheel', release, { passive: true })
    window.addEventListener('touchstart', release, { passive: true })
    window.addEventListener('keydown', onKey)
    schedule()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('wheel', release)
      window.removeEventListener('touchstart', release)
      window.removeEventListener('keydown', onKey)
      if (frame) cancelAnimationFrame(frame)
      if (holdRef.current !== null) window.clearTimeout(holdRef.current)
      holdRef.current = null
      measureRef.current = () => {}
    }
  }, [chapters, hold, release])

  // Keeps the current chapter in view inside the rail: sideways in the phone bar,
  // up and down in the column when the list is taller than the screen allows.
  useEffect(() => {
    const scroller = scrollerRef.current
    const link = scroller?.querySelector<HTMLElement>(`[data-chapter="${active}"]`)
    if (!scroller || !link) return
    const box = scroller.getBoundingClientRect()
    const item = link.getBoundingClientRect()
    const left = scroller.scrollWidth > scroller.clientWidth + 1 ? item.left + item.width / 2 - (box.left + box.width / 2) : 0
    const top = scroller.scrollHeight > scroller.clientHeight + 1 ? item.top + item.height / 2 - (box.top + box.height / 2) : 0
    if (Math.abs(left) < 4 && Math.abs(top) < 4) return
    scroller.scrollBy({ left, top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  // Slides the column's highlight to the current chapter.
  useEffect(() => {
    const scroller = scrollerRef.current
    const indicator = indicatorRef.current
    if (!scroller || !indicator) return
    const place = () => {
      const link = scroller.querySelector<HTMLElement>(`[data-chapter="${active}"]`)
      if (!link) return
      indicator.style.setProperty('--indicator-y', `${link.offsetTop}px`)
      indicator.style.setProperty('--indicator-h', `${link.offsetHeight}px`)
    }
    place()
    const sizes = new ResizeObserver(place)
    sizes.observe(scroller)
    return () => sizes.disconnect()
  }, [active])

  useEffect(() => () => window.clearTimeout(hoverRef.current), [])

  const previewSoon = (id: AboutChapterId) => {
    window.clearTimeout(hoverRef.current)
    hoverRef.current = window.setTimeout(() => setPreview(id), HOVER_INTENT_MS)
  }
  const endPreview = () => {
    window.clearTimeout(hoverRef.current)
    setPreview(null)
  }

  const jump = (event: MouseEvent<HTMLAnchorElement>, chapter: AboutChapter) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = document.getElementById(chapter.target)
    if (!target) return
    event.preventDefault()
    // Lenis listens for in-page links on window too, and would add its own offset
    // to the section's scroll-margin: this click is handled here.
    event.stopPropagation()
    endPreview()
    setActive(chapter.id)
    hold(JUMP_HOLD_MS)
    scrollToChapter(target)
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', chapter.id === 'profile' ? `${pathname}${search}` : `#${chapter.target}`)
    focusHeading(target)
  }

  const shown = chapters.find((chapter) => chapter.id === (preview ?? active)) ?? chapters[0]
  if (!shown) return null

  return (
    <div className={cn(styles.rail, className)}>
      <div className={styles.stageCard} aria-hidden="true">
        <div className={cn(styles.stage, 'grid-pattern')}>
          <VoxelStage icon={shown.icon} />
        </div>
        <p className={styles.caption}>
          <span className={styles.captionNumber}>{shown.number}</span>
          <span className={styles.captionLabel}>{shown.label}</span>
        </p>
      </div>

      <nav aria-label={label} className={styles.toc}>
        <p aria-hidden="true" className={styles.tocLabel}>
          {label}
        </p>
        <div ref={scrollerRef} className={styles.scroller}>
          <span ref={indicatorRef} aria-hidden="true" className={styles.indicator} />
          <ol className={styles.list}>
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <a
                  href={`#${chapter.target}`}
                  data-chapter={chapter.id}
                  aria-current={chapter.id === active ? 'location' : undefined}
                  className={styles.link}
                  onClick={(event) => jump(event, chapter)}
                  onMouseEnter={() => previewSoon(chapter.id)}
                  onMouseLeave={endPreview}
                  onFocus={() => previewSoon(chapter.id)}
                  onBlur={endPreview}
                >
                  <VoxelGlyph name={chapter.icon} className={styles.linkIcon} />
                  <span className={styles.linkLabel}>{chapter.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <div className={styles.actions}>
        <a
          href={cvUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={cn(ctaPrimary, styles.action)}
          {...trackClick('cv-download', { from: 'about-rail' })}
        >
          <Download aria-hidden="true" className="size-4" />
          {labels.downloadCv}
        </a>
        <Link
          href="/freelance"
          className={cn(ctaSecondary, styles.action, 'group')}
          {...trackClick('contact-cta', { from: 'about-rail' })}
        >
          {labels.workWithMe}
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  )
}

/** Glides with Lenis when it runs; Lenis and scrollIntoView both honour the target's scroll-margin. */
function scrollToChapter(target: HTMLElement) {
  const reduce = prefersReducedMotion()
  const lenis = getLenisInstance()
  if (lenis && !reduce) {
    lenis.scrollTo(target)
    return
  }
  target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
}

/** As a real in-page jump does: the next Tab continues from the chapter, not from the list. */
function focusHeading(target: HTMLElement) {
  const heading = target.matches('h1, h2') ? target : target.querySelector<HTMLElement>('h1, h2')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
}
