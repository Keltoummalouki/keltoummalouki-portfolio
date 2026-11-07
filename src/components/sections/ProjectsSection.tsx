'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, ExternalLink, Github } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import StackChips from '@/components/projects/StackChips'
import { pillArrow, pillOutline, pillPrimary } from '@/components/sections/showcase/classes'
import { fallbackProjectCards } from '@/features/content/projects.fallback'
import { projectHost, type ProjectCardData } from '@/features/content/projects.map'
import { trackClick } from '@/lib/analytics/events'
import { isOptimizableImageSrc } from '@/lib/images'
import { cn } from '@/lib/utils'
import styles from './ProjectsSection.module.css'

const pad = (n: number) => String(n).padStart(2, '0')

// The home page's selection (`projects`, featured first); "View all" leads to
// /projects. `total`: how many projects are published, shown by the title.
// `livePreviews`: demo URLs the server found framable; on desktop their frame
// shows the live site over the cover.
export default function ProjectsSection({ projects, total, index, livePreviews = [] }: {
  projects?: ProjectCardData[]
  total: number
  index: string
  livePreviews?: string[]
}) {
  const t = useTranslations('projects')
  const tp = useTranslations('projectPages')
  const items = projects?.length ? projects : fallbackProjectCards(key => t(key))
  const count = projects?.length ? total : items.length
  const framable = new Set(livePreviews)
  const sectionRef = useRef<HTMLElement>(null)

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

  if (items.length === 0) return null
  return (
    <section id="projects" ref={sectionRef} aria-labelledby="projects-title" className={styles.section}>
      <header className={styles.header} data-work-reveal>
        <div>
          <p className={styles.eyebrow}><span />{index} / {t('title')}<span className={styles.total}>{pad(count)}</span></p>
          <h2 id="projects-title" className={styles.heading}>{t('heading')}</h2>
        </div>
        <div className={styles.intro}>
          <p>{t('subtitle')}</p>
          <Link href="/projects" className={styles.archive}>{tp('viewAll')}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </header>
      <div className={styles.rule}><div data-work-rule /></div>

      <ol aria-label={t('title')} className={styles.list} data-work-reveal>
        {items.map((project, i) => {
          const href = `/projects/${project.slug}`
          const host = projectHost(project.demo)
          const click = { project: project.slug, from: 'home' }
          return (
            <li key={project.id} className={cn(styles.row, i % 2 === 1 && styles.flip)}>
              <div className={styles.media}>
                <div className={styles.chrome}>
                  <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
                  {host && <span className={styles.host} dir="ltr">{host}</span>}
                </div>
                <div className={styles.screen}>
                  {project.image ? <>
                    {/* Blurred backdrop copy: `alt` is for crawlers (Bing flags empty ones); aria-hidden keeps screen readers on the real cover below. */}
                    <Image src={project.image} alt={tp('coverAlt', { title: project.title })} aria-hidden="true" fill sizes="64px" unoptimized={!isOptimizableImageSrc(project.image)} className={styles.ambient} />
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
                    <LivePreview url={project.demo} title={tp('liveDemoAria', { title: project.title })} />
                  )}
                </div>
                {/* Mouse shortcut to the case study; the title and button carry it for keyboards. */}
                <Link href={href} tabIndex={-1} aria-label={tp('readCaseStudyAria', { title: project.title })} className={styles.frameLink} {...trackClick('project-case-study', click)}>
                  <span className={styles.open} aria-hidden="true"><ArrowUpRight size={20} /></span>
                </Link>
              </div>

              <div className={styles.body}>
                <p className={styles.meta}>
                  <span className={styles.num} aria-hidden="true">{pad(i + 1)}</span>
                  {project.dateLabel && <span>{project.dateLabel}</span>}
                  {project.featured && <span className={styles.badge}><span aria-hidden="true">✦</span>{t('featured')}</span>}
                </p>
                <h3 className={styles.title}><Link href={href} {...trackClick('project-case-study', click)}>{project.title}</Link></h3>
                {project.description && <p className={styles.description}>{project.description}</p>}
                <StackChips items={project.stackItems} label={t('techStack')} max={6} className={styles.stack} />
                <div className={styles.links}>
                  <Link href={href} aria-label={tp('readCaseStudyAria', { title: project.title })} className={pillPrimary} {...trackClick('project-case-study', click)}>
                    {tp('readCaseStudy')}<ArrowRight aria-hidden="true" className={pillArrow} />
                  </Link>
                  {project.demo && (
                    <a href={project.demo} target="_blank" rel="noopener noreferrer" aria-label={tp('liveDemoAria', { title: project.title })} className={pillOutline} {...trackClick('project-demo', click)}>
                      <ExternalLink aria-hidden="true" className="size-4" />{tp('liveDemo')}
                    </a>
                  )}
                  {project.github && (
                    <a href={project.github} target="_blank" rel="noopener noreferrer" aria-label={tp('viewCodeAria', { title: project.title })} className={pillOutline} {...trackClick('project-code', click)}>
                      <Github aria-hidden="true" className="size-4" />{tp('viewCode')}
                    </a>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
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
 * and fades in over the cover.
 */
function LivePreview({ url, title }: { url: string; title: string }) {
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
    if (!el || near) return
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) setNear(true) }, { rootMargin: '300px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale((entry?.contentRect.width ?? 0) / LIVE_VIEWPORT_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const mounted = capable && near && scale > 0 && !blocked
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
