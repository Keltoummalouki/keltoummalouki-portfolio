import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Archive, ArrowLeft, Award, BadgeEuro, Ban, Briefcase, CalendarClock, CheckCheck, CircleCheck, CircleDot, Clock3, FileText, FolderKanban, GraduationCap, Handshake,
  Inbox, Languages, Layers3, MessageCircleQuestion, MessageSquareQuote, OctagonAlert, Palette, PenLine, Pencil, Reply, Send, Share2, Sparkles, Target, Trash2, Trophy,
  UserRound, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import HeaderArt from './HeaderArt'
import PageMotion from './PageMotion'

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

const statusIcon: Record<string, LucideIcon> = {
  published: CircleCheck,
  draft: PenLine,
  archived: Archive,
  new: CircleDot,
  read: CheckCheck,
  replied: Reply,
  spam: OctagonAlert,
  pending: Clock3,
  approved: CircleCheck,
  rejected: Ban,
  qualified: Handshake,
  meeting: CalendarClock,
  proposal: Send,
  won: Trophy,
  lost: XCircle,
}

// Shown as a bare icon, the way messaging apps do: blue double ticks for a
// read message (WhatsApp-style) and a warning octagon for spam. The label
// stays available to screen readers and as a tooltip.
const iconOnly: Record<string, string> = {
  read: 'text-sky-600 dark:text-sky-400',
  spam: 'text-destructive',
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
  const Icon = statusIcon[status]
  if (Icon && iconOnly[status]) {
    return (
      <span title={status.charAt(0).toUpperCase() + status.slice(1)} className={cn('admin-status-icon inline-flex size-7 shrink-0 items-center justify-center rounded-full', iconOnly[status], className)}>
        <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden="true" />
        <span className="sr-only">{status}</span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        toneClass[tone ?? badgeToneForStatus(status)],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {status}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Row actions: icon-only edit and delete                                     */
/* -------------------------------------------------------------------------- */

const iconAction = 'admin-icon-action inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors'

/** Pencil link to an edit screen. `label` names the item for screen readers. */
export function EditLink({ href, label = 'Edit' }: { href: string; label?: string }) {
  return (
    <Link href={href} className={cn(iconAction, 'text-foreground')} aria-label={label} title="Edit">
      <Pencil className="size-4" aria-hidden="true" />
    </Link>
  )
}

/** Trash submit button for a delete form (the form keeps its own confirmation, if any). */
export function DeleteButton({ label = 'Delete' }: { label?: string }) {
  return (
    <button type="submit" className={cn(iconAction, 'admin-icon-danger text-destructive')} aria-label={label} title="Delete">
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
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
  // Each section gets its own icon, line and accent colour.
  const designs: Record<string, { icon: LucideIcon; eyebrow: string; color: string }> = {
    Projects: { icon: FolderKanban, eyebrow: 'The work that defines you', color: '#3b82f6' },
    Blog: { icon: FileText, eyebrow: 'Your ideas, in your words', color: '#8b5cf6' },
    Inbox: { icon: Inbox, eyebrow: 'Every conversation starts here', color: '#14b8a6' },
    'Freelance leads': { icon: Target, eyebrow: 'Turn conversations into opportunities', color: '#f59e0b' },
    Reviews: { icon: MessageSquareQuote, eyebrow: 'A little perspective from your audience', color: '#ec4899' },
    Skills: { icon: Sparkles, eyebrow: 'The tools behind your craft', color: '#6366f1' },
    Languages: { icon: Languages, eyebrow: 'Connect across cultures', color: '#06b6d4' },
    Education: { icon: GraduationCap, eyebrow: 'The foundations of your journey', color: '#22c55e' },
    Experience: { icon: Briefcase, eyebrow: 'Your professional story', color: '#0ea5e9' },
    Certifications: { icon: Award, eyebrow: 'Milestones worth sharing', color: '#eab308' },
    FAQ: { icon: MessageCircleQuestion, eyebrow: 'Good questions. Clear answers.', color: '#a855f7' },
    'Services & pricing': { icon: BadgeEuro, eyebrow: 'What you offer, clearly priced', color: '#10b981' },
    'Social & contact links': { icon: Share2, eyebrow: 'Your presence, connected', color: '#3b82f6' },
    About: { icon: UserRound, eyebrow: 'Introduce the person behind the work', color: '#7c3aed' },
    'About & profile': { icon: UserRound, eyebrow: 'Introduce the person behind the work', color: '#7c3aed' },
    'Theme & design': { icon: Palette, eyebrow: 'Make every detail yours', color: '#ec4899' },
  }
  const editor = /^(New|Edit) (project|article)$/.test(title)
  const isProject = title.includes('project')
  const back = isProject ? '/admin/projects' : '/admin/blog'
  const editorDesign = { icon: isProject ? FolderKanban : FileText, eyebrow: 'From the first draft to the final detail', color: isProject ? '#3b82f6' : '#8b5cf6' }
  const { icon: Icon, eyebrow, color } = designs[title] ?? (editor ? editorDesign : { icon: Layers3, eyebrow: 'Your portfolio workspace', color: '#3b82f6' })
  return (
    <header className="admin-page-header" style={{ '--header-accent': color } as React.CSSProperties}>
      <PageMotion />
      <div className="admin-page-header-text">
        {editor && <Link href={back} className="admin-editor-back"><ArrowLeft size={13} aria-hidden="true" /> Back to {isProject ? 'projects' : 'articles'}</Link>}
        <p className="admin-eyebrow">{eyebrow}</p>
        <div className="admin-page-title"><span><Icon size={22} aria-hidden="true" /></span><h1>{title}</h1></div>
        {description && <p className="admin-page-description">{description}</p>}
        {action && <div className="admin-page-action">{action}</div>}
      </div>
      <HeaderArt>
        <Icon aria-hidden="true" />
      </HeaderArt>
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
