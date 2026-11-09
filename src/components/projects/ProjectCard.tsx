import Image from 'next/image'
import { ArrowRight, Folder } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import type { ProjectCardData } from '@/features/content/projects.map'
import { trackClick } from '@/lib/analytics/events'
import ProjectLinks, { type ProjectLinkLabels } from './ProjectLinks'
import StackChips from './StackChips'

export interface ProjectCardLabels extends ProjectLinkLabels {
  readCaseStudy: string
  readCaseStudyAria: string
  coverAlt: string
  stack: string
}

/**
 * Project card for the "More projects" list: cover, date, title (linked),
 * description, stack and a "Read case study" call to action pointing at the
 * indexable case-study page.
 */
export default function ProjectCard({
  project,
  labels,
  from,
  headingLevel: Heading = 'h2',
  showStack = true,
}: {
  project: ProjectCardData
  labels: ProjectCardLabels
  /** Where the card is listed, recorded with its clicks (analytics). */
  from: string
  headingLevel?: 'h2' | 'h3'
  showStack?: boolean
}) {
  const href = `/projects/${project.slug}`
  const click = { project: project.slug, from }
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        {project.image ? (
          <Image
            src={project.image}
            alt={labels.coverAlt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
            <Folder size={40} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        {project.dateLabel && <p className="text-sm font-medium text-primary">{project.dateLabel}</p>}
        <Heading className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
          <Link
            href={href}
            className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...trackClick('project-case-study', click)}
          >
            {project.title}
          </Link>
        </Heading>
        {project.description && (
          <p className="mt-3 line-clamp-3 leading-relaxed text-muted-foreground">{project.description}</p>
        )}
        {showStack && <StackChips items={project.stackItems} label={labels.stack} max={6} className="mt-4" />}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          <Button asChild size="sm">
            <Link href={href} aria-label={labels.readCaseStudyAria} {...trackClick('project-case-study', click)}>
              {labels.readCaseStudy}
              <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
          <ProjectLinks github={project.github} demo={project.demo} labels={labels} track={click} size="sm" />
        </div>
      </div>
    </article>
  )
}
