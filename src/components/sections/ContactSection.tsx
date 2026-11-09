'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTranslations } from 'next-intl'
import { AlertCircle, ArrowUpRight, Check, Copy, Loader2, Mail, MapPin, Phone, Send } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import SocialIcon from '@/components/ui/SocialIcon'
import { submitContactMessage } from '@/features/inbox/actions'
import type { PublicSocialLink } from '@/features/cms/queries'
import { trackClick, trackEvent } from '@/lib/analytics/events'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { cn } from '@/lib/utils'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const MAX_MESSAGE_LENGTH = 2000
const STATUS_RESET_MS = 5000
const COPY_RESET_MS = 2000

const EMAIL = 'keltoummalouki@gmail.com'
const PHONE = '+212 606 232 697'
const PHONE_HREF = 'tel:+212606232697'

type Field = 'name' | 'email' | 'message'
type FormErrors = Partial<Record<Field, string>>
type FormData = Record<Field, string>
type ButtonState = 'idle' | 'sending' | 'sent'

const FIELDS: Field[] = ['name', 'email', 'message']
const BUTTON_STATES: ButtonState[] = ['idle', 'sending', 'sent']
const BUTTON_ICONS: Record<ButtonState, LucideIcon> = { idle: Send, sending: Loader2, sent: Check }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitizeInput(input: string): string {
  // Do not trim while the user is typing: trimming on every change removes
  // trailing spaces immediately, which makes the message textarea feel broken.
  return input.replace(/[<>]/g, '')
}

/** Crossfade for stacked states: the active one is sharp, the rest blur out. */
function swapClass(active: boolean) {
  return cn(
    'transition-[opacity,translate,scale,filter] duration-200 ease-fluid',
    active ? 'opacity-100' : 'pointer-events-none translate-y-1 scale-90 opacity-0 blur-[2px]'
  )
}

function FormField({
  field,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  rows,
  maxLength,
  autoComplete,
  aside,
  className,
}: {
  field: Field
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  error?: string
  type?: string
  rows?: number
  maxLength?: number
  autoComplete?: string
  aside?: React.ReactNode
  className?: string
}) {
  // Prefixed: plain "name"/"email" ids also exist in other forms of the app.
  const id = `contact-${field}`
  const errorId = `${id}-error`
  const Control = rows ? 'textarea' : 'input'

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          <span aria-hidden="true" className="ms-0.5 text-primary-text">*</span>
        </label>
        {aside}
      </div>

      <Control
        id={id}
        name={field}
        type={rows ? undefined : type}
        rows={rows}
        required
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'w-full rounded-xl border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/60',
          'transition-[border-color,box-shadow] duration-200 ease-fluid',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-0',
          rows ? 'min-h-40 resize-y py-3 leading-relaxed' : 'h-12',
          error
            ? 'border-destructive focus-visible:ring-destructive/20'
            : 'border-input hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-primary/20'
        )}
      />

      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-sm text-destructive transition-[opacity,translate] duration-200 ease-fluid starting:-translate-y-1 starting:opacity-0"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function ContactSection({ socialLinks = [] }: { socialLinks?: PublicSocialLink[] }) {
  const t = useTranslations('contact')
  const tCommon = useTranslations('common')
  const sectionRef = useRef<HTMLElement>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [formData, setFormData] = useState<FormData>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(
    () => () => {
      clearTimeout(statusTimer.current)
      clearTimeout(copyTimer.current)
    },
    []
  )

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion()) return

    // Batched per element: on mobile the form sits a full screen below the
    // heading, so a single section trigger would animate it off-screen.
    const ctx = gsap.context(() => {
      gsap.set('.contact-reveal', { opacity: 0, y: 32 })
      ScrollTrigger.batch('.contact-reveal', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1, overwrite: true }),
      })
    }, section)

    return () => ctx.revert()
  }, [])

  const validateField = (field: Field, raw: string): string | undefined => {
    const value = raw.trim()
    switch (field) {
      case 'name':
        if (!value) return t('form.errors.nameRequired')
        if (value.length < 2) return t('form.errors.nameMin')
        return undefined
      case 'email':
        if (!value) return t('form.errors.emailRequired')
        if (!EMAIL_REGEX.test(value)) return t('form.errors.emailInvalid')
        return undefined
      case 'message':
        if (!value) return t('form.errors.messageRequired')
        if (value.length < 10) return t('form.errors.messageMin')
        if (value.length > MAX_MESSAGE_LENGTH) return t('form.errors.messageMax')
        return undefined
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = e.target.name as Field
    setFormData((prev) => ({ ...prev, [field]: sanitizeInput(e.target.value) }))

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = e.target.name as Field
    // Don't flag empty fields while someone is just tabbing through the form.
    if (!e.target.value.trim()) return
    setErrors((prev) => ({ ...prev, [field]: validateField(field, e.target.value) }))
  }

  const showStatus = (status: 'success' | 'error', message = '') => {
    setSubmitStatus(status)
    setErrorMessage(message)
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => {
      setSubmitStatus('idle')
      setErrorMessage('')
    }, STATUS_RESET_MS)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors: FormErrors = {}
    for (const field of FIELDS) {
      const error = validateField(field, formData[field])
      if (error) nextErrors[field] = error
    }
    setErrors(nextErrors)

    const firstInvalid = FIELDS.find((field) => nextErrors[field])
    if (firstInvalid) {
      document.getElementById(`contact-${firstInvalid}`)?.focus()
      return
    }

    // If Turnstile is configured, require a token before submitting.
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      showStatus('error', tCommon('error'))
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const result = await submitContactMessage({
        name: formData.name,
        email: formData.email,
        message: formData.message,
        turnstileToken,
      })

      if (!result.ok) {
        showStatus('error', result.error === 'rate_limited' ? tCommon('rateLimited') : tCommon('error'))
        return
      }

      showStatus('success')
      trackEvent('contact-form-sent')
      setFormData({ name: '', email: '', message: '' })
      setTurnstileToken(null)
    } catch {
      // Show a generic, localized message — never surface raw server errors to users.
      showStatus('error', tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      // Clipboard unavailable (insecure context or permission denied): the mailto link still works.
    }
  }

  const contactInfo: { icon: LucideIcon; label: string; value: string; href?: string; channel?: string; ltr?: boolean; copy?: boolean }[] = [
    { icon: Mail, label: t('info.email'), value: EMAIL, href: `mailto:${EMAIL}`, channel: 'email', ltr: true, copy: true },
    { icon: Phone, label: t('info.phone'), value: PHONE, href: PHONE_HREF, channel: 'phone', ltr: true },
    { icon: MapPin, label: t('info.location'), value: t('info.locationValue') },
  ]

  // The email/phone rows above already cover these; don't repeat them as icons.
  const contactHrefs = new Set(contactInfo.flatMap((info) => (info.href ? [info.href.toLowerCase()] : [])))
  const profileLinks = socialLinks.filter((link) => !contactHrefs.has(link.url.trim().toLowerCase()))

  const buttonState: ButtonState = isSubmitting ? 'sending' : submitStatus === 'success' ? 'sent' : 'idle'
  const buttonLabels: Record<ButtonState, string> = {
    idle: t('form.send'),
    sending: t('form.sending'),
    sent: t('form.sent'),
  }
  const messageLength = formData.message.length

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-background"
      aria-labelledby="contact-title"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 grid-pattern opacity-20 pointer-events-none"
      />

      <div className="relative container-main">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-14 xl:gap-20">
          <div className="lg:col-span-6 xl:col-span-5">
            <SectionHeader
              id="contact-title"
              centered={false}
              eyebrow={t('eyebrow')}
              title={t('title')}
              subtitle={t('subtitle')}
              className="mb-10 md:mb-12"
            />

            <div className="contact-reveal bezel">
              <ul className="bezel-core flex flex-col gap-1 p-2">
                {contactInfo.map((info) => {
                  const Icon = info.icon
                  const rowClass =
                    'flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-[0.875rem] px-2.5 py-2.5 transition-[background-color,scale] duration-200 ease-fluid sm:gap-4 sm:px-3'
                  // On narrow phones let the address break before "@", never mid-word.
                  const [local, domain] = info.value.split('@')
                  const value = domain ? <>{local}<wbr />@{domain}</> : info.value
                  const body = (
                    <>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary-text ring-1 ring-border sm:size-11">
                        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground rtl:tracking-normal">
                          {info.label}
                        </span>
                        <span className="block font-medium text-foreground [overflow-wrap:anywhere]">
                          {info.ltr ? <bdi dir="ltr">{value}</bdi> : value}
                        </span>
                      </span>
                    </>
                  )

                  return (
                    <li key={info.label} className="flex items-center gap-1">
                      {info.href ? (
                        <a
                          href={info.href}
                          className={cn(rowClass, 'group hover:bg-accent/60 active:scale-[0.99]')}
                          {...trackClick('contact-link', { channel: info.channel ?? 'other', from: 'contact' })}
                        >
                          {body}
                          {/* One trailing control per row: copyable rows get the copy button instead. */}
                          {!info.copy && (
                            <span
                              aria-hidden="true"
                              className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border transition-[translate,background-color,color,box-shadow] duration-300 ease-fluid group-hover:-translate-y-0.5 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-transparent ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 sm:flex"
                            >
                              <ArrowUpRight className="size-4 rtl:-scale-x-100" />
                            </span>
                          )}
                        </a>
                      ) : (
                        <div className={rowClass}>{body}</div>
                      )}

                      {info.copy && (
                        // 44px hit area around a 36px circle; sm:me-2 lines it up with the
                        // arrows, which only show from sm up.
                        <button
                          type="button"
                          onClick={copyEmail}
                          {...trackClick('contact-link', { channel: 'email-copy', from: 'contact' })}
                          aria-label={copied ? t('info.copied') : t('info.copyEmail')}
                          title={copied ? t('info.copied') : t('info.copyEmail')}
                          className="group/copy flex sm:me-2 size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[scale] duration-150 ease-fluid active:scale-95"
                        >
                          <span
                            aria-hidden="true"
                            className="relative flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border transition-[background-color,color] duration-200 ease-fluid group-hover/copy:bg-accent group-hover/copy:text-foreground"
                          >
                            <span className={cn('absolute', swapClass(!copied))}>
                              <Copy className="size-4" />
                            </span>
                            <span className={cn('absolute', swapClass(copied))}>
                              <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          </span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              <span role="status" className="sr-only">
                {copied ? t('info.copied') : ''}
              </span>
            </div>

            {profileLinks.length > 0 && (
              <div className="contact-reveal mt-8">
                <p
                  id="contact-socials-label"
                  className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground rtl:tracking-normal"
                >
                  {t('socials')}
                </p>
                <ul aria-labelledby="contact-socials-label" className="flex flex-wrap gap-2">
                  {profileLinks.map((link) => {
                    const external = !/^(mailto|tel):/i.test(link.url)
                    const label = link.label || link.platform
                    return (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noopener noreferrer' : undefined}
                          aria-label={label}
                          title={label}
                          {...trackClick('contact-link', { channel: link.platform, from: 'contact' })}
                          className="flex size-12 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition-[translate,scale,color,background-color,box-shadow] duration-200 ease-fluid hover:-translate-y-0.5 hover:bg-accent hover:text-foreground hover:ring-primary/40 active:scale-95"
                        >
                          <SocialIcon platform={link.platform} icon={link.icon} className="size-[18px]" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="contact-reveal lg:col-span-6 xl:col-span-7">
            <div className="bezel h-full">
              <form
                onSubmit={handleSubmit}
                noValidate
                aria-labelledby="contact-form-title"
                aria-describedby="contact-form-intro"
                className="@container bezel-core flex h-full flex-col p-5 sm:p-8 xl:p-10"
              >
                <div className="mb-8">
                  <h3 id="contact-form-title" className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                    {t('form.title')}
                  </h3>
                  <p id="contact-form-intro" className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {t('form.intro')}
                  </p>
                </div>

                <div className="grid gap-5 @md:grid-cols-2">
                  <FormField
                    field="name"
                    label={t('form.name')}
                    placeholder={t('form.namePlaceholder')}
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.name}
                  />
                  <FormField
                    field="email"
                    type="email"
                    label={t('form.email')}
                    placeholder={t('form.emailPlaceholder')}
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.email}
                  />
                  <FormField
                    field="message"
                    label={t('form.message')}
                    placeholder={t('form.messagePlaceholder')}
                    rows={6}
                    maxLength={MAX_MESSAGE_LENGTH}
                    value={formData.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.message}
                    className="@md:col-span-2"
                    aside={
                      <span
                        aria-hidden="true"
                        className={cn(
                          'text-xs tabular-nums text-muted-foreground transition-colors duration-200',
                          messageLength > MAX_MESSAGE_LENGTH * 0.9 && 'text-foreground'
                        )}
                      >
                        {messageLength}/{MAX_MESSAGE_LENGTH}
                      </span>
                    }
                  />
                </div>

                <TurnstileWidget onToken={setTurnstileToken} className="mt-6 justify-start" />

                {submitStatus === 'error' && errorMessage && (
                  <div
                    role="alert"
                    className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive transition-[opacity,translate] duration-200 ease-fluid starting:-translate-y-1 starting:opacity-0"
                  >
                    <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="mt-auto flex flex-col-reverse gap-4 pt-8 @lg:flex-row @lg:items-center @lg:justify-between">
                  <p className="text-xs text-muted-foreground">
                    <span aria-hidden="true" className="me-1 text-primary-text">*</span>
                    {t('form.requiredHint')}
                  </p>

                  <button
                    type="submit"
                    disabled={buttonState !== 'idle'}
                    className="group relative inline-flex h-14 w-full cursor-pointer items-center justify-between gap-6 overflow-hidden rounded-full bg-primary ps-6 pe-2 font-semibold text-primary-foreground transition-[scale,background-color] duration-200 ease-fluid enabled:hover:bg-primary/90 active:scale-[0.98] disabled:cursor-default @lg:w-auto @lg:shrink-0"
                  >
                    <span className="grid text-start">
                      {BUTTON_STATES.map((state) => (
                        <span
                          key={state}
                          aria-hidden={state !== buttonState}
                          className={cn('whitespace-nowrap [grid-area:1/1]', swapClass(state === buttonState))}
                        >
                          {buttonLabels[state]}
                        </span>
                      ))}
                    </span>

                    <span
                      aria-hidden="true"
                      className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 transition-[translate] duration-300 ease-fluid group-enabled:group-hover:-translate-y-px ltr:group-enabled:group-hover:translate-x-0.5 rtl:group-enabled:group-hover:-translate-x-0.5"
                    >
                      {BUTTON_STATES.map((state) => {
                        const Icon = BUTTON_ICONS[state]
                        return (
                          <span key={state} className={cn('absolute', swapClass(state === buttonState))}>
                            <Icon
                              className={cn(
                                'size-[18px]',
                                state === 'idle' && 'rtl:-scale-x-100',
                                state === 'sending' && 'animate-spin'
                              )}
                            />
                          </span>
                        )
                      })}
                    </span>
                  </button>
                </div>

                <p role="status" className="sr-only">
                  {submitStatus === 'success' ? t('form.sent') : ''}
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
