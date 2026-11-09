'use client'

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Check,
  Code,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  type LucideIcon,
} from 'lucide-react'
import { pillOutline, pillPrimary } from '@/components/sections/showcase/classes'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { firstName } from '@/features/freelance/brief'
import { submitContactFormAction } from '@/features/inbox/actions'
import {
  CONTACT_DRAFT_KEY,
  CONTACT_FIELDS,
  EMAIL_MAX_LENGTH,
  EMPTY_CONTACT,
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  contactFieldError,
  invalidContactFields,
  parseContactDraft,
  serializeContactDraft,
  type ContactField,
  type ContactFieldError,
  type ContactPhase,
  type ContactValues,
} from '@/features/inbox/contact-form'
import { CONTACT_TOPICS, type ContactFormState, type ContactTopic } from '@/features/inbox/schema'
import { Link } from '@/i18n/navigation'
import { trackClick, trackEvent } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { CONTACT_EMAIL } from './channels'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const TOPIC_ICONS: Record<ContactTopic, LucideIcon> = { job: Briefcase, project: Code, other: MessageCircle }

// Prefixed: plain "name"/"email" ids also exist in other forms of the app.
const FIELD_IDS: Record<ContactField, string> = {
  name: 'contact-name',
  email: 'contact-email',
  message: 'contact-message',
}

/** Message key for each way a field can be refused. */
const ERROR_KEYS: Record<ContactField, Partial<Record<ContactFieldError, string>>> = {
  name: { required: 'nameRequired', tooShort: 'nameMin', tooLong: 'nameMax' },
  email: { required: 'emailRequired', invalid: 'emailInvalid' },
  message: { required: 'messageRequired', tooShort: 'messageMin', tooLong: 'messageMax' },
}

/** What the form tells the section: the answers so far and where the message is. */
export interface ContactReport {
  values: ContactValues
  phase: ContactPhase
}

const fieldClass =
  'w-full rounded-xl border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-200 ease-fluid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-0'
const validRing = 'border-input hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-primary/20'
const invalidRing = 'border-destructive focus-visible:ring-destructive/20'

const chipClass =
  'inline-flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-full border border-border bg-background/60 px-4 text-sm font-medium text-foreground transition-[border-color,background-color,color,scale] duration-200 ease-fluid hover:border-foreground/25 active:scale-[0.97] has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-primary/60 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-card'

/** Crossfade for stacked states: the active one is sharp, the rest blur out. */
function swapClass(active: boolean) {
  return cn(
    'transition-[opacity,translate,scale,filter] duration-200 ease-fluid',
    active ? 'opacity-100' : 'pointer-events-none translate-y-1 scale-90 opacity-0 blur-[2px]',
  )
}

function readDraft(): string | null {
  try {
    return sessionStorage.getItem(CONTACT_DRAFT_KEY)
  } catch {
    // Storage can be blocked; the form still works, it just won't remember.
    return null
  }
}

function writeDraft(draft: string | null) {
  try {
    if (draft) sessionStorage.setItem(CONTACT_DRAFT_KEY, draft)
    else sessionStorage.removeItem(CONTACT_DRAFT_KEY)
  } catch {
    // Same: nothing to keep.
  }
}

function Field({
  field,
  label,
  error,
  aside,
  className,
  children,
}: {
  field: ContactField
  label: string
  error: string | null
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = FIELD_IDS[field]
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          <span aria-hidden="true" className="ms-0.5 text-primary-text">
            *
          </span>
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-sm text-destructive transition-[opacity,translate] duration-200 ease-fluid starting:-translate-y-1 starting:opacity-0"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The home page's contact form. One optional tap (what it is about), three short
 * fields, one button. Native controls inside one <form>, so it also sends without
 * JavaScript; with it, the browser checks the server's rules first, keeps an
 * unsent draft for the visit, and the answers drive the 3D letter beside it.
 */
export default function ContactForm({
  onReport,
  onActivity,
  onRestart,
  onSent,
}: {
  /** Every change, for the 3D letter. */
  onReport: (report: ContactReport) => void
  /** A keystroke, for the letter's nod. */
  onActivity: () => void
  /** Back to an empty form after a message went through. */
  onRestart: () => void
  /** The message went through (the thank-you is showing). */
  onSent?: () => void
}) {
  const t = useTranslations('contact')
  const tCommon = useTranslations('common')
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(submitContactFormAction, {})

  const [values, setValues] = useState<ContactValues>(EMPTY_CONTACT)
  /** Fields whose problem is on show: after a blur with something typed, or a submit. */
  const [flagged, setFlagged] = useState<Partial<Record<ContactField, boolean>>>({})
  const [token, setToken] = useState<string | null>(null)
  const [captchaRound, setCaptchaRound] = useState(0)
  const [captchaMissing, setCaptchaMissing] = useState(false)
  const sentTitleRef = useRef<HTMLHeadingElement>(null)
  const draftRestored = useRef(false)

  const failed = !pending && !!state.error && state.error !== 'invalid'
  const phase: ContactPhase = pending ? 'sending' : state.ok ? 'sent' : failed ? 'failed' : 'editing'

  useEffect(() => {
    onReport({ values, phase })
  }, [values, phase, onReport])

  // Declared before the restore below, so its first run (still empty) can't wipe the draft.
  useEffect(() => {
    if (!draftRestored.current || state.ok) return
    writeDraft(serializeContactDraft(values))
  }, [values, state.ok])

  // An unsent message survives a visit to another page and back (this tab only).
  useEffect(() => {
    const draft = parseContactDraft(readDraft())
    if (draft) setValues(draft)
    draftRestored.current = true
  }, [])

  // Conversion: the message was accepted. The topic only, never what was typed.
  // The form is replaced by the thank-you, so this runs once per message.
  const topic = values.topic || 'none'
  useEffect(() => {
    if (!state.ok) return
    writeDraft(null)
    trackEvent('contact-form-sent', { topic })
    sentTitleRef.current?.focus({ preventScroll: true })
    onSent?.()
  }, [state.ok, topic, onSent])

  // The browser checks the same rules first, so this only runs if they ever disagree.
  const refused = state.errors
  useEffect(() => {
    if (!refused) return
    const fields = CONTACT_FIELDS.filter((field) => refused[field])
    setFlagged(Object.fromEntries(fields.map((field) => [field, true])))
    if (fields[0]) document.getElementById(FIELD_IDS[fields[0]])?.focus()
  }, [refused])

  // A Turnstile token works once, so a refused message needs a new one to retry.
  useEffect(() => {
    if (!failed) return
    setToken(null)
    setCaptchaRound((round) => round + 1)
  }, [failed])

  const onCaptchaToken = useCallback((next: string | null) => {
    setToken(next)
    if (next) setCaptchaMissing(false)
  }, [])

  const onTextChange = (field: ContactField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.target
    setValues((current) => ({ ...current, [field]: value }))
    onActivity()
    if (flagged[field]) setFlagged((current) => ({ ...current, [field]: false }))
  }

  const onFieldBlur = (field: ContactField) => (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Don't flag empty fields while someone is just tabbing through the form.
    if (!event.target.value.trim()) return
    const invalid = contactFieldError(field, { ...values, [field]: event.target.value }) !== null
    setFlagged((current) => ({ ...current, [field]: invalid }))
  }

  // Always handled here, even with the form's `action` set: a submit that goes
  // through `action` makes React reset the form afterwards, which would uncheck the
  // topic and leave it out of a retry after a server error. Dispatching by hand keeps
  // everything in place. `action` stays for visitors without JavaScript.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const invalid = invalidContactFields(values)
    setFlagged(Object.fromEntries(invalid.map((field) => [field, true])))
    if (invalid[0]) {
      document.getElementById(FIELD_IDS[invalid[0]])?.focus()
      return
    }
    if (TURNSTILE_SITE_KEY && !token) {
      setCaptchaMissing(true)
      return
    }
    setCaptchaMissing(false)
    const data = new FormData(event.currentTarget)
    if (token) data.set('turnstileToken', token)
    startTransition(() => formAction(data))
  }

  // Enter on a topic moves on to the name, instead of sending an unfinished form.
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement
    if (event.key === 'Enter' && target.type === 'radio') {
      event.preventDefault()
      document.getElementById(FIELD_IDS.name)?.focus()
    }
  }

  const errorFor = (field: ContactField): string | null => {
    if (!flagged[field]) return null
    const verdict = contactFieldError(field, values)
    const key = verdict ? ERROR_KEYS[field][verdict] : undefined
    return t(`form.errors.${key ?? 'invalid'}`)
  }

  if (state.ok) {
    const name = firstName(values.name)
    const email = values.email.trim()
    return (
      <div className="bezel">
        <div role="status" className="bezel-core flex flex-col items-start p-6 sm:p-8">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
          >
            <Check className="size-6" strokeWidth={2.25} />
          </span>
          <h3
            ref={sentTitleRef}
            tabIndex={-1}
            className="mt-5 text-2xl font-bold tracking-tight text-foreground text-balance outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-3xl"
          >
            {/* Isolated: a Latin name must not reorder an Arabic sentence, or the reverse. */}
            {name ? t('form.sentTitle', { name: `⁨${name}⁩` }) : t('form.sentTitleNoName')}
          </h3>
          <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground text-pretty">
            {email
              ? t.rich('form.sentBody', {
                  address: email,
                  email: (chunks) => (
                    <bdi dir="ltr" className="font-medium text-foreground wrap-anywhere">
                      {chunks}
                    </bdi>
                  ),
                })
              : t('form.sentBodyNoEmail')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/projects" className={pillPrimary}>
              {t('form.sentProjects')}
              <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
            </Link>
            <button type="button" onClick={onRestart} className={cn(pillOutline, 'cursor-pointer')}>
              <Plus aria-hidden="true" className="size-4" />
              {t('form.sentAnother')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const banner = captchaMissing
    ? t('form.errors.captcha')
    : failed
      ? state.error === 'rate_limited'
        ? tCommon('rateLimited')
        : state.error === 'captcha'
          ? t('form.errors.captcha')
          : t('form.errors.server')
      : state.error === 'invalid'
        ? t('form.errors.invalid')
        : null
  // When sending failed for a reason the visitor can't fix here, email is the way round it.
  const offerEmail = failed && state.error !== 'captcha'

  const messageLength = values.message.length
  const placeholder = values.topic ? t(`form.messagePlaceholders.${values.topic}`) : t('form.messagePlaceholder')
  const describedBy = (field: ContactField) => (flagged[field] ? `${FIELD_IDS[field]}-error` : undefined)

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      aria-label={t('form.label')}
      className="bezel"
    >
      <div className="@container bezel-core flex flex-col p-5 sm:p-7 xl:p-8">
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {t('form.topic')}
            <span className="ms-2 text-xs font-normal text-muted-foreground">{t('form.optional')}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONTACT_TOPICS.map((option) => {
              const Icon = TOPIC_ICONS[option]
              return (
                <label key={option} className={chipClass}>
                  <input
                    type="radio"
                    name="topic"
                    value={option}
                    checked={values.topic === option}
                    onChange={() => setValues((current) => ({ ...current, topic: option }))}
                    className="sr-only"
                  />
                  <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
                  {t(`form.topics.${option}`)}
                </label>
              )
            })}
          </div>
          {values.topic === 'project' && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty transition-[opacity,translate] duration-200 ease-fluid starting:-translate-y-1 starting:opacity-0">
              {t('form.projectHint')}{' '}
              <Link
                href="/freelance"
                className="inline-flex min-h-6 items-center gap-1 font-semibold text-primary-text underline-offset-4 hover:underline"
                {...trackClick('contact-link', { channel: 'freelance-form', from: 'contact' })}
              >
                {t('form.projectHintLink')}
                <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
              </Link>
            </p>
          )}
        </fieldset>

        <div className="mt-6 grid gap-5 @md:grid-cols-2">
          <Field field="name" label={t('form.name')} error={errorFor('name')}>
            <input
              id={FIELD_IDS.name}
              name="name"
              type="text"
              required
              autoComplete="name"
              dir="auto"
              maxLength={NAME_MAX_LENGTH}
              value={values.name}
              placeholder={t('form.namePlaceholder')}
              onChange={onTextChange('name')}
              onBlur={onFieldBlur('name')}
              aria-invalid={flagged.name || undefined}
              aria-describedby={describedBy('name')}
              className={cn(fieldClass, 'h-12', flagged.name ? invalidRing : validRing)}
            />
          </Field>
          <Field field="email" label={t('form.email')} error={errorFor('email')}>
            <input
              id={FIELD_IDS.email}
              name="email"
              type="email"
              inputMode="email"
              required
              autoComplete="email"
              dir="ltr"
              maxLength={EMAIL_MAX_LENGTH}
              value={values.email}
              placeholder={t('form.emailPlaceholder')}
              onChange={onTextChange('email')}
              onBlur={onFieldBlur('email')}
              aria-invalid={flagged.email || undefined}
              aria-describedby={describedBy('email')}
              className={cn(fieldClass, 'h-12 rtl:text-right', flagged.email ? invalidRing : validRing)}
            />
          </Field>
          <Field
            field="message"
            label={t('form.message')}
            error={errorFor('message')}
            className="@md:col-span-2"
            aside={
              messageLength >= MESSAGE_COUNTER_FROM && (
                <span
                  className={cn(
                    'text-xs tabular-nums text-muted-foreground',
                    messageLength >= MESSAGE_MAX_LENGTH && 'font-medium text-foreground',
                  )}
                >
                  {t('form.counter', { count: messageLength, max: MESSAGE_MAX_LENGTH })}
                </span>
              )
            }
          >
            <textarea
              id={FIELD_IDS.message}
              name="message"
              required
              rows={5}
              dir="auto"
              maxLength={MESSAGE_MAX_LENGTH}
              value={values.message}
              placeholder={placeholder}
              onChange={onTextChange('message')}
              onBlur={onFieldBlur('message')}
              aria-invalid={flagged.message || undefined}
              aria-describedby={describedBy('message')}
              // Grows with the message where the browser can (field-sizing), up to a limit.
              className={cn(
                fieldClass,
                'max-h-96 min-h-36 resize-y py-3 leading-relaxed field-sizing-content',
                flagged.message ? invalidRing : validRing,
              )}
            />
          </Field>
        </div>

        <TurnstileWidget key={captchaRound} onToken={onCaptchaToken} className="mt-5 justify-start" />

        {banner && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive transition-[opacity,translate] duration-200 ease-fluid starting:-translate-y-1 starting:opacity-0"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {banner}
              {offerEmail && (
                <>
                  {' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="font-semibold underline underline-offset-4"
                    {...trackClick('contact-link', { channel: 'email', from: 'contact-error' })}
                  >
                    {t('form.errors.emailInstead')}
                  </a>
                </>
              )}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
          <p className="text-xs text-muted-foreground">
            <span aria-hidden="true" className="me-1 text-primary-text">
              *
            </span>
            {t('form.requiredHint')}
          </p>

          <button
            type="submit"
            disabled={pending}
            className="group relative inline-flex h-14 w-full cursor-pointer items-center justify-between gap-6 overflow-hidden rounded-full bg-primary ps-6 pe-2 font-semibold text-primary-foreground transition-[scale,background-color] duration-200 ease-fluid enabled:hover:bg-primary/90 active:scale-[0.98] disabled:cursor-default @lg:w-auto @lg:shrink-0"
          >
            <span className="grid text-start">
              <span aria-hidden={pending} className={cn('whitespace-nowrap [grid-area:1/1]', swapClass(!pending))}>
                {t('form.send')}
              </span>
              <span aria-hidden={!pending} className={cn('whitespace-nowrap [grid-area:1/1]', swapClass(pending))}>
                {t('form.sending')}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 transition-[translate] duration-300 ease-fluid group-enabled:group-hover:-translate-y-px ltr:group-enabled:group-hover:translate-x-0.5 rtl:group-enabled:group-hover:-translate-x-0.5"
            >
              <span className={cn('absolute', swapClass(!pending))}>
                <Send className="size-4.5 rtl:-scale-x-100" />
              </span>
              <span className={cn('absolute', swapClass(pending))}>
                <Loader2 className="size-4.5 animate-spin" />
              </span>
            </span>
          </button>
        </div>
      </div>
    </form>
  )
}
