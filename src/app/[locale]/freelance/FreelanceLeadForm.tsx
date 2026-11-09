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
  ArrowLeft,
  ArrowRight,
  Braces,
  CalendarClock,
  Check,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Mail,
  Package,
  Pencil,
  Phone,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react'
import { pillOutline, pillPrimary } from '@/components/sections/showcase/classes'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { submitFreelanceLeadAction } from '@/features/freelance/actions'
import {
  BRIEF_STEPS,
  EMPTY_BRIEF,
  LAST_BRIEF_STEP,
  PACKAGE_EVENT,
  briefSceneState,
  firstName,
  invalidBriefFields,
  isBriefFieldInvalid,
  withPackageLine,
  withStarter,
  withoutPackageLine,
  type BriefPhase,
  type BriefSceneState,
  type BriefValues,
  type ContactPreference,
  type PackageEventDetail,
  type ProjectType,
  type RequiredBriefField,
} from '@/features/freelance/brief'
import {
  BUDGET_RANGES,
  CONTACT_PREFERENCES,
  PROJECT_TYPES,
  TIMELINES,
  type LeadSubmitState,
} from '@/features/freelance/schema'
import { Link } from '@/i18n/navigation'
import { trackClick, trackEvent } from '@/lib/analytics/events'
import { scrollToElement } from '@/lib/motion/smooth-scroll'
import { cn } from '@/lib/utils'
import styles from './freelance.module.css'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const PROJECT_ICONS: Record<ProjectType, LucideIcon> = {
  web_app: LayoutDashboard,
  website: Globe,
  ecommerce: ShoppingBag,
  api: Braces,
  consulting: Lightbulb,
  other: Sparkles,
}

const CONTACT_ICONS: Record<ContactPreference, LucideIcon> = {
  email: Mail,
  call: Phone,
  video: Video,
}

const STARTERS = ['goal', 'deadline', 'reference'] as const

/** Below the fixed header when the form scrolls back to its top. */
const SCROLL_OFFSET = 96

const FIELD_IDS: Record<RequiredBriefField, string> = {
  details: 'lead-details',
  name: 'lead-name',
  email: 'lead-email',
}

const inputClass =
  'w-full rounded-xl border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-200 ease-fluid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-0'
const inputStateClass = (invalid: boolean) =>
  invalid
    ? 'border-destructive focus-visible:ring-destructive/20'
    : 'border-input hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-primary/20'

export interface BriefReport {
  scene: BriefSceneState
  values: BriefValues
}

/** One answer on the first step: a card with an icon and a line of explanation. */
function ProjectOption({
  value,
  label,
  hint,
  checked,
  onChoose,
  onPreview,
}: {
  value: ProjectType
  label: string
  hint: string
  checked: boolean
  onChoose: () => void
  onPreview: (value: ProjectType | null) => void
}) {
  const Icon = PROJECT_ICONS[value]
  return (
    <label
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onPreview(value)
      }}
      onPointerLeave={() => onPreview(null)}
      className="group relative flex min-h-24 cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-background/50 p-3 transition-[border-color,background-color,scale] duration-200 ease-fluid hover:border-foreground/25 active:scale-[0.985] has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-2 has-focus-visible:ring-primary/60 sm:p-3.5"
    >
      <input type="radio" name="projectType" value={value} checked={checked} onChange={onChoose} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary-text ring-1 ring-border transition-colors duration-200 group-has-checked:bg-primary group-has-checked:text-white group-has-checked:ring-transparent"
      >
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="text-sm font-semibold leading-snug text-foreground">{label}</span>
      <span className="hidden text-xs leading-snug text-muted-foreground text-pretty sm:block">{hint}</span>
      <span
        aria-hidden="true"
        className="absolute end-2.5 top-2.5 flex size-5 scale-50 items-center justify-center rounded-full bg-primary text-white opacity-0 transition-[scale,opacity] duration-200 ease-fluid group-has-checked:scale-100 group-has-checked:opacity-100"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    </label>
  )
}

/** A short answer in a row of pills. */
function ChoiceChip({
  name,
  value,
  label,
  checked,
  onChoose,
  icon: Icon,
}: {
  name: string
  value: string
  label: string
  checked: boolean
  onChoose: () => void
  icon?: LucideIcon
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-background/50 px-4 text-sm font-medium text-foreground transition-[border-color,background-color,color,scale] duration-200 ease-fluid hover:border-foreground/25 active:scale-[0.97] has-checked:border-primary has-checked:bg-primary has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-primary/60 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-card">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChoose} className="sr-only" />
      {Icon && <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />}
      <span>{label}</span>
    </label>
  )
}

function ChoiceGroup({ legend, optional, children }: { legend: string; optional: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-baseline justify-between gap-3 text-sm font-medium text-foreground">
        {legend}
        <span className="text-xs font-normal text-muted-foreground">{optional}</span>
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="mt-2 flex items-center gap-1.5 text-sm text-destructive transition-[opacity,translate] duration-200 ease-fluid starting:-translate-y-1 starting:opacity-0"
    >
      <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}

/**
 * The project request as three short steps: what it is, budget and timing, then
 * the details and how to reach the visitor. Only that last step has required
 * fields, and nothing typed is ever lost: answers stay when moving between steps
 * and when the server refuses a submission.
 *
 * Native radios and inputs inside one <form>, so it submits without JavaScript
 * too (see `.stepInactive` in freelance.module.css, which then shows every step at once).
 */
export default function FreelanceLeadForm({
  bookingUrl,
  onReport,
  onActivity,
  onRestart,
}: {
  bookingUrl: string
  /** Every change, for the 3D model and its notes. */
  onReport: (report: BriefReport) => void
  /** A keystroke, for the model's data packets. */
  onActivity: () => void
  /** Sends the visitor back to an empty form after a successful request. */
  onRestart: () => void
}) {
  const t = useTranslations('freelance')
  const [state, formAction, pending] = useActionState<LeadSubmitState, FormData>(submitFreelanceLeadAction, {})

  const [values, setValues] = useState<BriefValues>(EMPTY_BRIEF)
  const [step, setStep] = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null)
  const [preview, setPreview] = useState<ProjectType | null>(null)
  const [errors, setErrors] = useState<Partial<Record<RequiredBriefField, boolean>>>({})
  const [token, setToken] = useState<string | null>(null)
  const [captchaRound, setCaptchaRound] = useState(0)
  const [captchaMissing, setCaptchaMissing] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [chosenPackage, setChosenPackage] = useState<{ title: string; line: string } | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const titleRefs = useRef<(HTMLHeadingElement | null)[]>([])
  const sentTitleRef = useRef<HTMLHeadingElement>(null)
  const detailsRef = useRef<HTMLTextAreaElement>(null)
  const packageLineRef = useRef<string | null>(null)

  const failed = !pending && !!state.error && state.error !== 'invalid'
  const phase: BriefPhase = pending ? 'sending' : state.ok ? 'sent' : failed ? 'failed' : 'editing'

  useEffect(() => {
    onReport({ scene: briefSceneState({ values, furthestStep, preview, phase }), values })
  }, [values, furthestStep, preview, phase, onReport])

  // Conversion: the request was accepted. Project type only, never what was typed.
  // The form is replaced by the thank-you, so this runs once per request.
  const projectType = values.projectType || 'unspecified'
  useEffect(() => {
    if (!state.ok) return
    trackEvent('lead-form-sent', { type: projectType })
    sentTitleRef.current?.focus()
    if (rootRef.current) scrollToElement(rootRef.current, SCROLL_OFFSET)
  }, [state.ok, projectType])

  // The browser checks the same rules first, so this only runs if they ever disagree.
  const serverErrors = state.errors
  useEffect(() => {
    if (!serverErrors) return
    const invalid = (Object.keys(FIELD_IDS) as RequiredBriefField[]).filter((field) => serverErrors[field])
    setErrors(Object.fromEntries(invalid.map((field) => [field, true])))
    setStep(LAST_BRIEF_STEP)
    if (invalid[0]) document.getElementById(FIELD_IDS[invalid[0]])?.focus()
  }, [serverErrors])

  // A Turnstile token works once, so a refused request needs a new one to retry.
  useEffect(() => {
    if (!failed) return
    setToken(null)
    setCaptchaRound((round) => round + 1)
  }, [failed])

  const onCaptchaToken = useCallback((next: string | null) => {
    setToken(next)
    if (next) setCaptchaMissing(false)
  }, [])

  // A package chosen further down the page joins the request.
  useEffect(() => {
    const onPackage = (event: Event) => {
      const { title } = (event as CustomEvent<PackageEventDetail>).detail
      const line = t('packages.line', { title })
      const previous = packageLineRef.current
      packageLineRef.current = line
      setChosenPackage({ title, line })
      setValues((current) => ({ ...current, details: withPackageLine(current.details, line, previous) }))
    }
    window.addEventListener(PACKAGE_EVENT, onPackage)
    return () => window.removeEventListener(PACKAGE_EVENT, onPackage)
  }, [t])

  const goTo = (next: number) => {
    if (next === step) return
    setDirection(next > step ? 'forward' : 'back')
    setStep(next)
    setFurthestStep((reached) => Math.max(reached, next))
    setPreview(null)
    // Screen readers land on the new question; phones get it back in view.
    requestAnimationFrame(() => {
      titleRefs.current[next]?.focus({ preventScroll: true })
      const top = rootRef.current?.getBoundingClientRect().top ?? 0
      if (rootRef.current && (top < SCROLL_OFFSET - 8 || top > window.innerHeight * 0.45)) {
        scrollToElement(rootRef.current, SCROLL_OFFSET)
      }
    })
  }

  const setValue = <K extends keyof BriefValues>(field: K, value: BriefValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const onTextChange =
    (field: 'details' | 'name' | 'email' | 'company') => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(field, event.target.value)
      onActivity()
      if (field !== 'company' && errors[field]) setErrors((current) => ({ ...current, [field]: false }))
    }

  const onRequiredBlur = (field: RequiredBriefField) => (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Don't flag empty fields while someone is just tabbing through the form.
    if (!event.target.value.trim()) return
    setErrors((current) => ({ ...current, [field]: isBriefFieldInvalid(field, values) }))
  }

  // Always handled here, even with the form's `action` set: a submit that goes
  // through `action` makes React reset the form afterwards, which would uncheck
  // the radios and leave them out of a retry after a server error. Dispatching
  // by hand keeps everything in place. `action` stays for visitors without JS.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step < LAST_BRIEF_STEP) {
      goTo(step + 1)
      return
    }
    const invalid = invalidBriefFields(values)
    setErrors(Object.fromEntries(invalid.map((field) => [field, true])))
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
    startTransition(() => formAction(data))
  }

  // Enter on a radio answers and moves on, as it would on a text field.
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement
    if (event.key === 'Enter' && step < LAST_BRIEF_STEP && target.tagName === 'INPUT') {
      event.preventDefault()
      goTo(step + 1)
    }
  }

  const addStarter = (key: (typeof STARTERS)[number]) => {
    setValue('details', withStarter(values.details, t(`form.starters.${key}`)))
    const field = detailsRef.current
    if (!field) return
    field.focus()
    requestAnimationFrame(() => field.setSelectionRange(field.value.length, field.value.length))
  }

  const removePackage = () => {
    if (chosenPackage) setValue('details', withoutPackageLine(values.details, chosenPackage.line))
    packageLineRef.current = null
    setChosenPackage(null)
  }

  if (state.ok) {
    return (
      <div ref={rootRef} className="bezel scroll-mt-24">
        <div role="status" className="bezel-core flex flex-col items-start p-6 sm:p-8">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Check className="size-6" strokeWidth={2.25} />
          </span>
          <h2
            ref={sentTitleRef}
            tabIndex={-1}
            className="mt-5 text-2xl font-bold tracking-tight text-foreground text-balance outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-3xl"
          >
            {/* Isolated: a Latin name must not reorder an Arabic sentence, or the reverse. */}
            {t('form.sentTitle', { name: `⁨${firstName(values.name)}⁩` })}
          </h2>
          <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground text-pretty">{t('form.sentBody')}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={pillPrimary}
                {...trackClick('booking-click', { from: 'freelance-sent' })}
              >
                <CalendarClock aria-hidden="true" className="size-4" />
                {t('cta.book')}
                <span className="sr-only">{t('cta.newTab')}</span>
              </a>
            )}
            <Link href="/projects" className={bookingUrl ? pillOutline : pillPrimary}>
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

  const stepKey = BRIEF_STEPS[step]
  const stepCount = BRIEF_STEPS.length

  const answers = [
    values.projectType && { step: 0, text: t(`options.projectType.${values.projectType}`) },
    values.budget && { step: 1, text: t(`options.budget.${values.budget}`) },
    values.timeline && { step: 1, text: t(`options.timeline.${values.timeline}`) },
  ].filter((answer) => !!answer)

  const errorMessage = captchaMissing || state.error === 'captcha'
    ? t('form.errorCaptcha')
    : state.error === 'rate_limited'
      ? t('form.errorRateLimited')
      : t('form.errorGeneric')
  const showFormError = captchaMissing || failed

  return (
    <div ref={rootRef} className="bezel scroll-mt-24">
      <form
        action={formAction}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        noValidate
        aria-labelledby={`brief-title-${stepKey}`}
        data-direction={direction ?? undefined}
        className={cn(styles.form, 'bezel-core flex flex-col p-5 sm:p-7')}
      >
        <nav aria-label={t('form.stepsLabel')} className={styles.scriptOnly}>
          <ol className="grid grid-cols-3 gap-2.5">
            {BRIEF_STEPS.map((id, index) => {
              const reached = index <= step
              const done = index < furthestStep || index < step
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current={index === step ? 'step' : undefined}
                    className="group flex min-h-11 w-full cursor-pointer flex-col gap-2 rounded-lg pt-1 text-start focus-visible:ring-offset-card"
                  >
                    <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-foreground/10">
                      <span
                        className={cn(
                          'block h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-fluid rtl:origin-right',
                          reached ? 'scale-x-100' : 'scale-x-0',
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        'flex items-start gap-1.5 text-xs font-medium leading-tight transition-colors duration-200',
                        index === step ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                      )}
                    >
                      {done && index !== step ? (
                        <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary-text" strokeWidth={2.5} />
                      ) : (
                        <span aria-hidden="true" className="tabular-nums">{index + 1}.</span>
                      )}
                      {t(`form.steps.${id}.label`)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
        <p role="status" className="sr-only">
          {t('form.stepStatus', { current: step + 1, total: stepCount, label: t(`form.steps.${stepKey}.label`) })}
        </p>

        <div role="status">
          {chosenPackage && (
            <p className="mt-5 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 py-1 ps-3 pe-1 text-sm text-foreground">
              <Package aria-hidden="true" className="size-4 shrink-0 text-primary-text" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">{t('packages.selected', { title: chosenPackage.title })}</span>
              <button
                type="button"
                onClick={removePackage}
                aria-label={t('packages.remove', { title: chosenPackage.title })}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </p>
          )}
        </div>

        {/* 1. What it is */}
        <div className={cn(styles.step, step !== 0 && styles.stepInactive)}>
          <h2
            id="brief-title-project"
            ref={(element) => {
              titleRefs.current[0] = element
            }}
            tabIndex={-1}
            className={styles.stepTitle}
          >
            {t('form.steps.project.title')}
          </h2>
          <p className={styles.stepHint}>{t('form.steps.project.hint')}</p>
          <fieldset className="mt-5 min-w-0">
            <legend className="sr-only">{t('form.projectType')}</legend>
            <div className="grid grid-cols-2 gap-2.5 @lg:grid-cols-3">
              {PROJECT_TYPES.map((value) => (
                <ProjectOption
                  key={value}
                  value={value}
                  label={t(`options.projectType.${value}`)}
                  hint={t(`form.projectHints.${value}`)}
                  checked={values.projectType === value}
                  onChoose={() => setValue('projectType', value)}
                  onPreview={setPreview}
                />
              ))}
            </div>
          </fieldset>
        </div>

        {/* 2. Budget and timing */}
        <div className={cn(styles.step, step !== 1 && styles.stepInactive)}>
          <h2
            id="brief-title-scope"
            ref={(element) => {
              titleRefs.current[1] = element
            }}
            tabIndex={-1}
            className={styles.stepTitle}
          >
            {t('form.steps.scope.title')}
          </h2>
          <p className={styles.stepHint}>{t('form.steps.scope.hint')}</p>
          <div className="mt-6 grid gap-7">
            <ChoiceGroup legend={t('form.budget')} optional={t('form.optional')}>
              {BUDGET_RANGES.map((value) => (
                <ChoiceChip
                  key={value}
                  name="budget"
                  value={value}
                  label={t(`options.budget.${value}`)}
                  checked={values.budget === value}
                  onChoose={() => setValue('budget', value)}
                />
              ))}
            </ChoiceGroup>
            <ChoiceGroup legend={t('form.timeline')} optional={t('form.optional')}>
              {TIMELINES.map((value) => (
                <ChoiceChip
                  key={value}
                  name="timeline"
                  value={value}
                  label={t(`options.timeline.${value}`)}
                  checked={values.timeline === value}
                  onChoose={() => setValue('timeline', value)}
                />
              ))}
            </ChoiceGroup>
          </div>
        </div>

        {/* 3. Details and contact */}
        <div className={cn(styles.step, step !== 2 && styles.stepInactive)}>
          <h2
            id="brief-title-details"
            ref={(element) => {
              titleRefs.current[2] = element
            }}
            tabIndex={-1}
            className={styles.stepTitle}
          >
            {t('form.steps.details.title')}
          </h2>
          <p className={styles.stepHint}>
            {t('form.steps.details.hint')}{' '}
            <span className="whitespace-nowrap">
              <span aria-hidden="true" className="text-primary-text">*</span> {t('form.requiredHint')}
            </span>
          </p>

          {answers.length > 0 && (
            <ul aria-label={t('form.answers')} className="mt-4 flex flex-wrap gap-1.5">
              {answers.map((answer) => (
                <li key={answer.text}>
                  <button
                    type="button"
                    onClick={() => goTo(answer.step)}
                    aria-label={t('form.changeAnswer', { answer: answer.text })}
                    className="group inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-foreground ring-1 ring-border transition-colors duration-200 hover:bg-accent sm:min-h-8"
                  >
                    {answer.text}
                    <Pencil aria-hidden="true" className="size-3 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <label htmlFor="lead-details" className="mb-2 block text-sm font-medium text-foreground">
              {t('form.details')}
              <span aria-hidden="true" className="ms-0.5 text-primary-text">*</span>
            </label>
            <textarea
              ref={detailsRef}
              id="lead-details"
              name="details"
              rows={3}
              required
              dir="auto"
              maxLength={5000}
              value={values.details}
              placeholder={t('form.detailsPlaceholder')}
              onChange={onTextChange('details')}
              onBlur={onRequiredBlur('details')}
              aria-invalid={errors.details ? true : undefined}
              aria-describedby={errors.details ? 'lead-details-error' : undefined}
              className={cn(inputClass, inputStateClass(!!errors.details), 'block min-h-24 resize-y py-3 leading-relaxed')}
            />
            {errors.details && <FieldError id="lead-details-error">{t('form.errors.detailsRequired')}</FieldError>}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="me-1 text-xs text-muted-foreground">{t('form.starters.label')}</span>
              {STARTERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => addStarter(key)}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-foreground sm:min-h-8"
                >
                  {t(`form.starters.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="mt-6 min-w-0">
            <legend className="mb-3 text-sm font-semibold text-foreground">{t('form.contactGroup')}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-name" className="mb-2 block text-sm font-medium text-foreground">
                  {t('form.name')}
                  <span aria-hidden="true" className="ms-0.5 text-primary-text">*</span>
                </label>
                <input
                  id="lead-name"
                  name="name"
                  required
                  dir="auto"
                  autoComplete="name"
                  maxLength={120}
                  value={values.name}
                  onChange={onTextChange('name')}
                  onBlur={onRequiredBlur('name')}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'lead-name-error' : undefined}
                  className={cn(inputClass, inputStateClass(!!errors.name), 'h-12')}
                />
                {errors.name && <FieldError id="lead-name-error">{t('form.errors.nameRequired')}</FieldError>}
              </div>
              <div>
                <label htmlFor="lead-email" className="mb-2 block text-sm font-medium text-foreground">
                  {t('form.email')}
                  <span aria-hidden="true" className="ms-0.5 text-primary-text">*</span>
                </label>
                <input
                  id="lead-email"
                  name="email"
                  type="email"
                  required
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={320}
                  value={values.email}
                  onChange={onTextChange('email')}
                  onBlur={onRequiredBlur('email')}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? 'lead-email-error' : undefined}
                  className={cn(inputClass, inputStateClass(!!errors.email), 'h-12 rtl:text-right')}
                />
                {errors.email && <FieldError id="lead-email-error">{t('form.errors.emailInvalid')}</FieldError>}
              </div>
              {companyOpen ? (
                <div className="sm:col-span-2">
                  <label htmlFor="lead-company" className="mb-2 block text-sm font-medium text-foreground">
                    {t('form.company')}
                  </label>
                  <input
                    id="lead-company"
                    name="company"
                    dir="auto"
                    autoFocus
                    autoComplete="organization"
                    maxLength={160}
                    value={values.company}
                    onChange={onTextChange('company')}
                    className={cn(inputClass, inputStateClass(false), 'h-12')}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCompanyOpen(true)}
                  className="-my-2 -ms-1 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary-text underline-offset-4 hover:underline sm:col-span-2"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {t('form.addCompany')}
                </button>
              )}
            </div>
          </fieldset>

          <div className="mt-5">
            <ChoiceGroup legend={t('form.contactPreference')} optional={t('form.optional')}>
              {CONTACT_PREFERENCES.map((value) => (
                <ChoiceChip
                  key={value}
                  name="contactPreference"
                  value={value}
                  label={t(`options.contactPreference.${value}`)}
                  icon={CONTACT_ICONS[value]}
                  checked={values.contactPreference === value}
                  onChoose={() => setValue('contactPreference', value)}
                />
              ))}
            </ChoiceGroup>
          </div>

          <TurnstileWidget key={captchaRound} onToken={onCaptchaToken} className="mt-5 justify-start" />
          <input type="hidden" name="turnstileToken" value={token ?? ''} />
        </div>

        {showFormError && (
          <p
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-sm text-destructive"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        )}

        <div className={cn(styles.actions, 'mt-auto flex items-center justify-between gap-3 pt-6')}>
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className={cn(pillOutline, 'cursor-pointer')}>
              <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
              {t('form.back')}
            </button>
          ) : (
            <p className="text-xs leading-snug text-muted-foreground text-pretty">{t('form.reassure')}</p>
          )}

          {/* Without JavaScript every step shows at once and this is the way to send. */}
          {step < LAST_BRIEF_STEP && (
            <button type="submit" className={cn(pillPrimary, styles.noScriptOnly, 'h-12 shrink-0 cursor-pointer px-6')}>
              {t('form.submit')}
              <Send aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </button>
          )}

          {/* Separate keys: reusing one element would let the click that shows "Send" also submit. */}
          {step < LAST_BRIEF_STEP ? (
            <button
              key="next"
              type="button"
              onClick={() => goTo(step + 1)}
              className={cn(pillPrimary, styles.scriptOnly, 'h-12 shrink-0 cursor-pointer px-6')}
            >
              {t('form.next')}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 ease-fluid group-hover/pill:translate-x-0.5 rtl:rotate-180 rtl:group-hover/pill:-translate-x-0.5"
              />
            </button>
          ) : (
            <button
              key="send"
              type="submit"
              disabled={pending}
              className={cn(pillPrimary, 'h-12 shrink-0 cursor-pointer px-6 disabled:cursor-default disabled:opacity-80')}
            >
              {pending ? t('form.sending') : t('form.submit')}
              {pending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
