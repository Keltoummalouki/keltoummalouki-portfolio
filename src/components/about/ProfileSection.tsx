import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Shared building blocks for the /about page. Server components only: every
// fact on the profile page must be in the initial HTML (no animation gating
// visibility), so search engines and AI crawlers read exactly what people see.

export const ctaBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export const ctaPrimary = cn(ctaBase, 'bg-primary text-primary-foreground hover:bg-primary/90')

export const ctaSecondary = cn(
  ctaBase,
  'border border-border bg-card text-foreground hover:border-primary hover:text-primary',
)

export const cardClass = 'rounded-2xl border border-border bg-card/80 backdrop-blur-xl'

export const chipClass =
  'inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-1.5 text-sm font-medium text-foreground'

export default function ProfileSection({
  id,
  title,
  lead,
  children,
  className,
}: {
  id: string
  title: string
  lead?: string
  children: ReactNode
  className?: string
}) {
  const headingId = `${id}-title`
  return (
    <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-24', className)}>
      <h2 id={headingId} className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
        {title}
      </h2>
      <div
        aria-hidden="true"
        className="mt-3 h-1 w-12 rounded-full bg-primary"
      />
      {lead && <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  )
}
