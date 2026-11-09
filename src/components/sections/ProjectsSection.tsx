'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTranslations } from 'next-intl'
import { ArrowRight, ArrowUpRight, ChevronDown, ExternalLink, Github } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import StackChips from '@/components/projects/StackChips'
import { pillArrow, pillPrimary } from '@/components/sections/showcase/classes'
import FoldStage from '@/components/three/project-fold/FoldStage'
import { fallbackProjectCards } from '@/features/content/projects.fallback'
import { splitProjectTitle, type ProjectCardData } from '@/features/content/projects.map'
import { trackClick } from '@/lib/analytics/events'
import styles from './ProjectsSection.module.css'

const pad = (n: number) => String(n).padStart(2, '0')

/** Remembers the open project for this visit, so coming back from a case study lands on it. */
const OPEN_PROJECT_KEY = 'featured-project-open'

// The home page's selection (`projects`, featured first): a list of short rows
// that opens one project at a time, beside a 3D concertina doing the same. One
// screen tall, whatever the number of projects, and nothing moves on its own.
// `total`: how many projects are published, in the link to all of them.
// `livePreviews`: demo URLs the server finds framable (see FoldStage).
export default function ProjectsSection({ projects, total, index, livePreviews }: {
  projects?: ProjectCardData[]
  total: number
  index: string
  livePreviews?: Promise<string[]>
}) {
  const t = useTranslations('projects')
  const tp = useTranslations('projectPages')
  const items = useMemo(() => (projects?.length ? projects : fallbackProjectCards((key) => t(key))), [projects, t])
  const count = projects?.length ? total : items.length
  const sectionRef = useRef<HTMLElement>(null)
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [peek, setPeek] = useState<number | null>(null)

  const open = useCallback((next: number) => {
    setActive(next)
    try {
      sessionStorage.setItem(OPEN_PROJECT_KEY, items[next]?.slug ?? '')
    } catch {
      // Storage can be blocked; the section still works, it just won't remember.
    }
  }, [items])

  useEffect(() => {
    try {
      const remembered = items.findIndex((project) => project.slug === sessionStorage.getItem(OPEN_PROJECT_KEY))
      if (remembered > 0) setActive(remembered)
    } catch {
      // Same: nothing to restore.
    }
  }, [items])

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

  /** Arrow keys walk the rows, wrapping around (the accordion keyboard pattern). */
  const onRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: number) => {
    const last = items.length - 1
    const to = { ArrowDown: row === last ? 0 : row + 1, ArrowUp: row === 0 ? last : row - 1, Home: 0, End: last }[event.key]
    if (to === undefined) return
    event.preventDefault()
    triggers.current[to]?.focus()
  }

  /** Mouse only: on touch a tap would leave the row "hovered" until the next tap. */
  const peekWith = (row: number | null) => (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') setPeek(row)
  }

  if (items.length === 0) return null
  return (
    <section id="projects" ref={sectionRef} aria-labelledby="projects-title" className={styles.section}>
      <header className={styles.header} data-work-reveal>
        <div>
          <p className={styles.eyebrow}><span />{index} / {t('title')}</p>
          <h2 id="projects-title" className={styles.heading}>{t('heading')}</h2>
        </div>
        <p className={styles.intro}>{t('subtitle')}</p>
      </header>
      <div className={styles.rule}><div data-work-rule /></div>

      <div className={styles.layout}>
        <div data-work-reveal>
          <FoldStage
            projects={items}
            active={active}
            peek={peek}
            onSelect={open}
            onHover={setPeek}
            livePreviews={livePreviews}
          />
        </div>

        <div className={styles.index} data-work-reveal>
          <ol aria-label={t('title')} className={styles.rows}>
            {items.map((project, row) => {
              const isOpen = row === active
              const { name, tagline } = splitProjectTitle(project.title)
              const href = `/projects/${project.slug}`
              const click = { project: project.slug, from: 'home' }
              const triggerId = `project-trigger-${project.slug}`
              const panelId = `project-panel-${project.slug}`
              return (
                <li key={project.id} data-open={isOpen ? '' : undefined} data-peek={peek === row ? '' : undefined} className={styles.row}>
                  <h3 className={styles.rowHeading}>
                    <button
                      ref={(element) => {
                        triggers.current[row] = element
                      }}
                      id={triggerId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-disabled={isOpen || undefined}
                      onClick={() => open(row)}
                      onKeyDown={(event) => onRowKeyDown(event, row)}
                      onPointerEnter={peekWith(row)}
                      onPointerLeave={peekWith(null)}
                      onFocus={() => setPeek(row)}
                      onBlur={() => setPeek(null)}
                      className={styles.trigger}
                    >
                      <span className={styles.num} aria-hidden="true">{pad(row + 1)}</span>
                      <span className={styles.titles}>
                        <span className={styles.name}>{name}</span>
                        {tagline && <>
                          <span className="sr-only"> — </span>
                          <span className={styles.tagline}>{tagline}</span>
                        </>}
                      </span>
                      <ChevronDown size={18} aria-hidden="true" className={styles.chevron} />
                    </button>
                  </h3>

                  <div id={panelId} role="region" aria-labelledby={triggerId} className={styles.panel}>
                    <div className={styles.panelClip}>
                      <div className={styles.panelBody}>
                        {project.dateLabel && <p className={styles.date}>{project.dateLabel}</p>}
                        {project.description && <p className={styles.description}>{project.description}</p>}
                        <StackChips items={project.stackItems} label={t('techStack')} max={4} className={styles.stack} />
                        <div className={styles.actions}>
                          <Link href={href} aria-label={tp('readCaseStudyAria', { title: project.title })} className={pillPrimary} {...trackClick('project-case-study', click)}>
                            {tp('readCaseStudy')}<ArrowRight aria-hidden="true" className={pillArrow} />
                          </Link>
                          {/* Wraps as one group: a lone link on its own line reads as an afterthought. */}
                          <span className={styles.quietLinks}>
                            {project.demo && (
                              <a href={project.demo} target="_blank" rel="noopener noreferrer" aria-label={tp('liveDemoAria', { title: project.title })} className={styles.quiet} {...trackClick('project-demo', click)}>
                                <ExternalLink aria-hidden="true" className="size-4" />{tp('liveDemo')}
                              </a>
                            )}
                            {project.github && (
                              <a href={project.github} target="_blank" rel="noopener noreferrer" aria-label={tp('viewCodeAria', { title: project.title })} className={styles.quiet} {...trackClick('project-code', click)}>
                                <Github aria-hidden="true" className="size-4" />{tp('viewCode')}
                              </a>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <Link href="/projects" className={styles.all}>
            {t('allProjects', { count })}
            <ArrowUpRight size={18} aria-hidden="true" className={styles.allArrow} />
          </Link>
        </div>
      </div>
    </section>
  )
}
