import { routing } from '@/i18n/routing'

// Single source of truth for site-wide SEO identity. Pure (no server imports) so
// metadata builders, JSON-LD builders, sitemap, robots and llms.txt all agree,
// and everything here is unit-testable.

/** Canonical origin (no trailing slash). Override per environment if needed. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.keltoummalouki.com').replace(/\/+$/, '')

export const SITE_NAME = 'Keltoum Malouki'

/** The person this site is about — the primary entity for search and AI answers. */
export const PERSON = {
  name: 'Keltoum Malouki',
  givenName: 'Keltoum',
  familyName: 'Malouki',
  /** Native-script spelling, so Arabic queries resolve to the same entity. */
  alternateName: ['كلثوم ملوكي'],
  jobTitle: 'Full Stack Web Developer',
  email: 'keltoummalouki@gmail.com',
  /** Studio headshot (charcoal background) — same photo as the favicon. */
  image: '/images/keltoum-malouki.jpg',
  address: { locality: 'Casablanca', country: 'MA', countryName: 'Morocco' },
} as const

/**
 * The freelance practice (Organization schema); `founder` points at PERSON.
 * Uses the personal brand name — set a registered business name here if one exists.
 */
export const ORGANIZATION = {
  name: 'Keltoum Malouki',
  alternateName: 'KM',
  logo: '/images/km-logo-512.png',
} as const

/**
 * Fallback public profiles, used when the CMS has no published social links.
 * Kept identical to the Header/Footer fallbacks.
 */
export const FALLBACK_SAME_AS = [
  'https://github.com/keltoummalouki',
  'https://www.linkedin.com/in/keltoummalouki',
] as const

/**
 * Whether a URL is a public profile that can identify the person (`sameAs`).
 * Messaging-app links (wa.me, t.me, …) embed a phone number or handle and are
 * contact channels, not identity profiles, so they never qualify.
 */
export function isPublicProfileUrl(url: string): boolean {
  const value = url.trim()
  if (!/^https?:\/\//i.test(value)) return false
  return !/(^|\.|\/\/)(wa\.me|whatsapp\.com|t\.me|signal\.me|viber\.com)(\/|$)/i.test(value)
}

/** Open Graph locale codes (language_TERRITORY). */
export const OG_LOCALES: Record<string, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  ar: 'ar_MA',
}

export const LOCALES = routing.locales
export const DEFAULT_LOCALE = routing.defaultLocale

/** Stable JSON-LD node ids, so every page references the same entities. */
export const SCHEMA_IDS = {
  person: `${SITE_URL}/#person`,
  organization: `${SITE_URL}/#organization`,
  website: `${SITE_URL}/#website`,
} as const

/** Absolute URL for a site path (`/fr/about`) or pass-through for absolute URLs. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Localized pathname for a locale-less path: `localePath('fr', '/about')` ->
 * `/fr/about`, `localePath('en', '/')` -> `/en`.
 */
export function localePath(locale: string, path = '/'): string {
  const clean = path === '/' || path === '' ? '' : path.startsWith('/') ? path : `/${path}`
  return `/${locale}${clean}`
}

/**
 * Whether this deployment should be indexed. Vercel preview/development
 * deployments must never be indexed (duplicate content on *.vercel.app).
 * Non-Vercel hosts (VERCEL_ENV unset) are treated as production.
 */
export function isIndexable(env: string | undefined = process.env.VERCEL_ENV): boolean {
  return env === undefined || env === '' || env === 'production'
}
