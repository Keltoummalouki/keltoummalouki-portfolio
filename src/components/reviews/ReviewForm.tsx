'use client'

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react'
import { animate } from 'animejs'
import { CheckCircle2, Send } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { submitReviewAction } from '@/features/reviews/actions'
import {
  REVIEW_COMMENT_MAX,
  REVIEW_NAME_MAX,
  reviewFormSchema,
  type ReviewFieldError,
  type ReviewSubmitState,
} from '@/features/reviews/schema'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { cn } from '@/lib/utils'
import StarRatingInput from './StarRatingInput'

const field =
  'w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-[invalid=true]:border-destructive'
const labelClass = 'text-sm font-medium text-foreground'

type FieldName = 'name' | 'rating' | 'comment'

export default function ReviewForm() {
  const t = useTranslations('reviews.form')
  const locale = useLocale()
  const uid = useId()
  const ids = {
    name: `${uid}-name`,
    rating: `${uid}-rating`,
    ratingLabel: `${uid}-rating-label`,
    comment: `${uid}-comment`,
    status: `${uid}-status`,
  }
  const formRef = useRef<HTMLFormElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const [state, formAction, pending] = useActionState<ReviewSubmitState, FormData>(submitReviewAction, {})
  const [clientErrors, setClientErrors] = useState<ReviewSubmitState['errors']>({})
  const [token, setToken] = useState<string | null>(null)
  const [commentLength, setCommentLength] = useState(0)

  // Server errors replace client ones once a response arrives.
  const errors = { ...clientErrors, ...state.errors }
  const errorFor = (name: FieldName) => errors?.[name]
  const errorId = (name: FieldName) => `${uid}-${name}-error`

  const formError =
    state.error === 'captcha'
      ? t('errors.captcha')
      : state.error === 'rate_limited'
        ? t('errors.rateLimited')
        : state.error === 'server'
          ? t('errors.generic')
          : null

  useEffect(() => {
    if (!state.ok || !successRef.current || prefersReducedMotion()) return
    const card = animate(successRef.current, { opacity: [0, 1], y: [16, 0], duration: 500, ease: 'outQuart' })
    const icon = successRef.current.querySelector('[data-success-icon]')
    const pop = icon ? animate(icon, { scale: [0.4, 1.15, 1], duration: 700, ease: 'outBack(2)' }) : null
    return () => {
      card.revert()
      pop?.revert()
    }
  }, [state.ok])

  if (state.ok) {
    return (
      <div
        ref={successRef}
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center"
      >
        <CheckCircle2 data-success-icon aria-hidden="true" className="size-10 text-emerald-500" />
        <p className="text-lg font-semibold text-foreground">{t('successTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('successText')}</p>
      </div>
    )
  }

  // Validate in the browser first (same Zod schema as the server), then submit
  // through the action without React's automatic form reset, so a visitor
  // never loses what they typed. The server re-validates everything.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const parsed = reviewFormSchema.safeParse({
      name: String(data.get('name') ?? ''),
      rating: String(data.get('rating') ?? ''),
      comment: String(data.get('comment') ?? ''),
      locale,
    })
    if (!parsed.success) {
      const next: NonNullable<ReviewSubmitState['errors']> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName
        if (key === 'name' || key === 'rating' || key === 'comment') next[key] ??= issue.message as ReviewFieldError
      }
      setClientErrors(next)
      const first = (['name', 'rating', 'comment'] as const).find((key) => next[key])
      const target = first === 'rating' ? form.querySelector<HTMLElement>('input[name="rating"]') : first ? form.elements.namedItem(first) : null
      if (target instanceof HTMLElement) target.focus()
      return
    }
    setClientErrors({})
    startTransition(() => formAction(data))
  }

  // Editing a field clears its (client-side) error right away.
  const clearFieldError = (event: React.FormEvent<HTMLFormElement>) => {
    const name = (event.target as HTMLInputElement).name
    if (name === 'name' || name === 'rating' || name === 'comment') {
      setClientErrors((current) => (current?.[name] ? { ...current, [name]: undefined } : current))
    }
  }

  const describe = (name: FieldName, extra?: string) =>
    [errorFor(name) ? errorId(name) : null, extra].filter(Boolean).join(' ') || undefined

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      onChange={clearFieldError}
      noValidate
      className="space-y-5"
    >
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-1.5">
        <label htmlFor={ids.name} className={labelClass}>
          {t('name')} <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <input
          id={ids.name}
          name="name"
          autoComplete="name"
          required
          maxLength={REVIEW_NAME_MAX}
          placeholder={t('namePlaceholder')}
          aria-invalid={errorFor('name') ? true : undefined}
          aria-describedby={describe('name')}
          className={field}
        />
        {errorFor('name') && (
          <p id={errorId('name')} className="text-xs text-destructive">{t(`errors.${errorFor('name')}`)}</p>
        )}
      </div>

      <fieldset className="space-y-1.5">
        <legend id={ids.ratingLabel} className={cn(labelClass, 'mb-1.5')}>
          {t('rating')} <span aria-hidden="true" className="text-destructive">*</span>
        </legend>
        <StarRatingInput
          name="rating"
          labelId={ids.ratingLabel}
          describedBy={describe('rating')}
          invalid={Boolean(errorFor('rating'))}
        />
        {errorFor('rating') && (
          <p id={errorId('rating')} className="text-xs text-destructive">{t(`errors.${errorFor('rating')}`)}</p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={ids.comment} className={labelClass}>
            {t('comment')} <span aria-hidden="true" className="text-destructive">*</span>
          </label>
          <span
            className={cn(
              'text-xs tabular-nums text-muted-foreground',
              commentLength > REVIEW_COMMENT_MAX && 'text-destructive',
            )}
          >
            {t('commentCount', { count: commentLength, max: REVIEW_COMMENT_MAX })}
          </span>
        </div>
        <textarea
          id={ids.comment}
          name="comment"
          rows={5}
          required
          maxLength={REVIEW_COMMENT_MAX}
          placeholder={t('commentPlaceholder')}
          onChange={(event) => setCommentLength(event.currentTarget.value.length)}
          aria-invalid={errorFor('comment') ? true : undefined}
          aria-describedby={describe('comment')}
          className={cn(field, 'resize-y')}
        />
        {errorFor('comment') && (
          <p id={errorId('comment')} className="text-xs text-destructive">{t(`errors.${errorFor('comment')}`)}</p>
        )}
      </div>

      <TurnstileWidget onToken={setToken} />
      <input type="hidden" name="turnstileToken" value={token ?? ''} />

      {formError && (
        <p id={ids.status} role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t('privacy')}</p>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Send aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          {pending ? t('sending') : t('submit')}
        </Button>
      </div>
    </form>
  )
}
