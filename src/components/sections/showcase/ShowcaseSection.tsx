'use client'

import type { ReactNode, Ref } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type ShowcaseSectionProps = {
  /** Section anchor (`#education`, nav targets); the heading gets `${id}-title`. */
  id: string
  /** Display number ("04"). Decorative: hidden from assistive tech. */
  index: string
  eyebrow: string
  title: string
  description?: string
  /** Links or buttons under the description. */
  actions?: ReactNode
  /** Extra content under the description (e.g. a rating summary). */
  aside?: ReactNode
  /**
   * `wide`: a full-width row, header beside the content from `lg`.
   * `half`: one column of a two-up row, header beside the content from `xl`.
   */
  layout?: 'wide' | 'half'
  ref?: Ref<HTMLElement>
  className?: string
  children: ReactNode
}

/**
 * Numbered side-label section: "04. EDUCATION" eyebrow, title, short lead and
 * optional actions in a start column, the content in the other. Stacks on
 * small screens. Used for the dense bento block between Experience and Contact.
 */
export default function ShowcaseSection({
  id,
  index,
  eyebrow,
  title,
  description,
  actions,
  aside,
  layout = 'wide',
  ref,
  className,
  children,
}: ShowcaseSectionProps) {
  const titleId = `${id}-title`
  const wide = layout === 'wide'

  return (
    <section id={id} ref={ref} aria-labelledby={titleId} className={cn('relative py-12 md:py-16', className)}>
      <div
        className={cn(
          'grid gap-8',
          wide
            ? 'lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]'
            : 'xl:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] xl:gap-8',
        )}
      >
        <motion.header
          className={cn('flex flex-col items-start', wide ? 'lg:sticky lg:top-28 lg:self-start' : 'xl:sticky xl:top-28 xl:self-start')}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-text rtl:tracking-normal">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            <span aria-hidden="true" dir="ltr" className="tabular-nums">
              {index}.
            </span>
            <span>{eyebrow}</span>
          </p>
          <h2
            id={titleId}
            className={cn(
              'font-bold tracking-tight text-foreground text-balance',
              wide ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl',
            )}
          >
            {title}
          </h2>
          {description && (
            <p className={cn('mt-3 max-w-md leading-relaxed text-muted-foreground text-pretty', !wide && 'text-sm md:text-base')}>
              {description}
            </p>
          )}
          {aside && <div className="mt-5 w-full">{aside}</div>}
          {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
        </motion.header>

        <div className="min-w-0">{children}</div>
      </div>
    </section>
  )
}
