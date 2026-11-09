'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRight, CalendarClock, Check, Copy, Mail, MapPin, Phone, type LucideIcon } from 'lucide-react'
import SocialIcon from '@/components/ui/SocialIcon'
import type { PublicSocialLink } from '@/features/cms/queries'
import { trackClick } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF } from './channels'

const COPY_RESET_MS = 2000
const CLOCK_MS = 30_000

/**
 * Casablanca's time, once hydrated: the page is cached and shared between visitors,
 * so the server can't render the minute, and formatting a time zone during SSR can
 * differ between Node and the browser (a hydration mismatch).
 */
function useCasablancaTime(): string | null {
  const format = useFormatter()
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const timer = window.setInterval(tick, CLOCK_MS)
    return () => window.clearInterval(timer)
  }, [])
  return now ? format.dateTime(now, { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Casablanca' }) : null
}

/** Crossfade for stacked states: the active one is sharp, the rest blur out. */
function swapClass(active: boolean) {
  return cn(
    'transition-[opacity,translate,scale,filter] duration-200 ease-fluid',
    active ? 'opacity-100' : 'pointer-events-none translate-y-1 scale-90 opacity-0 blur-[2px]',
  )
}

const rowClass =
  'flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-2.5 transition-[background-color,scale] duration-200 ease-fluid sm:gap-4'

function RowBody({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary-text ring-1 ring-border">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground rtl:tracking-normal">
          {label}
        </span>
        {children}
      </span>
    </>
  )
}

/** The arrow that marks a row as a link; nudges toward its destination on hover. */
function RowArrow() {
  return (
    <span
      aria-hidden="true"
      className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border transition-[translate,background-color,color] duration-300 ease-fluid group-hover:-translate-y-0.5 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-transparent ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 sm:flex"
    >
      <ArrowUpRight className="size-4 rtl:-scale-x-100" />
    </span>
  )
}

/**
 * The ways round the form: email (with a copy button), phone, a call booking when
 * one is set in the dashboard, the city with its current time, and the profiles
 * from the dashboard that aren't already one of those lines.
 */
export default function DirectContact({
  socialLinks = [],
  bookingUrl = '',
  className,
}: {
  socialLinks?: PublicSocialLink[]
  bookingUrl?: string
  className?: string
}) {
  const t = useTranslations('contact')
  const time = useCasablancaTime()
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      // Clipboard unavailable (insecure context or permission denied): the mailto link still works.
    }
  }

  // The email and phone lines already cover these; don't repeat them as icons.
  const lines = new Set([`mailto:${CONTACT_EMAIL}`, CONTACT_PHONE_HREF])
  const profileLinks = socialLinks.filter((link) => !lines.has(link.url.trim().toLowerCase()))
  const [local, domain] = CONTACT_EMAIL.split('@')

  return (
    <div className={className}>
      <p
        id="contact-direct-label"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground rtl:tracking-normal"
      >
        {t('direct.title')}
      </p>

      <ul aria-labelledby="contact-direct-label" className="mt-3 divide-y divide-border/70 border-y border-border/70">
        <li className="flex items-center gap-1">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={cn(rowClass, 'group hover:bg-accent/60 active:scale-[0.99]')}
            {...trackClick('contact-link', { channel: 'email', from: 'contact' })}
          >
            <RowBody icon={Mail} label={t('direct.email')}>
              {/* On narrow phones the address breaks before the "@", never mid-word. */}
              <bdi dir="ltr" className="block font-medium text-foreground wrap-anywhere">
                {local}
                <wbr />@{domain}
              </bdi>
            </RowBody>
          </a>
          {/* 44px hit area around a 36px circle. */}
          <button
            type="button"
            onClick={copyEmail}
            {...trackClick('contact-link', { channel: 'email-copy', from: 'contact' })}
            aria-label={copied ? t('direct.copied') : t('direct.copyEmail')}
            title={copied ? t('direct.copied') : t('direct.copyEmail')}
            className="group/copy flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[scale] duration-150 ease-fluid active:scale-95"
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
        </li>

        <li>
          <a
            href={CONTACT_PHONE_HREF}
            className={cn(rowClass, 'group hover:bg-accent/60 active:scale-[0.99]')}
            {...trackClick('contact-link', { channel: 'phone', from: 'contact' })}
          >
            <RowBody icon={Phone} label={t('direct.phone')}>
              <bdi dir="ltr" className="block font-medium text-foreground">
                {CONTACT_PHONE}
              </bdi>
            </RowBody>
            <RowArrow />
          </a>
        </li>

        {bookingUrl && (
          <li>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(rowClass, 'group hover:bg-accent/60 active:scale-[0.99]')}
              {...trackClick('booking-click', { from: 'contact' })}
            >
              <RowBody icon={CalendarClock} label={t('direct.book')}>
                <span className="block font-medium text-foreground">{t('direct.bookValue')}</span>
                <span className="sr-only">{t('direct.newTab')}</span>
              </RowBody>
              <RowArrow />
            </a>
          </li>
        )}

        <li>
          <div className={rowClass}>
            <RowBody icon={MapPin} label={t('direct.location')}>
              <span className="block font-medium text-foreground">{t('direct.locationValue')}</span>
              {/* The line is reserved before the time arrives, so nothing shifts. */}
              <span className="block min-h-5 text-sm tabular-nums text-muted-foreground">
                {time && t('direct.localTime', { time })}
              </span>
            </RowBody>
          </div>
        </li>
      </ul>

      {profileLinks.length > 0 && (
        <div className="mt-6">
          <p
            id="contact-socials-label"
            className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground rtl:tracking-normal"
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
                    <SocialIcon platform={link.platform} icon={link.icon} className="size-4.5" />
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <span role="status" className="sr-only">
        {copied ? t('direct.copied') : ''}
      </span>
    </div>
  )
}
