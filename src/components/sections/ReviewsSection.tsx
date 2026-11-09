'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import ShowcaseSection from '@/components/sections/showcase/ShowcaseSection'
import ReviewForm from '@/components/reviews/ReviewForm'
import StarRating from '@/components/reviews/StarRating'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { reviewerInitials, type PublicReview } from '@/features/reviews'
import type { ReviewPage, ReviewSort } from '@/features/reviews/browse'
import { scrollToElement } from '@/lib/motion/smooth-scroll'
import { cn } from '@/lib/utils'

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition-colors duration-150 hover:bg-secondary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-40 disabled:pointer-events-none'
const browseField = 'grid grid-cols-1 gap-1.5 text-xs text-muted-foreground'

function BrowseSelect({ label, value, options, onChange, disabled, className }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  const dir = useLocale() === 'ar' ? 'rtl' : 'ltr'
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <Select dir={dir} value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id={id} className={cn('h-11 gap-2 border-border bg-background text-foreground shadow-none focus-visible:ring-2 focus-visible:ring-primary', className)}>
          {/* Radix only fills the value in after hydration: without children it would be blank in the cached HTML. */}
          <SelectValue>{options.find(option => option.value === value)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent data-lenis-prevent>
          {options.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  )
}

function ReviewCard({ review }: { review: PublicReview }) {
  const t = useTranslations('reviews')
  const format = useFormatter()
  const [expanded, setExpanded] = useState(false)
  const long = review.comment.length > 240
  return (
    <article className="flex min-w-0 flex-col border-b border-border py-6 sm:px-6" aria-label={review.name}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-xs font-semibold">{reviewerInitials(review.name)}</span>
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="break-words text-sm font-semibold text-foreground">{review.name}</h3>
          <time dateTime={review.date} className="mt-1 block text-xs text-muted-foreground">{format.dateTime(new Date(review.date), { year: 'numeric', month: 'long' })}</time>
        </div>
      </div>
      <StarRating value={review.rating} size={13} className="mt-5" label={t('starsAria', { rating: review.rating })} />
      <p dir="auto" className="mt-3 whitespace-pre-line break-words text-[15px] leading-7 text-foreground/90 [overflow-wrap:anywhere]">{long && !expanded ? `${review.comment.slice(0, 240).trimEnd()}…` : review.comment}</p>
      {long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="mt-2 min-h-11 self-start text-sm font-medium underline underline-offset-4 focus-visible:outline-2">{t(expanded ? 'browse.readLess' : 'browse.readMore')}</button>}
    </article>
  )
}

export default function ReviewsSection({ reviews: initial, index }: { reviews: ReviewPage; index: string }) {
  const t = useTranslations('reviews')
  const format = useFormatter()
  const uid = useId()
  const formPanelId = `${uid}-form`
  const formPanelRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const interacted = useRef(false)
  const [data, setData] = useState(initial)
  const [filters, setFilters] = useState<{page: number; rating: number; sort: ReviewSort}>({ page: 1, rating: 0, sort: 'newest' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formMounted, setFormMounted] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    async function refresh() {
      try {
        const params = new URLSearchParams({ page: String(filters.page), rating: String(filters.rating), sort: filters.sort })
        const response = await fetch(`/api/reviews?${params}`, { cache: 'no-store', signal: controller.signal })
        // Read the body before checking the status: Chromium never completes a
        // request whose body is left unread, so an unread 503 stays pending
        // (holding its connection, and keeping the e2e tests' networkidle away).
        const body: unknown = await response.json()
        if (!response.ok) throw new Error('Review request failed')
        const next = body as ReviewPage
        if (controller.signal.aborted) return
        setData(next)
        if (interacted.current) resultsRef.current?.focus({ preventScroll: true })
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void refresh()
    return () => controller.abort()
  }, [filters, retry])

  useEffect(() => {
    const panel = formPanelRef.current
    if (!formOpen || !panel) return
    panel.focus({ preventScroll: true })
    scrollToElement(panel, 112)
  }, [formOpen])

  function change(next: Partial<typeof filters>) {
    interacted.current = true
    setFilters((previous) => ({ ...previous, page: 1, ...next }))
  }
  const summary = data.summary
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const start = data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const end = Math.min(data.page * data.pageSize, data.total)

  return (
    <ShowcaseSection id="reviews" index={index} eyebrow={t('eyebrow')} title={t('title')} description={t('subtitle')}
      aside={summary.count > 0 && <div className="space-y-5">
        <div className="flex items-end gap-3">
          <p className="text-6xl font-semibold leading-none tracking-[-0.05em] tabular-nums">{format.number(summary.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
          <div className="space-y-2 pb-1"><StarRating value={summary.average} size={14} label={t('average', {average: summary.average})} /><p className="text-xs text-muted-foreground">{t('count', {count: summary.count})}</p></div>
        </div>
        <div className="max-w-xs space-y-1" aria-label={t('browse.distribution')}>
          {([5,4,3,2,1] as const).map(star => <button type="button" key={star} aria-pressed={filters.rating === star} aria-label={t('browse.filterStars', {rating: star, count: summary.distribution[star]})} onClick={() => change({rating: filters.rating === star ? 0 : star})} className="group flex min-h-9 w-full items-center gap-3 rounded px-1 text-xs focus-visible:outline-2 focus-visible:outline-primary">
            <span className="w-3 font-mono tabular-nums">{star}</span><span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-secondary"><span className="block h-full bg-foreground/60 group-hover:bg-foreground" style={{width: `${summary.distribution[star] / summary.count * 100}%`}} /></span><span className="w-8 text-end font-mono tabular-nums text-muted-foreground">{summary.distribution[star]}</span>
          </button>)}
        </div>
      </div>}
      actions={<button type="button" aria-expanded={formOpen} aria-controls={formPanelId} onClick={() => {setFormMounted(true);setFormOpen(!formOpen)}} className={`${button} bg-foreground text-background hover:bg-foreground/90`}>{t('form.title')}</button>}
    >
      <div className="border-t border-border">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border py-4">
          <p className="pb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">{t('browse.heading')}</p>
          <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto">
            <div className={browseField}><BrowseSelect label={t('browse.rating')} className="sm:w-44" value={String(filters.rating)} onChange={value => change({rating: Number(value)})} options={[{value: '0', label: t('browse.allRatings')}, ...[5,4,3,2,1].map(star => ({value: String(star), label: t('browse.stars', {rating: star})}))]} /></div>
            <div className={browseField}><BrowseSelect label={t('browse.sort')} className="sm:w-52" value={filters.sort} onChange={value => change({sort: value as ReviewSort})} options={(['newest','highest','lowest'] as const).map(sort => ({value: sort, label: t(`browse.${sort}`)}))} /></div>
          </div>
        </div>
        <div role="status" aria-live="polite" className="py-3 text-xs text-muted-foreground">{loading ? t('browse.loading') : error ? t('browse.error') : t('browse.range', {start,end,total:data.total})}</div>
        {error && <button type="button" className={button} onClick={() => setRetry(value => value + 1)}>{t('browse.retry')}</button>}
        <div ref={resultsRef} tabIndex={-1} aria-label={t('browse.heading')} aria-busy={loading} className="scroll-mt-28 outline-none">
          {!error && <div className={`grid sm:grid-cols-2 ${loading ? 'opacity-50' : ''}`}>{data.reviews.map(review => <ReviewCard key={review.id} review={review} />)}</div>}
          {!loading && !error && !data.reviews.length && <div className="py-14 text-center"><h3 className="font-semibold">{t(filters.rating ? 'browse.noMatches' : 'emptyTitle')}</h3><p className="mt-2 text-sm text-muted-foreground">{t(filters.rating ? 'browse.tryAll' : 'emptyText')}</p>{filters.rating > 0 && <button className={`${button} mt-4`} onClick={() => change({rating:0})}>{t('browse.allRatings')}</button>}</div>}
        </div>
        {pages > 1 && <nav aria-label={t('browse.pagination')} className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={button} disabled={loading || data.page <= 1} onClick={() => {change({page:data.page-1});scrollToElement(resultsRef.current!, 160)}}>{t('browse.previous')}</button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BrowseSelect label={t('browse.page')} className="w-20" value={String(data.page)} disabled={loading} onChange={value => {change({page:Number(value)});scrollToElement(resultsRef.current!,160)}} options={Array.from({length:pages},(_,i)=>({value: String(i+1), label: format.number(i+1)}))} /><span>{t('browse.of', {pages})}</span></div>
          <button type="button" className={button} disabled={loading || data.page >= pages} onClick={() => {change({page:data.page+1});scrollToElement(resultsRef.current!,160)}}>{t('browse.next')}</button>
        </nav>}
      </div>
      <div ref={formPanelRef} id={formPanelId} role="region" aria-labelledby={`${formPanelId}-title`} tabIndex={-1} hidden={!formOpen} className="mt-8 scroll-mt-28 rounded-lg border border-border bg-card p-6 outline-none sm:p-8">
        <h3 id={`${formPanelId}-title`} className="text-lg font-semibold">{t('form.title')}</h3><p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">{t('form.intro')}</p>{formMounted && <ReviewForm />}
      </div>
    </ShowcaseSection>
  )
}
