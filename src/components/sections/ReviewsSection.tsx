'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { animate } from 'animejs'
import { ChevronDown, ChevronLeft, ChevronRight, MessageSquareQuote, Quote } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import ShowcaseSection from '@/components/sections/showcase/ShowcaseSection'
import { iconButton, pillOutline, surface } from '@/components/sections/showcase/classes'
import ReviewForm from '@/components/reviews/ReviewForm'
import StarRating from '@/components/reviews/StarRating'
import { reviewerInitials, summarizeReviews, type PublicReview } from '@/features/reviews'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { scrollToElement } from '@/lib/motion/smooth-scroll'
import { cn } from '@/lib/utils'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Testimonials: one approved review at a time with prev/next controls, the
 * rating summary under the section lead, and the moderated review form behind
 * a disclosure button (kept mounted once opened so typed text survives).
 */
export default function ReviewsSection({ reviews: initialReviews, index }: { reviews: PublicReview[]; index: string }) {
  const t = useTranslations('reviews')
  const format = useFormatter()
  const uid = useId()
  const formPanelId = `${uid}-form`
  const sectionRef = useRef<HTMLElement>(null)
  const quoteRef = useRef<HTMLElement>(null)
  const formPanelRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formMounted, setFormMounted] = useState(false)
  const lastStep = useRef<1 | -1 | 0>(0)
  const [reviews, setReviews] = useState(initialReviews)

  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch('/api/reviews', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const data: { reviews: PublicReview[] } = await response.json()
        if (controller.signal.aborted) return
        setReviews(data.reviews)
        setCurrent((value) => Math.max(0, Math.min(value, data.reviews.length - 1)))
      } catch {
        // Keep server-rendered reviews when the network is unavailable.
      }
    }
    void refresh()
    return () => controller.abort()
  }, [])

  const summary = useMemo(() => summarizeReviews(reviews), [reviews])
  const review = reviews[current]

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-reviews-reveal]',
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 80%', once: true },
        },
      )
    }, section)
    return () => ctx.revert()
  }, [])

  // New review: slide in from the side it came from (anime.js), skipped on first render.
  useEffect(() => {
    const step = lastStep.current
    const quote = quoteRef.current
    if (!step || !quote || prefersReducedMotion()) return
    const rtl = getComputedStyle(quote).direction === 'rtl'
    const animation = animate(quote, {
      opacity: [0, 1],
      x: [16 * step * (rtl ? -1 : 1), 0],
      duration: 420,
      ease: 'outQuart',
    })
    return () => {
      animation.revert()
    }
  }, [current])

  // Opening the form moves focus to it: it may sit in the other column (or below the fold).
  useEffect(() => {
    const panel = formPanelRef.current
    if (!formOpen || !panel) return
    panel.focus({ preventScroll: true })
    const { top, bottom } = panel.getBoundingClientRect()
    if (top < 80 || bottom > window.innerHeight) scrollToElement(panel, 112)
  }, [formOpen])

  const go = (step: 1 | -1) => {
    lastStep.current = step
    setCurrent((value) => Math.min(reviews.length - 1, Math.max(0, value + step)))
  }

  const toggleForm = () => {
    setFormMounted(true)
    setFormOpen((open) => !open)
  }

  const position = (value: number) => String(value).padStart(2, '0')

  return (
    <ShowcaseSection
      ref={sectionRef}
      id="reviews"
      index={index}
      eyebrow={t('eyebrow')}
      title={t('title')}
      description={t('subtitle')}
      aside={
        summary.count > 0 && (
          <div className="flex items-center gap-3">
            <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {format.number(summary.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </p>
            <div className="space-y-1">
              <StarRating
                value={summary.average}
                size={14}
                label={t('starsAria', { rating: format.number(summary.average, { maximumFractionDigits: 1 }) })}
              />
              <p className="text-xs text-muted-foreground">{t('count', { count: summary.count })}</p>
            </div>
          </div>
        )
      }
      actions={
        <button
          type="button"
          aria-expanded={formOpen}
          aria-controls={formPanelId}
          onClick={toggleForm}
          className={cn(pillOutline, 'whitespace-nowrap px-4')}
        >
          {t('form.title')}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 text-primary-text transition-transform duration-200 ease-fluid', formOpen && 'rotate-180')}
          />
        </button>
      }
    >
      {/* A full-width row: the quote and the form keep a readable measure. */}
      <div data-reviews-reveal className="max-w-3xl">
        {review ? (
          <div className={cn(surface, 'relative p-6 sm:p-7')}>
            <Quote aria-hidden="true" className="size-9 fill-primary/20 text-primary-text" strokeWidth={1.25} />
            <figure ref={quoteRef} className="mt-4">
              <blockquote>
                <p dir="auto" className="text-base leading-relaxed text-foreground/90 text-pretty md:text-[1.0625rem]">
                  {review.comment}
                </p>
              </blockquote>
              <figcaption className="mt-6 flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-white ring-2 ring-background"
                >
                  {reviewerInitials(review.name)}
                </span>
                <div className="min-w-0">
                  <p dir="auto" className="break-words font-semibold text-foreground">{review.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StarRating value={review.rating} size={12} label={t('starsAria', { rating: review.rating })} />
                    <time dateTime={review.date} className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(review.date), { year: 'numeric', month: 'long' })}
                    </time>
                  </div>
                </div>
              </figcaption>
            </figure>

            {reviews.length > 1 && (
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
                <p aria-live="polite" className="me-1 text-xs font-medium tabular-nums text-muted-foreground">
                  <span className="sr-only">{t('position', { current: current + 1, total: reviews.length })}</span>
                  <span aria-hidden="true" dir="ltr">
                    {position(current + 1)} / {position(reviews.length)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={current === 0}
                  aria-label={t('previous')}
                  className={iconButton}
                >
                  <ChevronLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={current === reviews.length - 1}
                  aria-label={t('next')}
                  className={iconButton}
                >
                  <ChevronRight aria-hidden="true" className="size-5 rtl:rotate-180" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={cn(surface, 'flex min-h-56 flex-col items-center justify-center p-8 text-center')}>
            <span className="mb-4 rounded-2xl bg-secondary p-4 text-primary-text">
              <MessageSquareQuote aria-hidden="true" className="size-8" />
            </span>
            <p className="text-lg font-semibold text-foreground">{t('emptyTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('emptyText')}</p>
          </div>
        )}
      </div>

      <div
        ref={formPanelRef}
        id={formPanelId}
        role="region"
        aria-labelledby={`${formPanelId}-title`}
        tabIndex={-1}
        hidden={!formOpen}
        className={cn(surface, 'mt-4 max-w-3xl scroll-mt-28 p-6 outline-none sm:p-7')}
      >
        <h3 id={`${formPanelId}-title`} className="text-lg font-bold text-foreground">
          {t('form.title')}
        </h3>
        <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">{t('form.intro')}</p>
        {formMounted && <ReviewForm />}
      </div>
    </ShowcaseSection>
  )
}
