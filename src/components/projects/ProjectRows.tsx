'use client'

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, ExternalLink, Github } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { pillArrow, pillOutline, pillPrimary } from '@/components/sections/showcase/classes'
import { projectHost, type ProjectCardData } from '@/features/content/projects.map'
import { trackClick } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { FramableLivePreview } from './LivePreview'
import ProjectWindow, { ProjectCover } from './ProjectWindow'
import StackChips from './StackChips'
import styles from './ProjectRows.module.css'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Numbered project list, one per row: a framed cover beside its story, sides
 * alternating. The /projects index; the home page shows its selection in the
 * interactive ProjectsSection instead.
 */
export default function ProjectRows({
  projects,
  from,
  livePreviews,
  headingLevel: Heading = 'h3',
  firstNumber = 1,
  priorityFirst = false,
}: {
  projects: ProjectCardData[]
  /** Where the list is shown, recorded with its clicks (analytics). */
  from: string
  /**
   * Demo URLs the server finds framable; on desktop their frame shows the live
   * site over the cover. A promise, so this check streams in: it never holds up
   * the page, and the covers already on screen stay in place when it arrives.
   */
  livePreviews?: Promise<string[]>
  headingLevel?: 'h2' | 'h3'
  /** Number of the first row, so a paginated list keeps counting across pages. */
  firstNumber?: number
  /** Loads the first cover eagerly: for a list that starts near the top of its page. */
  priorityFirst?: boolean
}) {
  const t = useTranslations('projects')
  const tp = useTranslations('projectPages')

  return (
    <ol start={firstNumber} aria-label={t('title')} className={styles.list}>
      {projects.map((project, i) => {
        const href = `/projects/${project.slug}`
        const click = { project: project.slug, from }
        const alt = tp('coverAlt', { title: project.title })
        return (
          <li key={project.id} className={cn(styles.row, i % 2 === 1 && styles.flip)}>
            <ProjectWindow
              host={projectHost(project.demo)}
              href={href}
              linkLabel={tp('readCaseStudyAria', { title: project.title })}
              linkProps={trackClick('project-case-study', click)}
              className={styles.media}
            >
              <ProjectCover
                project={project}
                alt={alt}
                sizes="(max-width: 900px) 92vw, (max-width: 1280px) 50vw, 640px"
                priority={priorityFirst && i === 0}
              />
              {project.demo && livePreviews && (
                <Suspense fallback={null}>
                  <FramableLivePreview framable={livePreviews} url={project.demo} title={tp('liveDemoAria', { title: project.title })} />
                </Suspense>
              )}
            </ProjectWindow>

            <div className={styles.body}>
              <p className={styles.meta}>
                <span className={styles.num} aria-hidden="true">{pad(firstNumber + i)}</span>
                {project.dateLabel && <span>{project.dateLabel}</span>}
                {project.featured && <span className={styles.badge}><span aria-hidden="true">✦</span>{t('featured')}</span>}
              </p>
              <Heading className={styles.title}><Link href={href} {...trackClick('project-case-study', click)}>{project.title}</Link></Heading>
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
  )
}
