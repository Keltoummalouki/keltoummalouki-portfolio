import type { ReactNode } from 'react'
import { VoxelGlyph } from '@/components/three/voxel-icon/glyphs'
import { cn } from '@/lib/utils'
import { CHAPTER_ICONS, type AboutChapterId } from './chapters'

// Shared building blocks for the /about page. Server components only: every
// fact on the profile page must be in the initial HTML (no animation gating
// visibility), so search engines and AI crawlers read exactly what people see.

/** Anchor targets clear the fixed header, and on phones the sticky chapter bar under it. */
export const anchorOffset = 'scroll-mt-40 lg:scroll-mt-28'

export const ctaBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export const ctaPrimary = cn(ctaBase, 'bg-primary text-primary-foreground hover:bg-primary/90')

export const ctaSecondary = cn(
  ctaBase,
  'border border-border bg-card text-foreground hover:border-primary hover:text-primary-text',
)

export const cardClass = 'rounded-2xl border border-border bg-card'

export const chipClass =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[0.8125rem] font-medium text-foreground'

/** A quiet tile holding an icon in the accent. */
export const iconTileClass = 'inline-flex shrink-0 items-center justify-center rounded-xl bg-secondary text-primary-text'

export default function ProfileSection({
  id,
  number,
  title,
  lead,
  children,
  className,
}: {
  id: AboutChapterId
  /** The chapter's number in the chapter list (`03`). */
  number?: string
  title: string
  lead?: string
  children: ReactNode
  className?: string
}) {
  const headingId = `${id}-title`
  return (
    <section id={id} aria-labelledby={headingId} className={cn(anchorOffset, className)}>
      {/* Decorative: the chapter's icon and number, as in the chapter list and the 3D companion. */}
      <div aria-hidden="true" className="flex items-center gap-3">
        <span className={cn(iconTileClass, 'size-9 ring-1 ring-border')}>
          <VoxelGlyph name={CHAPTER_ICONS[id]} className="size-4.5" />
        </span>
        {number && <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">{number}</span>}
        <span className="h-px flex-1 bg-border" />
      </div>
      <h2
        id={headingId}
        className="mt-5 text-[1.75rem] font-bold leading-tight tracking-tight text-foreground text-balance md:text-[2.125rem] rtl:tracking-normal"
      >
        {title}
      </h2>
      {lead && <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground text-pretty">{lead}</p>}
      <div className="mt-7 md:mt-8">{children}</div>
    </section>
  )
}
