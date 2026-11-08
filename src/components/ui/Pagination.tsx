'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'animejs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { pageTokens } from '@/lib/pagination'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { cn } from '@/lib/utils'

// One pagination control for every list on the site.
// - Link mode (`basePath`): crawlable `?page=N` links for server-paginated pages.
// - Button mode (`onPageChange`): client-side lists (home projects, reviews).
// The active page gets a small anime.js "pop" when it changes.

type PaginationProps = {
  page: number
  totalPages: number
  className?: string
  /** Accessible name of the <nav>, e.g. "Projects pages". Defaults to "Pagination". */
  label?: string
  /** id of the list this control drives (button mode, for aria-controls). */
  controls?: string
} & (
  | { basePath: string; onPageChange?: never }
  | { onPageChange: (page: number) => void; basePath?: never }
)

const itemBase =
  'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const itemIdle = 'border-border bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground'
const itemActive = 'border-primary bg-primary text-primary-foreground'
const itemDisabled = 'pointer-events-none border-border bg-card/40 text-muted-foreground/50'

export default function Pagination(props: PaginationProps) {
  const { page, totalPages, className, label, controls } = props
  const t = useTranslations('pagination')
  const navRef = useRef<HTMLElement>(null)
  const previousPage = useRef(page)

  useEffect(() => {
    if (previousPage.current === page) return
    previousPage.current = page
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active || prefersReducedMotion()) return
    const animation = animate(active, {
      scale: [0.82, 1],
      duration: 420,
      ease: 'outBack(2)',
    })
    return () => {
      animation.revert()
    }
  }, [page])

  if (totalPages <= 1) return null

  const tokens = pageTokens(page, totalPages)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const renderTarget = (target: number, content: React.ReactNode, opts: { rel?: string; aria?: string; current?: boolean }) => {
    const classes = cn(itemBase, opts.current ? itemActive : itemIdle)
    if ('basePath' in props && props.basePath !== undefined) {
      return (
        <Link
          // Page 1 is the bare path (canonical); others carry ?page=N.
          href={target > 1 ? { pathname: props.basePath, query: { page: String(target) } } : props.basePath}
          rel={opts.rel}
          aria-label={opts.aria}
          aria-current={opts.current ? 'page' : undefined}
          className={classes}
        >
          {content}
        </Link>
      )
    }
    return (
      <button
        type="button"
        onClick={() => props.onPageChange?.(target)}
        aria-label={opts.aria}
        aria-current={opts.current ? 'page' : undefined}
        aria-controls={controls}
        className={classes}
      >
        {content}
      </button>
    )
  }

  const disabled = (content: React.ReactNode) => (
    <span aria-disabled="true" className={cn(itemBase, itemDisabled)}>
      {content}
    </span>
  )

  const prevContent = (
    <>
      <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
      <span className="hidden sm:inline">{t('previous')}</span>
    </>
  )
  const nextContent = (
    <>
      <span className="hidden sm:inline">{t('next')}</span>
      <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />
    </>
  )

  return (
    <nav ref={navRef} aria-label={label ?? t('label')} className={cn('flex flex-col items-center gap-3', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {hasPrev
            ? renderTarget(page - 1, prevContent, { rel: 'prev', aria: t('previousAria') })
            : disabled(prevContent)}
        </li>
        {tokens.map((token) =>
          typeof token === 'number' ? (
            <li key={token}>
              {renderTarget(token, token, {
                aria: token === page ? t('currentAria', { page: token }) : t('pageAria', { page: token }),
                current: token === page,
              })}
            </li>
          ) : (
            <li key={token} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ),
        )}
        <li>
          {hasNext
            ? renderTarget(page + 1, nextContent, { rel: 'next', aria: t('nextAria') })
            : disabled(nextContent)}
        </li>
      </ul>
      {/* Announces page changes in button mode; visible as a compact status line. */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {t('status', { page, total: totalPages })}
      </p>
    </nav>
  )
}
