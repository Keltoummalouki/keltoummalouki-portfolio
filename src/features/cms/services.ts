import type { Tables } from '@/lib/supabase/database.types'
import type { Locale } from '@/lib/validation/locale'
import { pickI18n, type I18nMap } from '@/features/content/i18n-json'

// Pure, client-safe mapping for the freelance packages (public.services). A
// package without a price shows "quote on request".

export type ServiceRow = Tables<'services'>

/** Prices are entered and shown in whole euros, like the lead form's budget ranges. */
export const SERVICE_CURRENCY = 'EUR'

export interface PublicService {
  id: string
  title: string
  description: string
  /** What the package includes, one entry per line in the CMS. */
  includes: string[]
  /** "Starting from" price in whole euros; null = quote on request. */
  priceFrom: number | null
}

/** Non-empty lines of a multi-line CMS field, without typed bullets ("- ", "• "). */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s+/, '').trim())
    .filter(Boolean)
}

/** Published rows -> localized packages (fr fallback); drops packages without a name. */
export function mapPublicServices(rows: readonly ServiceRow[], locale: Locale): PublicService[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      id: row.id,
      title: pickI18n(row.title as I18nMap, locale).trim(),
      description: pickI18n(row.description as I18nMap, locale).trim(),
      includes: splitLines(pickI18n(row.includes as I18nMap, locale)),
      priceFrom: typeof row.price_from === 'number' ? row.price_from : null,
    }))
    .filter((service) => service.title.length > 0)
}

/** "1 500 €" (fr), "€1,500" (en): whole euros in the visitor's locale. */
export function formatStartingPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: SERVICE_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value)
}

/** URL-safe slug for a new package ("Site vitrine" -> "site-vitrine"); "package" if nothing is left. */
export function serviceSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return slug || 'package'
}
