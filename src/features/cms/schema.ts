import { z } from 'zod'
import { LOCALES, type Locale } from '@/lib/validation/locale'
import { DEFAULT_PUBLIC_NAV_ITEMS } from './design-options'

export const CMS_STATUSES = ['draft', 'published', 'archived'] as const
export type CmsStatus = (typeof CMS_STATUSES)[number]

export const MEDIA_BUCKET = 'portfolio-media'
export const MEDIA_KINDS = ['profile', 'cv', 'project', 'blog', 'skill', 'experience', 'education', 'certification', 'social', 'general'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export type I18nText = Record<Locale, string>

export const EMPTY_I18N: I18nText = { fr: '', en: '', ar: '' }

const hexColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function textValue(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim()
}

export function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function nullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function i18nFromForm(formData: FormData, prefix: string): I18nText {
  return {
    fr: textValue(formData.get(`${prefix}.fr`)),
    en: textValue(formData.get(`${prefix}.en`)),
    ar: textValue(formData.get(`${prefix}.ar`)),
  }
}

export function translationFromForm(formData: FormData, locale: Locale, fields: readonly string[]) {
  const row: Record<string, string> = { locale }
  for (const field of fields) {
    row[field] = textValue(formData.get(`${locale}.${field}`))
  }
  return row
}

export function cleanI18nMap(value: I18nText): Record<string, string> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, value[locale].trim()]).filter(([, text]) => text.length > 0),
  )
}

export const statusSchema = z.enum(CMS_STATUSES)

export const urlOrPathSchema = z
  .string()
  .trim()
  .max(600)
  .transform((value) => value || null)
  .refine((value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value), {
    message: 'Use a full URL or a local /path.',
  })

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** Optional third-party link (e.g. a booking page): https only, empty -> null. */
export const optionalHttpsUrlSchema = z
  .string()
  .trim()
  .max(600)
  .transform((value) => value || null)
  .refine((value) => value === null || isHttpsUrl(value), { message: 'Use a full https:// link.' })

export const i18nTextSchema = z.object({
  fr: z.string().trim().max(6000),
  en: z.string().trim().max(6000),
  ar: z.string().trim().max(6000),
})

export const requiredFrenchI18nSchema = i18nTextSchema.refine((value) => value.fr.length > 0, {
  path: ['fr'],
  message: 'French content is required.',
})

export const aboutProfileSchema = z.object({
  fullName: z.string().trim().max(160).optional(),
  avatarUrl: urlOrPathSchema,
  availabilityStatus: z.enum(['available', 'limited', 'unavailable']),
  cvUrl: urlOrPathSchema,
  cvUrlFr: urlOrPathSchema,
  cvUrlEn: urlOrPathSchema,
  /** Cal.com, Calendly…: shown as "Book a call" on the freelance page. */
  bookingUrl: optionalHttpsUrlSchema.optional(),
  location: requiredFrenchI18nSchema,
  headline: requiredFrenchI18nSchema,
  bio: requiredFrenchI18nSchema,
})

export const socialLinkSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  platform: z.string().trim().min(1).max(80),
  label: z.string().trim().max(120).optional(),
  icon: z.string().trim().max(600).optional(),
  url: z.string().trim().url(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
})

export const skillCategorySchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  slug: z.string().trim().regex(slugPattern, 'Use lowercase letters, numbers, and hyphens.'),
  name: requiredFrenchI18nSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
})

export const SKILL_TYPES = ['technical', 'soft'] as const
export type SkillType = (typeof SKILL_TYPES)[number]

export const skillSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  skillType: z.enum(SKILL_TYPES).default('technical'),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(1).max(120),
  level: z.coerce.number().int().min(0).max(5).optional().or(z.literal('')),
  icon: z.string().trim().max(80).optional(),
  imageUrl: urlOrPathSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
})

export const languageSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: requiredFrenchI18nSchema,
  level: i18nTextSchema,
  icon: z.string().trim().max(80).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
})

export const faqItemSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  question: requiredFrenchI18nSchema,
  answer: requiredFrenchI18nSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
})

export const serviceSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  title: requiredFrenchI18nSchema,
  description: i18nTextSchema,
  includes: i18nTextSchema,
  // Whole euros; empty means "quote on request".
  priceFrom: z
    .union([z.literal(''), z.coerce.number().int().min(0).max(1_000_000)])
    .transform((value) => (value === '' ? null : value)),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
})

export const experienceSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  company: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  isCurrent: z.boolean().default(false),
  url: urlOrPathSchema,
  imageUrl: urlOrPathSchema,
  technologies: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
  translations: z.object({
    fr: z.object({ role: z.string().trim().min(1).max(200), description: z.string().trim().max(6000) }),
    en: z.object({ role: z.string().trim().max(200), description: z.string().trim().max(6000) }),
    ar: z.object({ role: z.string().trim().max(200), description: z.string().trim().max(6000) }),
  }),
})

export const educationSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  institution: z.string().trim().max(200).optional(),
  location: z.string().trim().max(160).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  imageUrl: urlOrPathSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
  translations: z.object({
    fr: z.object({
      degree: z.string().trim().min(1).max(220),
      field: z.string().trim().max(220),
      description: z.string().trim().max(6000),
    }),
    en: z.object({ degree: z.string().trim().max(220), field: z.string().trim().max(220), description: z.string().trim().max(6000) }),
    ar: z.object({ degree: z.string().trim().max(220), field: z.string().trim().max(220), description: z.string().trim().max(6000) }),
  }),
})

export const certificationSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  issuer: z.string().trim().max(200).optional(),
  issueDate: z.string().trim().optional(),
  credentialUrl: urlOrPathSchema,
  imageUrl: urlOrPathSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  status: statusSchema,
  translations: z.object({
    fr: z.object({ name: z.string().trim().min(1).max(220), description: z.string().trim().max(6000) }),
    en: z.object({ name: z.string().trim().max(220), description: z.string().trim().max(6000) }),
    ar: z.object({ name: z.string().trim().max(220), description: z.string().trim().max(6000) }),
  }),
})

export const designSettingsSchema = z.object({
  primaryColor: z.string().trim().optional().refine((value) => !value || hexColor.test(value), 'Use a hex color.'),
  accentColor: z.string().trim().optional().refine((value) => !value || hexColor.test(value), 'Use a hex color.'),
  defaultLocale: z.enum(LOCALES),
  defaultTheme: z.enum(['light', 'dark', 'system']),
  fontBody: z.enum([
    'space-grotesk',
    'archivo',
    'inter',
    'manrope',
    'outfit',
    'plus-jakarta',
    'sora',
    'urbanist',
    'jetbrains-mono',
    'playfair',
    'system',
  ]).optional().or(z.literal('')),
  fontHeading: z.enum([
    'archivo',
    'space-grotesk',
    'inter',
    'manrope',
    'outfit',
    'plus-jakarta',
    'sora',
    'urbanist',
    'jetbrains-mono',
    'playfair',
    'system',
  ]).optional().or(z.literal('')),
  cursorStyle: z.enum(['default', 'dot', 'minimal', 'ring', 'crosshair', 'grab', 'zoom', 'terminal']).optional().or(z.literal('')),
  headerPosition: z.enum(['bottom', 'left', 'right']).default('bottom'),
  navItems: z
    .array(z.enum([
      'home',
      'about',
      'skills',
      'experience',
      'education',
      'projects',
      'certifications',
      'github',
      'blog',
      'freelance',
      'contact',
      'login',
      'profile',
      'admin',
    ]))
    .default(DEFAULT_PUBLIC_NAV_ITEMS),
})

export const mediaUploadSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  alt: i18nTextSchema,
})
