import type { Tables } from '@/lib/supabase/database.types'
import type { Locale } from '@/lib/validation/locale'
import { pickI18n, type I18nMap } from '@/features/content/i18n-json'

// Pure, client-safe FAQ ("popular questions") mapping. When the CMS has no
// published items the freelance page uses the default questions from
// messages/*.json (`faq.items`), resolved by the caller.

export type FaqItemRow = Tables<'faq_items'>

export interface PublicFaqItem {
  id: string
  question: string
  answer: string
}

/** Keys of the default questions in messages/*.json, in display order. */
export const FAQ_FALLBACK_KEYS = [
  'projects',
  'stack',
  'availability',
  'process',
  'design',
  'location',
  'languages',
] as const

/** Published rows -> localized items (fr fallback); drops items missing a side. */
export function mapPublicFaq(rows: readonly FaqItemRow[], locale: Locale): PublicFaqItem[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      id: row.id,
      question: pickI18n(row.question as I18nMap, locale).trim(),
      answer: pickI18n(row.answer as I18nMap, locale).trim(),
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)
}

/** Default questions from translated messages (`t` scoped to the `faq` namespace). */
export function fallbackFaq(t: (key: string) => string): PublicFaqItem[] {
  return FAQ_FALLBACK_KEYS.map((key) => ({
    id: key,
    question: t(`items.${key}.question`),
    answer: t(`items.${key}.answer`),
  }))
}
