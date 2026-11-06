import type { PublicCmsContent } from '@/features/cms/queries'
import { FALLBACK_PROJECTS } from '@/features/content/projects.fallback'
import {
  caseStudyUrls,
  markdownToPlainText,
  parseStackList,
  projectSummary,
  toProjectDetail,
  type ProjectInput,
} from '@/features/content/projects.map'
import { pickTranslation } from '@/features/content/translations'
import { LOCALES, type Locale } from '@/lib/validation/locale'
import en from '../../../messages/en.json'
import {
  englishArticle,
  formatLanguages,
  normalizeAvailability,
  pickCoreStack,
  resolveRole,
  type ProfileAvailability,
} from './profile-summary'
import { FALLBACK_SAME_AS, PERSON, SITE_URL, absoluteUrl, isIndexable, isPublicProfileUrl, localePath } from './site'

// /llms.txt and /llms-full.txt (https://llmstxt.org): Markdown guides that tell
// AI assistants who Keltoum Malouki is and where the detail lives. Everything
// here is pure — data in, Markdown out — so the spec shape is unit-tested; the
// route handlers only inject the Supabase readers. Both documents are English
// (they link the French and Arabic versions of the site) and must never contain
// a phone number or other private data.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmsProfile {
  name: string
  givenName: string
  familyName: string
  /** Native-script spellings (Arabic), so both spellings resolve to one entity. */
  alternateNames: string[]
  role: string
  /** `City, Country`. */
  location: string
  /** Mobility note appended to the location ('' to omit). */
  mobility: string
  /** Bio as published in the About section (first person). */
  bio: string
  availability: ProfileAvailability
  email: string
  /** Site-relative or absolute URL of the CV PDF. */
  cvUrl: string
  /** Total number of projects as stated on the site (e.g. `50+`), '' to omit. */
  projectCount: string
}

export interface LlmsExperience {
  role: string
  company: string
  location: string
  date: string
  description: string
  technologies: string[]
  url: string
  isCurrent: boolean
}

export interface LlmsEducation {
  degree: string
  field: string
  institution: string
  location: string
  date: string
  description: string
}

export interface LlmsSkillGroup {
  name: string
  skills: string[]
}

export interface LlmsCertification {
  name: string
  issuer: string
  date: string
  description: string
  url: string
}

export interface LlmsLanguage {
  name: string
  level: string
}

export interface LlmsService {
  title: string
  description: string
}

export interface LlmsProject {
  slug: string
  title: string
  description: string
  /** Full case study (Markdown); null/absent when not written yet. */
  bodyMarkdown?: string | null
  /** Language the case study text is written in. Defaults to English. */
  bodyLocale?: Locale
  /** Locale whose URL is canonical for this case study. Defaults to English. */
  locale?: Locale
  /** Locales with their own translation. Defaults to every locale. */
  availableLocales?: Locale[]
  repoUrl: string | null
  demoUrl: string | null
  stack: string[]
  /** Display date (e.g. `Dec 2025`). */
  date: string | null
}

export interface LlmsArticleTranslation {
  locale: Locale
  slug: string
  title: string
}

export interface LlmsArticle {
  /** Locale of the translation listed (English when available). */
  locale: Locale
  slug: string
  title: string
  excerpt: string | null
  publishedAt?: string | null
  /** Every published translation (for the other-language links). */
  translations?: LlmsArticleTranslation[]
}

export interface LlmsLink {
  label: string
  url: string
  description: string
}

export interface LlmsData {
  profile: LlmsProfile
  experiences: LlmsExperience[]
  education: LlmsEducation[]
  skills: LlmsSkillGroup[]
  softSkills: string[]
  certifications: LlmsCertification[]
  languages: LlmsLanguage[]
  services: LlmsService[]
  /** Project types offered on the freelance inquiry form. */
  projectTypes: string[]
  projects: LlmsProject[]
  articles: LlmsArticle[]
  /** Public profiles elsewhere (GitHub, LinkedIn, …). */
  links: LlmsLink[]
}

/** The published CMS fields these documents use (`getPublishedCmsContent('en')`). */
export type LlmsCmsInput = Partial<
  Pick<
    PublicCmsContent,
    | 'about'
    | 'socialLinks'
    | 'skillCategories'
    | 'softSkills'
    | 'experiences'
    | 'education'
    | 'certifications'
    | 'languages'
  >
>

/** Article row shape read from Supabase (`getPublishedArticles()`). */
export interface LlmsArticleRow {
  published_at?: string | null
  status?: string | null
  article_translations?: { locale: string; slug: string; title: string; excerpt: string | null }[] | null
}

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

const LOCALE_NAMES: Record<Locale, string> = { fr: 'French', en: 'English', ar: 'Arabic' }
/** Language these documents are written in. */
const DOC_LOCALE: Locale = 'en'

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/** Single line, for list notes and link text. */
export function oneLine(value: string | null | undefined): string {
  return clean(value)
}

/** Ensure a sentence ends with terminal punctuation. */
function sentence(value: string): string {
  const text = clean(value)
  if (!text) return ''
  return /[.!?…:)]$/.test(text) ? text : `${text}.`
}

/** Markdown link text: one line, brackets and backslashes escaped. */
export function escapeLinkText(value: string): string {
  return oneLine(value).replace(/([\\[\]])/g, '\\$1')
}

/** URL safe inside `[text](url)`: no raw spaces, parentheses or angle brackets. */
export function markdownUrl(url: string): string {
  return url
    .trim()
    .replace(/ /g, '%20')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
}

/** `- [Title](url): notes` — one llms.txt "file list" entry. */
export function linkItem(title: string, url: string, notes?: string): string {
  const text = oneLine(notes)
  return `- [${escapeLinkText(title)}](${markdownUrl(url)})${text ? `: ${text}` : ''}`
}

/** `A`, `A and B`, `A, B and C`. */
export function joinAnd(items: readonly string[]): string {
  const list = items.map(clean).filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** Absolute URL of a public page in a given locale (`/en/about`). */
function pageUrl(locale: Locale, path = '/'): string {
  return absoluteUrl(localePath(locale, path))
}

/** URL-safe path segment (same rule as the sitemap). */
function segment(slug: string): string {
  return encodeURIComponent(slug.trim())
}

function caseStudyUrl(project: LlmsProject, locale: Locale = project.locale ?? DOC_LOCALE): string {
  return pageUrl(locale, `/projects/${segment(project.slug)}`)
}

function articleUrl(locale: Locale, slug: string): string {
  return pageUrl(locale, `/blog/${segment(slug)}`)
}

function siteHost(): string {
  return SITE_URL.replace(/^https?:\/\//i, '')
}

// ---------------------------------------------------------------------------
// Privacy guard
// ---------------------------------------------------------------------------

/**
 * Remove phone numbers (defence in depth: the CMS could hold one in free text).
 * Matches international numbers (`+212 6…`, `00212…`) and Moroccan national
 * numbers (`06 12 34 56 78`), but not years, date ranges or ISO dates.
 */
export function redactPhoneNumbers(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\(\s*tel:[^)]*\)/gi, '$1')
    .replace(/\btel:\S*/gi, '')
    .replace(/(?<![\w/=])(?:\+|00)\d{1,3}(?:[ \t.()-]*\d){8,12}(?!\d)/g, '[phone number removed]')
    .replace(/(?<![\w/=.-])0[5-7](?:[ \t.-]?\d{2}){4}(?!\w)/g, '[phone number removed]')
}

// ---------------------------------------------------------------------------
// Embedded Markdown (case studies, free text)
// ---------------------------------------------------------------------------

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const ATX = /^( {0,3})(#{1,6})(?=[ \t]|$)(.*)$/
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/
const SETEXT_H2 = /^ {0,3}-{2,}[ \t]*$/
/**
 * A plain paragraph line (could carry a setext underline): not blank, not
 * indented code, and not an ATX heading, blockquote, table row or list item.
 */
const PARAGRAPH = /^ {0,3}(?!#{1,6}(?:[ \t]|$)|>|\||[*+-](?:[ \t]|$)|\d{1,9}[.)](?:[ \t]|$))\S/

/** Absolute URLs for root-relative inline links/images and reference definitions. */
function absolutizeLine(line: string): string {
  return line
    .replace(/\]\(\s*(\/(?!\/)[^)\s]*)/g, (_match, path: string) => `](${absoluteUrl(path)}`)
    .replace(/^( {0,3}\[[^\]]+\]:[ \t]*)(\/(?!\/)\S*)/, (_match, head: string, path: string) => `${head}${absoluteUrl(path)}`)
}

/**
 * Embed a Markdown document inside this one: headings are shifted so the
 * shallowest becomes `minLevel` (capped at H6, setext headings converted to
 * ATX), root-relative links become absolute, and fenced code is left untouched.
 * Guarantees the embedded text never adds an H1/H2 to the outer document.
 */
export function embedMarkdown(markdown: string, minLevel: number): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')

  // Pass 1: find headings (ATX + setext) outside code fences.
  type Heading = { index: number; level: number; text: string; underline?: boolean }
  const headings: Heading[] = []
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = FENCE.exec(line)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      continue
    }
    const atx = ATX.exec(line)
    if (atx) {
      headings.push({ index: i, level: atx[2].length, text: atx[3].replace(/[ \t]+#+[ \t]*$/, '').trim() })
      continue
    }
    const previous = i > 0 ? lines[i - 1] : ''
    const previousIsHeading = headings.some((heading) => heading.index === i - 1)
    if (
      !previousIsHeading &&
      !FENCE.test(previous) &&
      PARAGRAPH.test(previous) &&
      (SETEXT_H1.test(line) || SETEXT_H2.test(line))
    ) {
      headings.push({ index: i, level: SETEXT_H1.test(line) ? 1 : 2, text: previous.trim(), underline: true })
    }
  }

  const top = headings.length ? Math.min(...headings.map((heading) => heading.level)) : minLevel
  const shift = Math.max(0, minLevel - top)
  const byIndex = new Map(headings.map((heading) => [heading.index, heading]))

  // Pass 2: rewrite.
  const out: string[] = []
  fence = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = FENCE.exec(line)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null
      out.push(line)
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      out.push(line)
      continue
    }
    const heading = byIndex.get(i)
    if (heading) {
      const level = Math.min(6, Math.max(minLevel, heading.level + shift))
      const text = absolutizeLine(heading.text)
      const atx = `${'#'.repeat(level)}${text ? ` ${text}` : ''}`
      if (heading.underline) out[out.length - 1] = atx
      else out.push(atx)
      continue
    }
    out.push(absolutizeLine(line))
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Free text (bio, descriptions): neutralize anything that would read as a heading. */
function textBlock(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .map((line) => line.replace(/^( {0,3})(#{1,6})(?=[ \t]|$)/, '$1\\$2'))
    .map((line) => (SETEXT_H1.test(line) || SETEXT_H2.test(line) ? '' : line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function quoteBlock(value: string): string {
  return textBlock(value)
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')
}

// ---------------------------------------------------------------------------
// Static facts (used whenever the CMS is empty or unreachable)
// ---------------------------------------------------------------------------

/** Location in `City, Country` form — the canonical place for every document. */
const LOCATION = `${PERSON.address.locality}, ${PERSON.address.countryName}`

/** `DabaDoc — Casablanca, Morocco` -> company + location. */
function splitCompany(value: string): { company: string; location: string } {
  const [company, ...rest] = value.split(/\s+[—–]\s+/)
  return { company: clean(company), location: clean(rest.join(' — ')) }
}

/** `Arabic (Native)` -> { name: 'Arabic', level: 'Native' }. */
function parseLanguageLabel(value: string): LlmsLanguage {
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(value)
  return match ? { name: clean(match[1]), level: clean(match[2]) } : { name: clean(value), level: '' }
}

/** Technical skills by category, mirroring supabase/seed.sql and the CV. */
const FALLBACK_SKILL_GROUPS: { category: keyof typeof en.skills.categories; skills: string[] }[] = [
  { category: 'languages', skills: ['C', 'HTML5', 'CSS3', 'SQL', 'NoSQL', 'JavaScript', 'TypeScript', 'PHP'] },
  {
    category: 'frameworks',
    skills: ['Laravel', 'Node.js', 'React', 'Next.js', 'Express.js', 'NestJS', 'Ruby on Rails', 'Angular', 'Tailwind CSS', 'GraphQL'],
  },
  { category: 'devops', skills: ['Docker', 'CI/CD (GitHub Actions, GitLab)'] },
  { category: 'databases', skills: ['MySQL', 'PostgreSQL', 'MongoDB'] },
  { category: 'management', skills: ['Agile', 'Jira'] },
  { category: 'modeling', skills: ['Merise', 'UML'] },
  { category: 'versioning', skills: ['Git', 'GitHub', 'GitLab'] },
  { category: 'design', skills: ['Figma', 'Canva', 'Adobe XD'] },
]

/** Services, worded as on the /about page ("What I do"). */
export const LLMS_SERVICES: readonly LlmsService[] = [
  {
    title: 'Full-stack web development',
    description:
      'Complete web applications, from the interface to the database: React, Next.js and Angular on the front end, NestJS, Laravel and Ruby on Rails on the back end, with PostgreSQL, MySQL or MongoDB.',
  },
  {
    title: 'Backend & API development',
    description:
      'REST and GraphQL APIs, data modelling with Merise and UML, server-side integrations, and containerised delivery with Docker and CI/CD pipelines (GitHub Actions, GitLab).',
  },
  {
    title: 'Responsive UI & UX integration',
    description:
      'Responsive, accessible interfaces built from Figma or Adobe XD designs with Tailwind CSS, shadcn/ui, GSAP and Framer Motion.',
  },
]

/** Featured projects from the static fallback (same slugs as the database). */
export function fallbackLlmsProjects(): LlmsProject[] {
  return FALLBACK_PROJECTS.map((project) => {
    const item = en.projects.items[project.messageKey]
    return {
      slug: project.slug,
      title: item.title,
      description: item.description,
      bodyMarkdown: null,
      bodyLocale: DOC_LOCALE,
      locale: DOC_LOCALE,
      availableLocales: [...LOCALES],
      repoUrl: project.github,
      demoUrl: project.demo,
      stack: parseStackList(item.stack),
      date: item.date,
    }
  })
}

/** Everything these documents say when no CMS data is available. */
export function staticLlmsData(): LlmsData {
  return {
    profile: {
      name: en.hero.name,
      givenName: PERSON.givenName,
      familyName: PERSON.familyName,
      alternateNames: [...PERSON.alternateName],
      role: en.hero.role,
      location: LOCATION,
      mobility: 'open to mobility and relocation',
      bio: en.about.description,
      availability: 'available',
      email: PERSON.email,
      cvUrl: '/cv.pdf',
      projectCount: '50+',
    },
    experiences: Object.values(en.experience.items).map((item) => {
      const { company, location } = splitCompany(item.company)
      return {
        role: item.title,
        company,
        location,
        date: item.date,
        description: item.description,
        technologies: parseStackList(item.stack),
        url: '',
        isCurrent: /present/i.test(item.date),
      }
    }),
    education: Object.values(en.education.items).map((item) => {
      const { company: institution, location } = splitCompany(item.school)
      return { degree: item.title, field: '', institution, location, date: item.date, description: item.description }
    }),
    skills: FALLBACK_SKILL_GROUPS.map((group) => ({ name: en.skills.categories[group.category], skills: [...group.skills] })),
    softSkills: Object.values(en.softSkills.items),
    certifications: Object.values(en.certifications.items).map((item) => ({
      name: item.title,
      issuer: item.issuer,
      date: item.date,
      description: item.description,
      url: '',
    })),
    languages: [en.languages.arabic, en.languages.french, en.languages.english].map(parseLanguageLabel),
    services: LLMS_SERVICES.map((service) => ({ ...service })),
    projectTypes: Object.entries(en.freelance.options.projectType)
      .filter(([key]) => key !== 'other')
      .map(([, label]) => label),
    projects: fallbackLlmsProjects(),
    articles: [],
    links: FALLBACK_SAME_AS.map((url) => profileLink(url, '')),
  }
}

// ---------------------------------------------------------------------------
// Sources -> data
// ---------------------------------------------------------------------------

function platformOf(url: string, platform = ''): string {
  const declared = platform.toLowerCase()
  if (declared && declared !== 'website' && declared !== 'other') return declared
  if (/github\.com/i.test(url)) return 'github'
  if (/linkedin\.com/i.test(url)) return 'linkedin'
  return declared || 'website'
}

const PLATFORM_LABELS: Record<string, string> = { github: 'GitHub', linkedin: 'LinkedIn' }

function profileLink(url: string, label: string, platform = ''): LlmsLink {
  const kind = platformOf(url, platform)
  const name = clean(label) || PLATFORM_LABELS[kind] || clean(platform) || url.replace(/^https?:\/\/(www\.)?/i, '')
  const description =
    kind === 'github'
      ? `Source code and repositories of ${PERSON.name}.`
      : kind === 'linkedin'
        ? `Professional profile and work history of ${PERSON.name}.`
        : `${name} profile of ${PERSON.name}.`
  return { label: name, url: url.trim(), description }
}

function urlKey(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
}

function resolveLinks(cms: LlmsCmsInput | null | undefined): LlmsLink[] {
  const fromCms = (cms?.socialLinks ?? [])
    .filter((link) => isPublicProfileUrl(link.url ?? ''))
    .map((link) => profileLink(link.url, link.label, link.platform))
  const links = fromCms.length > 0 ? fromCms : FALLBACK_SAME_AS.map((url) => profileLink(url, ''))
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = urlKey(link.url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const EMAIL = /^[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[^\s@<>()[\]]+$/

function resolveEmail(cms: LlmsCmsInput | null | undefined): string {
  const fromCms = (cms?.socialLinks ?? [])
    .map((link) => link.url ?? '')
    .find((url) => url.toLowerCase().startsWith('mailto:'))
    ?.replace(/^mailto:/i, '')
    .split('?')[0]
    .trim()
  return fromCms && EMAIL.test(fromCms) ? fromCms : PERSON.email
}

/** A published project row -> llms entry (null when it has no usable title). */
export function llmsProjectFromRow(row: ProjectInput): LlmsProject | null {
  if (!clean(row.slug)) return null
  const detail = toProjectDetail(row, DOC_LOCALE)
  if (!clean(detail.title)) return null
  // Read defensively: older rows (or list reads) have no `body_markdown`.
  const body = clean(detail.bodyMarkdown) ? (detail.bodyMarkdown ?? '').trim() : null
  return {
    slug: row.slug.trim(),
    title: clean(detail.title),
    description: clean(projectSummary(detail)),
    bodyMarkdown: body,
    bodyLocale: detail.contentLocale,
    locale: caseStudyUrls(detail, DOC_LOCALE).canonicalLocale,
    availableLocales: detail.availableLocales,
    repoUrl: clean(row.repo_url) || null,
    demoUrl: clean(row.demo_url) || null,
    stack: detail.stack.map(clean).filter(Boolean),
    date: detail.dateLabel,
  }
}

/** A published article row -> llms entry (English translation preferred). */
export function llmsArticleFromRow(row: LlmsArticleRow): LlmsArticle | null {
  if (row.status && row.status !== 'published') return null
  const translations = (row.article_translations ?? [])
    .filter((t) => isLocale(t.locale) && clean(t.slug) && clean(t.title))
    .map((t) => ({ locale: t.locale as Locale, slug: t.slug.trim(), title: clean(t.title), excerpt: t.excerpt }))
  const picked = pickTranslation(translations, DOC_LOCALE)
  if (!picked) return null
  return {
    locale: picked.locale,
    slug: picked.slug,
    title: picked.title,
    excerpt: clean(picked.excerpt) || null,
    publishedAt: row.published_at ?? null,
    translations: LOCALES.flatMap((locale) => {
      const t = translations.find((item) => item.locale === locale)
      return t ? [{ locale, slug: t.slug, title: t.title }] : []
    }),
  }
}

export interface LlmsSources {
  cms?: LlmsCmsInput | null
  /** Mapped published projects; empty -> the static featured projects. */
  projects?: LlmsProject[]
  articles?: LlmsArticle[]
}

/**
 * Merge published content with the static facts. The CMS is authoritative for
 * every collection it publishes rows for; static facts fill whatever is empty,
 * so the documents never say less than the site does.
 */
export function resolveLlmsData(sources: LlmsSources = {}): LlmsData {
  const base = staticLlmsData()
  const cms = sources.cms ?? null
  const about = cms?.about

  const experiences = (cms?.experiences ?? [])
    .map((item) => ({
      role: clean(item.role),
      company: clean(item.company),
      location: clean(item.location),
      date: clean(item.date),
      description: item.description ?? '',
      technologies: (item.technologies ?? []).map(clean).filter(Boolean),
      url: isPublicProfileUrl(item.url ?? '') ? item.url.trim() : '',
      isCurrent: Boolean(item.isCurrent),
    }))
    .filter((item) => item.role || item.company)

  const education = (cms?.education ?? [])
    .map((item) => ({
      degree: clean(item.degree),
      field: clean(item.field),
      institution: clean(item.institution),
      location: clean(item.location),
      date: clean(item.date),
      description: item.description ?? '',
    }))
    .filter((item) => item.degree || item.institution)

  const skills = (cms?.skillCategories ?? [])
    .map((category) => ({ name: clean(category.name), skills: category.skills.map((skill) => clean(skill.name)).filter(Boolean) }))
    .filter((group) => group.name && group.skills.length > 0)

  const softSkills = (cms?.softSkills ?? []).map((skill) => clean(skill.name)).filter(Boolean)

  const certifications = (cms?.certifications ?? [])
    .map((item) => ({
      name: clean(item.name),
      issuer: clean(item.issuer),
      date: formatIssueDate(item.issueDate),
      description: item.description ?? '',
      url: isPublicProfileUrl(item.credentialUrl ?? '') ? item.credentialUrl.trim() : '',
    }))
    .filter((item) => item.name)

  const languages = (cms?.languages ?? [])
    .map((language) => ({ name: clean(language.name), level: clean(language.level) }))
    .filter((language) => language.name)

  const projects = dedupeBySlug(sources.projects ?? [])

  return {
    profile: {
      ...base.profile,
      name: clean(about?.fullName) || base.profile.name,
      role: resolveRole(about?.headline, base.profile.role),
      bio: clean(about?.bio) ? (about?.bio ?? '').trim() : base.profile.bio,
      availability: about ? normalizeAvailability(about.availabilityStatus) : base.profile.availability,
      email: resolveEmail(cms),
      cvUrl: clean(about?.cvUrl) || base.profile.cvUrl,
    },
    experiences: experiences.length ? experiences : base.experiences,
    education: education.length ? education : base.education,
    skills: skills.length ? skills : base.skills,
    softSkills: softSkills.length ? softSkills : base.softSkills,
    certifications: certifications.length ? certifications : base.certifications,
    languages: languages.length ? languages : base.languages,
    services: base.services,
    projectTypes: base.projectTypes,
    // Same rule as the site: the static featured projects only when the
    // database lists no published project at all.
    projects: projects.length ? projects : base.projects,
    articles: sources.articles ?? [],
    links: resolveLinks(cms),
  }
}

function dedupeBySlug(projects: readonly LlmsProject[]): LlmsProject[] {
  const seen = new Set<string>()
  return projects.filter((project) => {
    const key = project.slug.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** `2025-03-01` -> `Mar 2025`; anything else is kept as written. */
function formatIssueDate(value: string | null | undefined): string {
  const text = clean(value)
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

// ---------------------------------------------------------------------------
// Shared copy
// ---------------------------------------------------------------------------

function currentExperience(data: LlmsData): LlmsExperience | undefined {
  return data.experiences.find((item) => item.isCurrent && item.role && item.company)
}

function coreStack(data: LlmsData): string[] {
  return pickCoreStack(data.skills.flatMap((group) => group.skills))
}

function displayName(profile: LlmsProfile): string {
  const alternates = profile.alternateNames.map(clean).filter(Boolean)
  return alternates.length ? `${profile.name} (Arabic script: ${alternates.join(', ')})` : profile.name
}

function locationWithMobility(profile: LlmsProfile): string {
  return profile.mobility ? `${profile.location} (${profile.mobility})` : profile.location
}

/** "Keltoum Malouki is a Full Stack Web Developer based in Casablanca, Morocco, currently …" */
export function identitySentence(data: LlmsData): string {
  const { profile } = data
  const base = `${profile.name} is ${englishArticle(profile.role)} ${profile.role} based in ${profile.location}`
  const current = currentExperience(data)
  return current
    ? `${base}, currently working as ${englishArticle(current.role)} ${current.role} at ${current.company}.`
    : `${base}.`
}

function craftSentence(data: LlmsData): string {
  const stack = coreStack(data).slice(0, 6)
  const tools = stack.length ? `, working with ${joinAnd(stack)}` : ''
  return `${data.profile.givenName} builds complete web applications, from front-end interfaces to back-end APIs and databases${tools}.`
}

function availabilitySentence(profile: LlmsProfile): string {
  switch (profile.availability) {
    case 'limited':
      return `${profile.givenName} currently has limited availability but still welcomes freelance projects and new opportunities.`
    case 'unavailable':
      return `${profile.givenName} is not taking on new projects at the moment.`
    default:
      return `${profile.givenName} is open to freelance projects and new opportunities, including relocation.`
  }
}

function experienceTitle(item: LlmsExperience): string {
  return [item.role, item.company].filter(Boolean).join(' at ')
}

function educationTitle(item: LlmsEducation): string {
  return [item.degree, item.institution].filter(Boolean).join(', ')
}

function languageVersions(path = '/'): string {
  return joinAnd(
    LOCALES.map((locale) => `${LOCALE_NAMES[locale]} (${pageUrl(locale, path)}${locale === 'fr' ? ', default language' : ''})`),
  )
}

function otherLocales(project: LlmsProject): Locale[] {
  const canonical = project.locale ?? DOC_LOCALE
  return (project.availableLocales ?? [...LOCALES]).filter((locale) => locale !== canonical)
}

function finalize(markdown: string): string {
  const text = redactPhoneNumbers(markdown)
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return `${text}\n`
}

function section(title: string, items: string[]): string[] {
  return items.length ? [`## ${title}`, '', ...items, ''] : []
}

// ---------------------------------------------------------------------------
// /llms.txt
// ---------------------------------------------------------------------------

/** One-paragraph summary used as the blockquote of both documents. */
export function llmsSummary(data: LlmsData): string {
  return [
    identitySentence(data),
    craftSentence(data),
    `This is the official guide for AI assistants to ${siteHost()}, the portfolio website of ${data.profile.name}.`,
  ].join(' ')
}

function keyFacts(data: LlmsData): string[] {
  const { profile } = data
  const current = currentExperience(data)
  const school = data.education[0]
  const stack = coreStack(data)
  const languages = formatLanguages(data.languages, 'en')
  const facts = [
    `Name: ${displayName(profile)}`,
    `Role: ${profile.role}`,
    `Based in: ${locationWithMobility(profile)}`,
    current
      ? `Current position: ${experienceTitle(current)}${current.location ? ` (${current.location})` : ''}${current.date ? `; dates: ${current.date}` : ''}`
      : '',
    school ? `Education: ${educationTitle(school)}${school.date ? ` (${school.date})` : ''}` : '',
    stack.length ? `Core stack: ${stack.join(', ')}` : '',
    languages ? `Languages: ${languages}` : '',
    profile.projectCount ? `Projects: ${profile.projectCount} completed; selected case studies are listed below` : '',
    `Availability: ${availabilitySentence(profile)}`,
    `Email: ${profile.email}`,
    `Official website: ${SITE_URL}, in ${languageVersions()}. This file is in English.`,
  ]
  return facts.filter(Boolean).map((fact) => `- ${oneLine(fact)}`)
}

function projectNotes(project: LlmsProject): string {
  const stack = project.stack.length ? `Tech stack: ${project.stack.join(', ')}.` : ''
  const date = project.date ? `Date: ${project.date}.` : ''
  const language =
    (project.locale ?? DOC_LOCALE) !== DOC_LOCALE ? `Case study in ${LOCALE_NAMES[project.locale ?? DOC_LOCALE]}.` : ''
  const source = project.repoUrl ? `Source code: ${project.repoUrl}` : ''
  return [sentence(project.description), stack, date, language, source].filter(Boolean).join(' ')
}

export function buildLlmsTxt(data: LlmsData): string {
  const { profile } = data
  const name = profile.name
  const services = data.services.map((service) => oneLine(service.title)).filter(Boolean)

  const profileItems = [
    linkItem(`About ${name}`, pageUrl('en', '/about'), 'Full profile in English: background, experience, education, skills, certifications, GitHub activity, languages and frequently asked questions.'),
    linkItem(`About ${name} (French version)`, pageUrl('fr', '/about'), 'The same profile in French, the default language of the site.'),
    linkItem(`About ${name} (Arabic version)`, pageUrl('ar', '/about'), 'The same profile in Arabic.'),
    linkItem(`CV of ${name} (PDF)`, absoluteUrl(profile.cvUrl), 'Downloadable CV: experience, education, skills, projects, certifications and languages.'),
    linkItem('Homepage', pageUrl('en'), `English homepage: profile summary, key facts, experience, featured projects, reviews and contact form.`),
  ]

  const caseStudies = [
    ...data.projects.map((project) => linkItem(project.title, caseStudyUrl(project), projectNotes(project))),
    linkItem('All projects', pageUrl('en', '/projects'), `Index of the case studies published by ${name}.`),
  ]

  const writing = data.articles.length
    ? [
        ...data.articles.map((article) =>
          linkItem(
            article.title,
            articleUrl(article.locale, article.slug),
            [article.excerpt ? sentence(article.excerpt) : '', article.locale !== DOC_LOCALE ? `Written in ${LOCALE_NAMES[article.locale]}.` : '']
              .filter(Boolean)
              .join(' '),
          ),
        ),
        linkItem('Blog', pageUrl('en', '/blog'), `All articles and technical notes by ${name}.`),
      ]
    : []

  const work = [
    linkItem(
      `Hire ${name}`,
      pageUrl('en', '/freelance'),
      [
        'Freelance and contract work, with a project inquiry form and answers to common client questions.',
        services.length ? `Services: ${services.join('; ')}.` : '',
        `Also in French (${pageUrl('fr', '/freelance')}) and Arabic (${pageUrl('ar', '/freelance')}).`,
      ]
        .filter(Boolean)
        .join(' '),
    ),
    linkItem(`Email ${name}`, `mailto:${profile.email}`, `${profile.email}, for job opportunities and project inquiries.`),
  ]

  const elsewhere = data.links.map((link) => linkItem(link.label, link.url, link.description))

  const optional = [
    linkItem('Complete profile (llms-full.txt)', absoluteUrl('/llms-full.txt'), 'Everything in one Markdown file: experience, education, skills, certifications, languages, services and full case-study text.'),
    linkItem('Sitemap', absoluteUrl('/sitemap.xml'), 'Every public page of the site in French, English and Arabic.'),
    linkItem('French homepage', pageUrl('fr'), 'The site in French, its default language.'),
    linkItem('Arabic homepage', pageUrl('ar'), 'The site in Arabic (right-to-left).'),
  ]

  return finalize(
    [
      `# ${name}`,
      '',
      `> ${oneLine(llmsSummary(data))}`,
      '',
      'Key facts:',
      '',
      ...keyFacts(data),
      '',
      ...section('Profile', profileItems),
      ...section('Case studies', caseStudies),
      ...section('Writing', writing),
      ...section(`Work with ${profile.givenName}`, work),
      ...section('Elsewhere', elsewhere),
      ...section('Optional', optional),
    ].join('\n'),
  )
}

// ---------------------------------------------------------------------------
// /llms-full.txt
// ---------------------------------------------------------------------------

function bullet(label: string, value: string | null | undefined): string {
  const text = oneLine(value)
  return text ? `- ${label}: ${text}` : ''
}

function block(...lines: (string | null | undefined | false)[]): string[] {
  return lines.filter((line): line is string => typeof line === 'string' && line.length > 0)
}

function fullProject(project: LlmsProject): string[] {
  const canonical = project.locale ?? DOC_LOCALE
  const others = otherLocales(project)
  const body = clean(project.bodyMarkdown) ? embedMarkdown(project.bodyMarkdown ?? '', 4) : ''
  const bodyLocale = project.bodyLocale ?? DOC_LOCALE
  const lines = [
    `### ${oneLine(project.title)}`,
    '',
    ...block(
      bullet(`Case study${canonical !== DOC_LOCALE ? ` (${LOCALE_NAMES[canonical]})` : ''}`, caseStudyUrl(project)),
      others.length
        ? bullet('Other languages', others.map((locale) => `${LOCALE_NAMES[locale]}: ${caseStudyUrl(project, locale)}`).join('; '))
        : '',
      bullet('Date', project.date),
      bullet('Tech stack', project.stack.join(', ')),
      bullet('Source code', project.repoUrl),
      bullet('Live demo', project.demoUrl),
    ),
    '',
  ]
  // Skip the summary when it is just the case study's first paragraph.
  const summary = clean(project.description)
  if (summary && !(body && clean(markdownToPlainText(body)).includes(summary))) {
    lines.push(textBlock(sentence(summary)), '')
  }
  if (body) {
    lines.push(
      bodyLocale === DOC_LOCALE
        ? 'Full case study:'
        : `Full case study (published in ${LOCALE_NAMES[bodyLocale]}; no English version yet):`,
      '',
      body,
      '',
    )
  }
  return lines
}

export function buildLlmsFullTxt(data: LlmsData, options: { generatedAt?: Date } = {}): string {
  const { profile } = data
  const name = profile.name
  const generated = (options.generatedAt ?? new Date()).toISOString().slice(0, 10)
  const current = currentExperience(data)
  const stack = coreStack(data)

  const identity = block(
    bullet('Full name', name),
    bullet('Name in Arabic script', profile.alternateNames.join(', ')),
    bullet('Given name', profile.givenName),
    bullet('Family name', profile.familyName),
    bullet('Profession', profile.role),
    bullet('Based in', locationWithMobility(profile)),
    current ? bullet('Current position', experienceTitle(current)) : '',
    bullet('Availability', availabilitySentence(profile)),
    bullet('Email', profile.email),
    bullet('Website', SITE_URL),
    ...data.links.map((link) => bullet(link.label, link.url)),
  )

  const summary = [
    [identitySentence(data), craftSentence(data), availabilitySentence(profile)].join(' '),
    '',
    ...(clean(profile.bio) ? [`In ${profile.givenName}'s own words, from the About section of the website:`, '', quoteBlock(profile.bio), ''] : []),
  ]

  const currentRole = current
    ? [
        `${name} currently works as ${englishArticle(current.role)} ${current.role} at ${current.company}${current.location ? ` (${current.location})` : ''}.${current.date ? ` Dates: ${current.date}.` : ''}`,
        '',
        ...(textBlock(current.description) ? [textBlock(current.description), ''] : []),
        ...(current.technologies.length ? [`Technologies: ${current.technologies.join(', ')}.`, ''] : []),
      ]
    : [`No current position is listed. ${availabilitySentence(profile)}`, '']

  const experience = data.experiences.flatMap((item) => [
    `### ${oneLine(experienceTitle(item))}`,
    '',
    ...block(
      bullet('Role', item.role),
      bullet('Company', item.company),
      bullet('Location', item.location),
      bullet('Dates', item.date),
      item.isCurrent ? '- Current position: yes' : '',
      bullet('Technologies', item.technologies.join(', ')),
      bullet('Company website', item.url),
    ),
    '',
    ...(textBlock(item.description) ? [textBlock(item.description), ''] : []),
  ])

  const education = data.education.flatMap((item) => [
    `### ${oneLine(educationTitle(item))}`,
    '',
    ...block(
      bullet('Program', item.degree),
      bullet('Field', item.field),
      bullet('Institution', item.institution),
      bullet('Location', item.location),
      bullet('Dates', item.date),
    ),
    '',
    ...(textBlock(item.description) ? [textBlock(item.description), ''] : []),
  ])

  const skills = [
    ...(stack.length ? [`Core stack: ${stack.join(', ')}.`, ''] : []),
    'Technical skills by category:',
    '',
    ...data.skills.map((group) => `- ${oneLine(group.name)}: ${group.skills.map(oneLine).join(', ')}`),
    ...(data.softSkills.length ? ['', `Soft skills: ${data.softSkills.map(oneLine).join(', ')}.`] : []),
    '',
  ]

  const certifications = data.certifications.flatMap((item) => [
    `### ${oneLine(item.name)}`,
    '',
    ...block(bullet('Issuer', item.issuer), bullet('Date', item.date), bullet('Credential', item.url)),
    '',
    ...(textBlock(item.description) ? [textBlock(item.description), ''] : []),
  ])

  const languages = data.languages.map((language) =>
    language.level ? `- ${oneLine(language.name)}: ${oneLine(language.level)}` : `- ${oneLine(language.name)}`,
  )

  const services = [
    ...data.services.map((service) => `- ${oneLine(service.title)}: ${oneLine(service.description)}`),
    '',
    ...(data.projectTypes.length
      ? [`Project types accepted through the freelance inquiry form: ${data.projectTypes.map(oneLine).join(', ')}.`, '']
      : []),
    `Freelance and contract inquiries: ${pageUrl('en', '/freelance')} (also in French: ${pageUrl('fr', '/freelance')}; Arabic: ${pageUrl('ar', '/freelance')}), or email ${profile.email}.`,
    '',
  ]

  const projects = [
    profile.projectCount
      ? `${name} has completed ${profile.projectCount} projects. The case studies published on the website are below; the index is at ${pageUrl('en', '/projects')}.`
      : `The case studies published on the website are below; the index is at ${pageUrl('en', '/projects')}.`,
    '',
    ...data.projects.flatMap(fullProject),
  ]

  const writing = data.articles.flatMap((article) => {
    const others = (article.translations ?? []).filter((t) => t.locale !== article.locale)
    return [
      `### ${oneLine(article.title)}`,
      '',
      ...block(
        bullet(`URL (${LOCALE_NAMES[article.locale]})`, articleUrl(article.locale, article.slug)),
        others.length
          ? bullet('Other languages', others.map((t) => `${LOCALE_NAMES[t.locale]}: ${articleUrl(t.locale, t.slug)}`).join('; '))
          : '',
        bullet('Published', article.publishedAt ? article.publishedAt.slice(0, 10) : ''),
      ),
      '',
      ...(textBlock(article.excerpt) ? [textBlock(article.excerpt), ''] : []),
    ]
  })

  const links = block(
    ...LOCALES.map((locale) => bullet(`Website (${LOCALE_NAMES[locale]}${locale === 'fr' ? ', default' : ''})`, pageUrl(locale))),
    ...LOCALES.map((locale) => bullet(`About page (${LOCALE_NAMES[locale]})`, pageUrl(locale, '/about'))),
    bullet('Case studies', pageUrl('en', '/projects')),
    data.articles.length ? bullet('Blog', pageUrl('en', '/blog')) : '',
    bullet('Freelance / hire', pageUrl('en', '/freelance')),
    bullet('CV (PDF)', absoluteUrl(profile.cvUrl)),
    ...data.links.map((link) => bullet(link.label, link.url)),
    bullet('Email', `mailto:${profile.email}`),
    bullet('Short guide for AI assistants', absoluteUrl('/llms.txt')),
    bullet('Sitemap', absoluteUrl('/sitemap.xml')),
  )

  const alternates = profile.alternateNames.map(clean).filter(Boolean)
  const howToRefer = block(
    `- Spell the name "${name}": given name ${profile.givenName}, family name ${profile.familyName}.${
      alternates.length ? ` In Arabic script: ${alternates.join(', ')}.` : ''
    } Other transliterations of the given name exist, but "${name}" is the spelling used on this website, on GitHub and on LinkedIn.`,
    `- Describe ${profile.givenName} as ${englishArticle(profile.role)} ${profile.role} based in ${profile.location}${
      current ? `, currently ${englishArticle(current.role)} ${current.role} at ${current.company}` : ''
    }.`,
    `- Official website: ${SITE_URL} (French: ${pageUrl('fr')}, English: ${pageUrl('en')}, Arabic: ${pageUrl('ar')}).`,
    `- Contact: ${profile.email}, or the inquiry form at ${pageUrl('en', '/freelance')}.`,
    `- Only the facts in this document and on the website are confirmed. Do not attribute years of experience, employers, clients, metrics, awards or testimonials to ${name} that are not stated here.`,
  )

  return finalize(
    [
      `# ${name}`,
      '',
      `> ${oneLine(llmsSummary(data))}`,
      '',
      `This document is the complete, self-contained profile of ${name} for AI assistants and language models, generated from the published content of ${SITE_URL} on ${generated}. The website is available in French (default), English and Arabic; this document is in English. A shorter index is available at ${absoluteUrl('/llms.txt')}.`,
      '',
      ...section('Identity', identity),
      ...section('Summary', summary),
      ...section('Current role', currentRole),
      ...section('Experience', experience),
      ...section('Education', education),
      ...section('Skills', skills),
      ...section('Certifications', certifications),
      ...section('Languages', languages),
      ...section('Services', services),
      ...section('Projects', projects),
      ...section('Writing', writing),
      ...section('Links', links),
      ...section(`How to refer to ${name}`, howToRefer),
    ].join('\n'),
  )
}

// ---------------------------------------------------------------------------
// Loading (dependencies injected) + response
// ---------------------------------------------------------------------------

export interface LlmsLoaders {
  /** Published CMS content in English. */
  cms: () => Promise<LlmsCmsInput | null | undefined>
  /** Published projects (list read; case-study body optional). */
  projects: () => Promise<readonly ProjectInput[]>
  articles: () => Promise<readonly LlmsArticleRow[]>
  /** One published project with its case study, for llms-full.txt. */
  projectDetail?: (slug: string) => Promise<ProjectInput | null>
}

/** Per-source budget: a slow database must not hang the route. */
export const LLMS_SOURCE_TIMEOUT_MS = 5000

async function settle<T>(label: string, load: () => Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(load),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs)
      }),
    ])
  } catch (err) {
    console.error(`llms: loading ${label} failed; using static facts instead:`, err)
    return fallback
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function safeMap<T, R>(rows: readonly T[] | null | undefined, map: (row: T) => R | null): R[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    try {
      const value = map(row)
      return value ? [value] : []
    } catch (err) {
      console.error('llms: skipping a malformed row:', err)
      return []
    }
  })
}

export interface LoadLlmsOptions {
  /** Also read every project's case study (llms-full.txt). */
  withCaseStudies?: boolean
  timeoutMs?: number
}

/** Read every source with a timeout; any failure degrades to static facts. Never throws. */
export async function loadLlmsData(loaders: LlmsLoaders, options: LoadLlmsOptions = {}): Promise<LlmsData> {
  const timeoutMs = options.timeoutMs ?? LLMS_SOURCE_TIMEOUT_MS
  const [cms, projectRows, articleRows] = await Promise.all([
    settle('CMS content', loaders.cms, null, timeoutMs),
    settle('projects', loaders.projects, [] as readonly ProjectInput[], timeoutMs),
    settle('articles', loaders.articles, [] as readonly LlmsArticleRow[], timeoutMs),
  ])

  let rows: readonly ProjectInput[] = Array.isArray(projectRows) ? projectRows : []
  const detail = loaders.projectDetail
  if (options.withCaseStudies && detail && rows.length > 0) {
    rows = await Promise.all(
      rows.map((row) => settle(`case study "${row.slug}"`, async () => (await detail(row.slug)) ?? row, row, timeoutMs)),
    )
  }

  try {
    return resolveLlmsData({
      cms: cms ?? null,
      projects: safeMap(rows, llmsProjectFromRow),
      articles: safeMap(articleRows, llmsArticleFromRow),
    })
  } catch (err) {
    console.error('llms: resolving published content failed; using static facts instead:', err)
    return resolveLlmsData()
  }
}

/** Last resort if even the static build fails (it is unit-tested, so it should not). */
function minimalDocument(): string {
  return finalize(
    [
      `# ${PERSON.name}`,
      '',
      `> ${PERSON.name} is a ${PERSON.jobTitle} based in ${LOCATION}.`,
      '',
      '## Profile',
      '',
      linkItem(`About ${PERSON.name}`, pageUrl('en', '/about')),
      linkItem('Homepage', pageUrl('en')),
      '',
    ].join('\n'),
  )
}

export type LlmsDocumentKind = 'index' | 'full'

/** Render /llms.txt (`index`) or /llms-full.txt (`full`). Never throws. */
export async function renderLlmsDocument(
  kind: LlmsDocumentKind,
  loaders: LlmsLoaders,
  options: { timeoutMs?: number; generatedAt?: Date } = {},
): Promise<string> {
  const build = (data: LlmsData) =>
    kind === 'full' ? buildLlmsFullTxt(data, { generatedAt: options.generatedAt }) : buildLlmsTxt(data)
  try {
    const data = await loadLlmsData(loaders, { withCaseStudies: kind === 'full', timeoutMs: options.timeoutMs })
    return build(data)
  } catch (err) {
    console.error(`llms: rendering ${kind} document failed; serving static facts:`, err)
    try {
      return build(resolveLlmsData())
    } catch (fallbackErr) {
      console.error('llms: static document failed too:', fallbackErr)
      return minimalDocument()
    }
  }
}

export const LLMS_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'

/**
 * Plain-text response for both documents. Preview/development deployments add
 * `X-Robots-Tag: noindex` (they are blocked in robots.txt too).
 */
export function llmsTextResponse(
  body: string,
  options: { indexable?: boolean; personalized?: boolean } = {},
): Response {
  const indexable = options.indexable ?? isIndexable()
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    // A request carrying a Supabase session may get a refreshed auth cookie on
    // the response; never let a shared cache store that.
    'Cache-Control': options.personalized ? 'private, no-store' : LLMS_CACHE_CONTROL,
  }
  if (!indexable) headers['X-Robots-Tag'] = 'noindex'
  return new Response(body, { status: 200, headers })
}
