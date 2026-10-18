'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { animate, stagger } from 'animejs'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, ExternalLink, Github } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import Pagination from '@/components/ui/Pagination'
import StackChips from '@/components/projects/StackChips'
import { pillArrow, pillOutline, pillPrimary } from '@/components/sections/showcase/classes'
import { fallbackProjectCards } from '@/features/content/projects.fallback'
import { projectHost, type ProjectCardData } from '@/features/content/projects.map'
import { isOptimizableImageSrc } from '@/lib/images'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { scrollToElement } from '@/lib/motion/smooth-scroll'
import { paginate } from '@/lib/pagination'
import { cn } from '@/lib/utils'
import styles from './ProjectsSection.module.css'

/** Projects per page on the home page; /projects lists them all. */
const PROJECTS_PER_PAGE = 3
/** Clearance for the fixed site header when the list scrolls back into view. */
const HEADER_OFFSET = 112

const pad = (n: number) => String(n).padStart(2, '0')

// Every row is rendered (other pages are `hidden`), so the home page links all
// case studies in its HTML; pagination only toggles which rows are shown.
// `livePreviews`: demo URLs the server found framable; on desktop their frame
// shows the live site over the cover.
export default function ProjectsSection({ projects, index, livePreviews = [] }: {
  projects?: ProjectCardData[]
  index: string
  livePreviews?: string[]
}) {
  const t = useTranslations('projects')
  const tp = useTranslations('projectPages')
  const items = projects?.length ? projects : fallbackProjectCards(key => t(key))
  const framable = new Set(livePreviews)
  const [requestedPage, setRequestedPage] = useState(1)
  const { page, totalPages } = paginate(items, requestedPage, PROJECTS_PER_PAGE)
  const first = (page - 1) * PROJECTS_PER_PAGE
  const sectionRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const pageChanged = useRef(false)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const section = sectionRef.current
      if (!section) return
      gsap.fromTo(section.querySelectorAll('[data-work-reveal]'),
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.75, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 85%', once: true } })
      gsap.fromTo(section.querySelector('[data-work-rule]'), { scaleX: 0 }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 25%', scrub: true },
      })
    })
    return () => media.revert()
  }, [])

  // New page: bring the list back under the header, move focus to it and
  // stagger its rows in. A layout effect, so rows never flash before fading in.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!pageChanged.current || !list) return
    if (list.getBoundingClientRect().top < HEADER_OFFSET) scrollToElement(list, HEADER_OFFSET)
    list.focus({ preventScroll: true })
    if (prefersReducedMotion()) return
    const animation = animate(list.querySelectorAll(':scope > li:not([hidden])'), {
      opacity: [0, 1], translateY: [24, 0], duration: 600, delay: stagger(90), ease: 'outCubic',
    })
    return () => { animation.revert() }
  }, [page])

  const goToPage = (next: number) => {
    pageChanged.current = true
    setRequestedPage(next)
  }

  if (items.length === 0) return null
  return (
    <section id="projects" ref={sectionRef} aria-labelledby="projects-title" className={styles.section}>
      <header className={styles.header} data-work-reveal>
        <div>
          <p className={styles.eyebrow}><span />{index} / {t('title')}<span className={styles.total}>{pad(items.length)}</span></p>
          <h2 id="projects-title" className={styles.heading}>{t('heading')}</h2>
        </div>
        <div className={styles.intro}>
          <p>{t('subtitle')}</p>
          <Link href="/projects" className={styles.archive}>{tp('viewAll')}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </header>
      <div className={styles.rule}><div data-work-rule /></div>

      <ol id="projects-list" ref={listRef} tabIndex={-1} aria-label={t('title')} className={styles.list} data-work-reveal>
        {items.map((project, i) => {
          const href = `/projects/${project.slug}`
          const host = projectHost(project.demo)
          const onPage = i >= first && i < first + PROJECTS_PER_PAGE
          return (
            <li
              key={project.id}
              hidden={!onPage}
              className={cn(styles.row, (i % PROJECTS_PER_PAGE) % 2 === 1 && styles.flip)}
            >
              <div className={styles.media}>
                <div className={styles.chrome}>
                  <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
                  {host && <span className={styles.host} dir="ltr">{host}</span>}
                </div>
                <div className={styles.screen}>
                  {project.image ? <>
                    <Image src={project.image} alt="" fill sizes="64px" unoptimized={!isOptimizableImageSrc(project.image)} className={styles.ambient} />
                    <Image
                      src={project.image}
                      alt={tp('coverAlt', { title: project.title })}
                      fill
                      sizes="(max-width: 900px) 92vw, (max-width: 1280px) 50vw, 640px"
                      unoptimized={!isOptimizableImageSrc(project.image)}
                      className={styles.shot}
                    />
                  </> : <span className={styles.placeholder} aria-hidden="true">{project.title.slice(0, 2).toUpperCase()}</span>}
                  {project.demo && framable.has(project.demo) && (
                    <LivePreview url={project.demo} title={tp('liveDemoAria', { title: project.title })} active={onPage} />
                  )}
                </div>
                {/* Mouse shortcut to the case study; the title and button carry it for keyboards. */}
                <Link href={href} tabIndex={-1} aria-label={tp('readCaseStudyAria', { title: project.title })} className={styles.frameLink}>
                  <span className={styles.open} aria-hidden="true"><ArrowUpRight size={20} /></span>
                </Link>
              </div>

              <div className={styles.body}>
                <p className={styles.meta}>
                  <span className={styles.num} aria-hidden="true">{pad(i + 1)}</span>
                  {project.dateLabel && <span>{project.dateLabel}</span>}
                  {project.featured && <span className={styles.badge}><span aria-hidden="true">✦</span>{t('featured')}</span>}
                </p>
                <h3 className={styles.title}><Link href={href}>{project.title}</Link></h3>
                {project.description && <p className={styles.description}>{project.description}</p>}
                <StackChips items={project.stackItems} label={t('techStack')} max={6} className={styles.stack} />
                <div className={styles.links}>
                  <Link href={href} aria-label={tp('readCaseStudyAria', { title: project.title })} className={pillPrimary}>
                    {tp('readCaseStudy')}<ArrowRight aria-hidden="true" className={pillArrow} />
                  </Link>
                  {project.demo && (
                    <a href={project.demo} target="_blank" rel="noopener noreferrer" aria-label={tp('liveDemoAria', { title: project.title })} className={pillOutline}>
                      <ExternalLink aria-hidden="true" className="size-4" />{tp('liveDemo')}
                    </a>
                  )}
                  {project.github && (
                    <a href={project.github} target="_blank" rel="noopener noreferrer" aria-label={tp('viewCodeAria', { title: project.title })} className={pillOutline}>
                      <Github aria-hidden="true" className="size-4" />{tp('viewCode')}
                    </a>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {totalPages > 1 && (
        <div className={styles.pager} data-work-reveal>
          <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} label={t('paginationLabel')} controls="projects-list" />
        </div>
      )}
    </section>
  )
}

/** Width the demo is laid out at (its desktop design), then scaled into the frame. */
const LIVE_VIEWPORT_WIDTH = 1440
/** Lets a demo's own preloader finish before it replaces the cover. */
const LIVE_REVEAL_DELAY_MS = 800

/**
 * The live demo inside the frame, as a non-interactive preview (`inert`, so the
 * page keeps scrolling over it and it never takes focus). Desktop only, and not
 * under reduced motion or Save-Data. It loads once its row nears the viewport
 * on the current page, fades in over the cover, and unloads on a page change.
 */
function LivePreview({ url, title, active }: { url: string; title: string; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [capable, setCapable] = useState(false)
  const [near, setNear] = useState(false)
  const [scale, setScale] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)

  // This site's own CSP can still refuse the frame (e.g. a server running an
  // older next.config). The browser then fires `load` on its placeholder page
  // anyway, so watch for the violation and keep the cover instead.
  useEffect(() => {
    const origin = new URL(url).origin
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.effectiveDirective === 'frame-src' && event.blockedURI.startsWith(origin)) setBlocked(true)
    }
    document.addEventListener('securitypolicyviolation', onViolation)
    return () => document.removeEventListener('securitypolicyviolation', onViolation)
  }, [url])

  useEffect(() => {
    const wide = matchMedia('(min-width: 900px)')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    const update = () => setCapable(wide.matches && !reduce.matches && !saveData)
    update()
    wide.addEventListener('change', update)
    reduce.addEventListener('change', update)
    return () => {
      wide.removeEventListener('change', update)
      reduce.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !active || near) return
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) setNear(true) }, { rootMargin: '300px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, near])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale((entry?.contentRect.width ?? 0) / LIVE_VIEWPORT_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const mounted = capable && active && near && scale > 0 && !blocked
  useEffect(() => {
    if (mounted) return
    setLoaded(false)
    setReady(false)
  }, [mounted])
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => setReady(true), LIVE_REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [loaded])

  return (
    <div ref={ref} inert className={cn(styles.live, ready && styles.liveReady)}>
      {mounted && (
        <iframe
          src={url}
          title={title}
          tabIndex={-1}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          style={{ transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}
