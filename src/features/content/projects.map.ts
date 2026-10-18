import { pickTranslation, type Translated } from './translations'
import { LOCALES, type Locale } from '@/lib/validation/locale'

// Pure mapping from DB project rows to the localized view models consumed by
// the public ProjectsSection, the /projects index and the /projects/[slug]
// case-study page. No I/O — unit-testable without Supabase.

export interface ProjectStackItem {
  name: string
  icon: string | null
  imageUrl: string | null
}

export interface ProjectCardData {
  id: string
  /** URL segment of the case study: /[locale]/projects/<slug>. */
  slug: string
  title: string
  description: string | null
  image: string | null
  github: string | null
  demo: string | null
  featured: boolean
  // Stack names only (kept for backward compatibility / simple consumers).
  stack: string[]
  // Stack with optional icon metadata (linked skills carry an icon/image).
  stackItems: ProjectStackItem[]
  dateLabel: string | null
}

/** Everything the case-study page renders for one project. */
export interface ProjectDetailData extends ProjectCardData {
  /** Case study (Markdown) for the shown translation; null when not written yet. */
  bodyMarkdown: string | null
  /** `YYYY-MM-DD` start date, for `<time dateTime>` and JSON-LD. */
  startedAt: string | null
  /** ISO timestamp of the latest change (project or shown translation). */
  updatedAt: string | null
  /** Locale of the translation actually shown (may differ from the request). */
  contentLocale: Locale
  /** Locales that have their own translation (hreflang alternates). */
  availableLocales: Locale[]
}

interface TranslationInput {
  locale: string
  title: string
  description: string | null
  body_markdown?: string | null
  updated_at?: string | null
}

interface LinkedSkillInput {
  sort_order: number
  skills: {
    id: string
    name: string
    icon: string | null
    image_url: string | null
  } | null
}

export interface ProjectInput {
  id: string
  slug: string
  cover_image_url: string | null
  repo_url: string | null
  demo_url: string | null
  featured: boolean
  // Legacy free-text stack; used as a fallback when no skills are linked.
  tech_stack: string[]
  // Many-to-many linked technical skills (the preferred source of the stack).
  project_skills?: LinkedSkillInput[]
  started_at?: string | null
  updated_at?: string | null
  project_translations: TranslationInput[]
}

type LocalizedTranslation = TranslationInput & Translated

/** Month + year label for a `YYYY-MM-DD` date (UTC, so the month never shifts). */
export function formatProjectDate(startedAt: string | null | undefined, locale: Locale): string | null {
  if (!startedAt) return null
  const date = new Date(startedAt)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

/** Host shown in a cover's browser bar ("app.example.com"); null for a missing or non-web URL. */
export function projectHost(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return null
    return hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Split a comma-separated stack ("A, B" or Arabic "A، B") into trimmed names. */
export function parseStackList(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((name) => name.trim())
    .filter(Boolean)
}

function resolveStack(project: ProjectInput): ProjectStackItem[] {
  // Prefer linked technical skills (ordered by sort_order); fall back to the
  // legacy free-text tech_stack only when no skills are linked.
  const linked = (project.project_skills ?? [])
    .filter((link): link is LinkedSkillInput & { skills: NonNullable<LinkedSkillInput['skills']> } =>
      Boolean(link.skills),
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => ({
      name: link.skills.name,
      icon: link.skills.icon,
      imageUrl: link.skills.image_url,
    }))

  if (linked.length > 0) return linked
  return project.tech_stack.map((name) => ({ name, icon: null, imageUrl: null }))
}

function localizedTranslations(project: ProjectInput): LocalizedTranslation[] {
  return project.project_translations.filter((t): t is LocalizedTranslation =>
    (LOCALES as readonly string[]).includes(t.locale),
  )
}

export function toProjectCard(project: ProjectInput, locale: Locale): ProjectCardData {
  const tr = pickTranslation(localizedTranslations(project), locale)
  const stackItems = resolveStack(project)

  return {
    id: project.id,
    slug: project.slug,
    title: tr?.title ?? '',
    description: tr?.description ?? null,
    image: project.cover_image_url,
    github: project.repo_url,
    demo: project.demo_url,
    featured: project.featured,
    stack: stackItems.map((item) => item.name),
    stackItems,
    dateLabel: formatProjectDate(project.started_at, locale),
  }
}

/** Latest valid date among the inputs, as an ISO string (null when none). */
export function latestIsoDate(...values: (string | null | undefined)[]): string | null {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => !Number.isNaN(time))
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

/**
 * Case-study view model. The translation follows the site-wide policy
 * (requested locale, else default locale, else any); the case study always
 * comes from that same translation, so a page never mixes languages.
 */
export function toProjectDetail(project: ProjectInput, locale: Locale): ProjectDetailData {
  const translations = localizedTranslations(project)
  const tr = pickTranslation(translations, locale)
  const body = tr?.body_markdown?.trim()

  return {
    ...toProjectCard(project, locale),
    bodyMarkdown: body ? body : null,
    startedAt: project.started_at ?? null,
    updatedAt: latestIsoDate(project.updated_at, tr?.updated_at),
    contentLocale: tr?.locale ?? locale,
    availableLocales: LOCALES.filter((l) => translations.some((t) => t.locale === l && t.title.trim())),
  }
}

/** Rough Markdown -> plain text (for meta descriptions and summaries). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * One-paragraph summary of a project for meta descriptions and JSON-LD: the
 * description when set, else the first paragraph of the case study (headings
 * skipped), else an empty string.
 */
export function projectSummary(project: Pick<ProjectDetailData, 'description' | 'bodyMarkdown'>): string {
  const description = project.description?.trim()
  if (description) return description
  const firstParagraph = (project.bodyMarkdown ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !/^#{1,6}\s/.test(block))
  return firstParagraph ? markdownToPlainText(firstParagraph) : ''
}

/**
 * URLs of a case study: locale-less paths for every locale that has its own
 * translation (hreflang), and the locale whose URL is canonical for a request —
 * the requested one when translated, otherwise the language actually shown (so
 * `/en/projects/x` without an English translation canonicalizes to the French
 * URL instead of duplicating it).
 */
export function caseStudyUrls(
  project: Pick<ProjectDetailData, 'slug' | 'availableLocales' | 'contentLocale'>,
  requestedLocale: Locale,
): { path: string; localizedPaths: Partial<Record<Locale, string>>; canonicalLocale: Locale } {
  const path = `/projects/${project.slug}`
  const locales = project.availableLocales.length > 0 ? project.availableLocales : [project.contentLocale]
  const localizedPaths = Object.fromEntries(locales.map((l) => [l, path])) as Partial<Record<Locale, string>>
  const canonicalLocale = locales.includes(requestedLocale) ? requestedLocale : project.contentLocale
  return { path, localizedPaths, canonicalLocale }
}
