import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Award, Briefcase, FileText, FolderKanban, GraduationCap, Inbox, Languages, Layers3, MessageCircleQuestion, MessageSquareQuote, Palette, Share2, Sparkles, Target, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared admin UI kit. Single source of truth for the chrome that used to be
 * re-implemented per page: section cards, stat cards, status badges, empty
 * states, and data-table classes. Everything here is server-component safe
 * (no hooks, no client boundary) and theme-aware (works in light and dark).
 */

/* -------------------------------------------------------------------------- */
/* Section card                                                               */
/* -------------------------------------------------------------------------- */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  id,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('admin-section rounded-xl border border-border bg-card shadow-sm', className)}>
      {(title || action) && (
        <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Stat card                                                                  */
/* -------------------------------------------------------------------------- */

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon?: LucideIcon
  label: string
  value: ReactNode
  hint?: ReactNode
  href?: string
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  )

  const base =
    'admin-stat block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors'

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          'group hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        {inner}
      </Link>
    )
  }

  return <div className={base}>{inner}</div>
}

/* -------------------------------------------------------------------------- */
/* Status badge                                                               */
/* -------------------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'sky' | 'violet'

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-primary/15 text-primary',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  danger: 'bg-destructive/15 text-destructive',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
}

// Maps every status used across the admin (messages, leads, projects, CMS
// content) to a tone that reads correctly in both themes.
const statusTone: Record<string, BadgeTone> = {
  // content / visibility
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
  // inbox
  new: 'info',
  read: 'neutral',
  replied: 'success',
  spam: 'danger',
  // reviews moderation
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  // leads pipeline
  qualified: 'sky',
  meeting: 'violet',
  proposal: 'warning',
  won: 'success',
  lost: 'neutral',
}

export function badgeToneForStatus(status: string): BadgeTone {
  return statusTone[status] ?? 'neutral'
}

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        toneClass[tone ?? badgeToneForStatus(status)],
        className,
      )}
    >
      {status}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'admin-empty flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground text-balance">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Data table shell                                                           */
/* -------------------------------------------------------------------------- */

export const table = {
  shell: 'admin-table-shell overflow-x-auto rounded-xl border border-border',
  table: 'w-full text-left text-sm',
  thead: 'border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground',
  th: 'px-4 py-3 font-medium',
  tbody: 'divide-y divide-border',
  tr: 'transition-colors hover:bg-muted/30',
  td: 'px-4 py-3',
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  const designs: Record<string, { icon: LucideIcon; eyebrow: string }> = {
    Projects: { icon: FolderKanban, eyebrow: 'The work that defines you' },
    Blog: { icon: FileText, eyebrow: 'Your ideas, in your words' },
    Inbox: { icon: Inbox, eyebrow: 'Every conversation starts here' },
    'Freelance leads': { icon: Target, eyebrow: 'Turn conversations into opportunities' },
    Reviews: { icon: MessageSquareQuote, eyebrow: 'A little perspective from your audience' },
    Skills: { icon: Sparkles, eyebrow: 'The tools behind your craft' },
    Languages: { icon: Languages, eyebrow: 'Connect across cultures' },
    Education: { icon: GraduationCap, eyebrow: 'The foundations of your journey' },
    Experience: { icon: Briefcase, eyebrow: 'Your professional story' },
    Certifications: { icon: Award, eyebrow: 'Milestones worth sharing' },
    FAQ: { icon: MessageCircleQuestion, eyebrow: 'Good questions. Clear answers.' },
    'Social & contact links': { icon: Share2, eyebrow: 'Your presence, connected' },
    'About': { icon: UserRound, eyebrow: 'Introduce the person behind the work' },
    'About & profile': { icon: UserRound, eyebrow: 'Introduce the person behind the work' },
    'Theme & design': { icon: Palette, eyebrow: 'Make every detail yours' },
  }
  const editor = /^(New|Edit) (project|article)$/.test(title)
  const back = title.includes('project') ? '/admin/projects' : '/admin/blog'
  const { icon: Icon, eyebrow } = designs[title] ?? { icon: Layers3, eyebrow: editor ? 'From the first draft to the final detail' : 'Your portfolio workspace' }
  return (
    <header className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {editor && <Link href={back} className="admin-editor-back"><ArrowLeft size={13} aria-hidden="true" /> Back to {title.includes('project') ? 'projects' : 'articles'}</Link>}
        <p className="admin-eyebrow">{eyebrow}</p>
        <div className="admin-page-title"><span><Icon size={23} aria-hidden="true" /></span><h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1></div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* Status filter tabs (shared by inbox + leads)                               */
/* -------------------------------------------------------------------------- */

export function FilterTabs({
  tabs,
  ariaLabel = 'Filter',
}: {
  tabs: { key: string; label: string; count: number; href: string; active: boolean }[]
  ariaLabel?: string
}) {
  return (
    <nav aria-label={ariaLabel} className="admin-filter-tabs flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
            tab.active
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
          )}
        >
          {tab.label}
          <span
            className={cn(
              'rounded-full px-1.5 text-xs tabular-nums',
              tab.active ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {tab.count}
          </span>
        </Link>
      ))}
    </nav>
  )
}
