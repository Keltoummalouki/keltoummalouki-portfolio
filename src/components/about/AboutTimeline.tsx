import type { ReactNode } from 'react'
import { Briefcase, Calendar, GraduationCap, MapPin, type LucideIcon } from 'lucide-react'
import SkillIcon from '@/components/ui/SkillIcon'
import type { AboutEducationItem, AboutExperienceItem } from '@/features/seo/about-faq'
import { cn } from '@/lib/utils'
import ProfileSection, { cardClass, chipClass } from './ProfileSection'

// Experience and education as vertical timelines: a hairline through the nodes, the
// current position's node in the solid accent. Logical properties (start / ps)
// keep the line on the reading-start side in RTL.

const timelineClass =
  'relative space-y-5 before:absolute before:inset-y-3 before:start-4.5 before:w-px before:bg-border'

function TimelineEntry({
  icon: Icon,
  title,
  subtitle,
  place,
  date,
  badge,
  current = false,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  place: string
  date: string
  badge?: string
  current?: boolean
  description: string
  children?: ReactNode
}) {
  return (
    <li className="relative ps-12 md:ps-14">
      <span
        aria-hidden="true"
        className={cn(
          'absolute start-0 top-5 flex size-9 items-center justify-center rounded-full border md:top-6',
          current ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-primary-text',
        )}
      >
        <Icon size={16} />
      </span>
      <article className={cn(cardClass, 'p-5 md:p-6', current && 'border-primary/40')}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h3 className="text-lg font-bold tracking-tight text-foreground md:text-xl rtl:tracking-normal">{title}</h3>
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-green-500" />
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 font-medium text-primary-text">{subtitle}</p>}
        {(place || date) && (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {place && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" size={14} />
                {place}
              </span>
            )}
            {date && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Calendar aria-hidden="true" size={14} />
                {date}
              </span>
            )}
          </p>
        )}
        {description && <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{description}</p>}
        {children}
      </article>
    </li>
  )
}

export function AboutExperience({
  title,
  number,
  currentLabel,
  technologiesLabel,
  items,
}: {
  title: string
  number?: string
  currentLabel: string
  technologiesLabel: string
  items: AboutExperienceItem[]
}) {
  if (items.length === 0) return null
  return (
    <ProfileSection id="experience" number={number} title={title}>
      <ol className={timelineClass}>
        {items.map((item) => (
          <TimelineEntry
            key={item.id}
            icon={Briefcase}
            title={item.role}
            subtitle={item.company}
            place={item.place}
            date={item.date}
            badge={item.isCurrent ? currentLabel : undefined}
            current={item.isCurrent}
            description={item.description}
          >
            {item.technologies.length > 0 && (
              <ul aria-label={technologiesLabel} className="mt-4 flex flex-wrap gap-1.5">
                {item.technologies.map((tech) => (
                  <li key={tech} className={chipClass}>
                    {/* Decorative: some tech icons carry an SVG <title> that would repeat the label. */}
                    <span aria-hidden="true" className="inline-flex">
                      <SkillIcon name={tech} className="text-primary-text" size={14} />
                    </span>
                    {tech}
                  </li>
                ))}
              </ul>
            )}
          </TimelineEntry>
        ))}
      </ol>
    </ProfileSection>
  )
}

export function AboutEducation({ title, number, items }: { title: string; number?: string; items: AboutEducationItem[] }) {
  if (items.length === 0) return null
  return (
    <ProfileSection id="education" number={number} title={title}>
      <ol className={timelineClass}>
        {items.map((item) => (
          <TimelineEntry
            key={item.id}
            icon={GraduationCap}
            title={item.degree || item.institution}
            subtitle={item.degree ? item.institution : ''}
            place={item.place}
            date={item.date}
            description={item.description}
          />
        ))}
      </ol>
    </ProfileSection>
  )
}
