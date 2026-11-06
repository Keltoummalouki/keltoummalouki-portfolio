import type { PublicCmsContent } from '@/features/cms/queries'
import type { PersonSchemaInput } from './jsonld'
import {
  englishArticle,
  formatLanguages,
  normalizeAvailability,
  pickCoreStack,
  resolveRole,
  type ProfileAvailability,
  roleInSentence,
} from './profile-summary'
import { FALLBACK_SAME_AS, PERSON, SITE_URL, localePath } from './site'

// Pure composition logic for the /about profile page: resolves published CMS
// content (with message fallbacks) into one profile, then derives the visible
// definitional intro, the "At a glance" facts and the FAQ. The FAQ JSON-LD is
// built from the exact same items as the visible FAQ, so they can never drift.
// No I/O and no next-intl import: callers pass a translator scoped to
// `aboutPage`, which keeps everything unit-testable.

/** Translator scoped to the `aboutPage` messages namespace. */
export type AboutTranslate = (key: string, values?: Record<string, string>) => string

export interface AboutExperienceItem {
  id: string
  role: string
  company: string
  /** City/country of the position, when known. */
  place: string
  date: string
  description: string
  technologies: string[]
  isCurrent: boolean
}

export interface AboutEducationItem {
  id: string
  degree: string
  institution: string
  place: string
  date: string
  description: string
}

export interface AboutLanguage {
  name: string
  level: string
}

export interface AboutProfile {
  /** Name in the page's script (Arabic script on /ar). */
  name: string
  /** First mention form: `كلثوم ملوكي (Keltoum Malouki)` on /ar, the plain name elsewhere. */
  fullName: string
  givenName: string
  role: string
  availability: ProfileAvailability
  experiences: AboutExperienceItem[]
  current: AboutExperienceItem | null
  previous: AboutExperienceItem | null
  education: AboutEducationItem[]
  /** Every technical skill, de-duplicated, in CMS order. */
  skills: string[]
  /** The most representative skills, ranked. */
  stack: string[]
  languages: AboutLanguage[]
  email: string
  linkedinUrl: string
  githubUrl: string
}

export interface AboutProfileFallbacks {
  /** Localized display name (messages `hero.name`). */
  name: string
  /** Localized job title (messages `hero.role`). */
  role: string
  /** Used only when the CMS has no published experiences. */
  experiences: AboutExperienceItem[]
  /** Used only when the CMS has no published education. */
  education: AboutEducationItem[]
  /** Used only when the CMS has no published technical skills. */
  skills: string[]
  /** Used only when the CMS returned no languages. */
  languages: AboutLanguage[]
}

type AboutCmsInput = Pick<
  PublicCmsContent,
  'about' | 'socialLinks' | 'experiences' | 'education' | 'skillCategories' | 'languages'
>

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/** `DabaDoc — Casablanca, Morocco` -> `{ name: 'DabaDoc', place: 'Casablanca, Morocco' }`. */
export function splitNameAndPlace(value: string): { name: string; place: string } {
  const clean = cleanText(value)
  const match = clean.match(/^(.*?)\s+[—–]\s+(.+)$/)
  return match ? { name: match[1].trim(), place: match[2].trim() } : { name: clean, place: '' }
}

/** `Ruby on Rails, Angular` (Latin or Arabic commas) -> `['Ruby on Rails', 'Angular']`. */
export function splitTechnologies(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((item) => cleanText(item))
    .filter(Boolean)
}

/** The CMS date range always says `Present` in English; show the localized word. */
export function localizeDateRange(date: string, presentLabel: string): string {
  const clean = cleanText(date)
  return presentLabel ? clean.replace(/\bPresent$/, presentLabel) : clean
}

/** Localized conjunction list: `A, B, and C` / `A, B et C` / `A وB وC`. */
export function joinList(items: readonly string[], locale: string): string {
  const values = items.map((item) => cleanText(item)).filter(Boolean)
  if (values.length === 0) return ''
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(values)
  } catch {
    return values.join(', ')
  }
}

/** `https://www.linkedin.com/in/x/` -> `linkedin.com/in/x`. */
export function displayUrl(url: string): string {
  return cleanText(url)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
}

function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = cleanText(raw)
    const key = name.toLowerCase()
    if (name && !seen.has(key)) {
      seen.add(key)
      out.push(name)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// CMS -> profile
// ---------------------------------------------------------------------------

/**
 * The page's name forms. Arabic pages write the name in Arabic script and pair
 * it with the Latin spelling on first mention, so both spellings resolve to the
 * same entity for search and AI answers.
 */
export function resolveDisplayName(
  cmsFullName: string | null | undefined,
  localizedName: string,
): { name: string; fullName: string; givenName: string } {
  const latin = cleanText(cmsFullName) || PERSON.name
  const localized = cleanText(localizedName)
  const useLocalized = Boolean(localized) && !/[A-Za-z]/.test(localized)
  const name = useLocalized ? localized : latin
  return {
    name,
    fullName: useLocalized && localized !== latin ? `${localized} (${latin})` : name,
    givenName: name.split(' ')[0] || name,
  }
}

function contactLinks(links: AboutCmsInput['socialLinks']): Pick<AboutProfile, 'email' | 'linkedinUrl' | 'githubUrl'> {
  const urls = (links ?? []).map((link) => ({ platform: link.platform, url: cleanText(link.url) }))
  const fromCms = urls.length > 0
  const web = fromCms ? urls : FALLBACK_SAME_AS.map((url) => ({ platform: '', url }))
  const find = (platform: string, host: RegExp) =>
    web.find((link) => /^https?:\/\//i.test(link.url) && (link.platform === platform || host.test(link.url)))?.url ?? ''
  const mail = urls
    .map((link) => link.url)
    .find((url) => url.toLowerCase().startsWith('mailto:'))
    ?.replace(/^mailto:/i, '')
    .split('?')[0]
  return {
    email: cleanText(mail) || PERSON.email,
    linkedinUrl: find('linkedin', /linkedin\.com\//i),
    githubUrl: find('github', /github\.com\//i),
  }
}

/**
 * Resolve everything the About page shows. The CMS is authoritative whenever a
 * collection has published rows; message fallbacks apply only when a whole
 * collection is empty (e.g. education before it is entered in the dashboard).
 */
/**
 * Array filter that keeps the first item per key (case-insensitive), so rows
 * saved twice in the CMS are not rendered twice on the About page.
 */
function firstOfKey<T>(key: (item: T) => string[]) {
  const seen = new Set<string>()
  return (item: T) => {
    const id = key(item).map((part) => part.trim().toLowerCase()).join('|')
    if (seen.has(id)) return false
    seen.add(id)
    return true
  }
}

export function resolveAboutProfile(
  cms: AboutCmsInput,
  fallbacks: AboutProfileFallbacks,
  options: { presentLabel?: string } = {},
): AboutProfile {
  const presentLabel = options.presentLabel ?? ''

  const experiences: AboutExperienceItem[] = (
    (cms.experiences ?? []).length > 0
      ? cms.experiences.map((item) => ({
          id: item.id,
          role: cleanText(item.role),
          company: cleanText(item.company),
          place: cleanText(item.location),
          date: localizeDateRange(item.date, presentLabel),
          description: cleanText(item.description),
          technologies: uniqueNames(item.technologies ?? []),
          isCurrent: Boolean(item.isCurrent),
        }))
      : fallbacks.experiences
  ).filter(firstOfKey((item) => [item.role, item.company, item.date]))

  const education: AboutEducationItem[] = (
    (cms.education ?? []).length > 0
      ? cms.education.map((item) => ({
          id: item.id,
          degree: cleanText(item.degree),
          institution: cleanText(item.institution),
          place: cleanText(item.location),
          date: cleanText(item.date),
          description: cleanText(item.description) || cleanText(item.field),
        }))
      : fallbacks.education
  ).filter(firstOfKey((item) => [item.degree, item.institution, item.date]))

  const cmsSkills = uniqueNames((cms.skillCategories ?? []).flatMap((category) => category.skills.map((skill) => skill.name)))
  const skills = cmsSkills.length > 0 ? cmsSkills : uniqueNames(fallbacks.skills)

  const languages = ((cms.languages ?? []).length > 0 ? cms.languages : fallbacks.languages)
    .map((language) => ({ name: cleanText(language.name), level: cleanText(language.level) }))
    .filter((language) => language.name)
    .filter(firstOfKey((language) => [language.name]))

  const isUsable = (item: AboutExperienceItem) => Boolean(item.role && item.company)

  return {
    ...resolveDisplayName(cms.about?.fullName, fallbacks.name),
    role: resolveRole(cms.about?.headline, fallbacks.role),
    availability: normalizeAvailability(cms.about?.availabilityStatus),
    experiences,
    current: experiences.find((item) => item.isCurrent && isUsable(item)) ?? null,
    previous: experiences.find((item) => !item.isCurrent && isUsable(item)) ?? null,
    education,
    skills,
    stack: pickCoreStack(skills),
    languages,
    ...contactLinks(cms.socialLinks),
  }
}

// ---------------------------------------------------------------------------
// Profile -> visible copy
// ---------------------------------------------------------------------------

/** Definitional intro: who, where, current position and craft, one sentence each. */
export function composeAboutIntro(profile: AboutProfile, t: AboutTranslate, locale = 'en'): string {
  const sentences = [
    t('intro.identity', {
      fullName: profile.fullName,
      role: roleInSentence(profile.role, locale),
      roleArticle: englishArticle(profile.role),
    }),
    profile.current
      ? t('intro.current', {
          givenName: profile.givenName,
          currentRole: roleInSentence(profile.current.role, locale),
          currentArticle: englishArticle(profile.current.role),
          company: profile.current.company,
        })
      : '',
    t('intro.craft', { givenName: profile.givenName }),
  ]
  return sentences.map((sentence) => sentence.trim()).filter(Boolean).join(' ')
}

export type AboutFactId = 'role' | 'location' | 'current' | 'education' | 'languages' | 'openTo' | 'email'

export interface AboutFactRow {
  id: AboutFactId
  label: string
  value: string
  /** Set when the value should be rendered as a link. */
  href?: string
}

export function buildAboutFacts(profile: AboutProfile, t: AboutTranslate, locale: string): AboutFactRow[] {
  const rows: AboutFactRow[] = [
    { id: 'role', label: t('glance.labels.role'), value: profile.role },
    { id: 'location', label: t('glance.labels.location'), value: t('glance.values.location') },
  ]
  if (profile.current) {
    rows.push({
      id: 'current',
      label: t('glance.labels.current'),
      value: t('glance.values.current', { role: profile.current.role, company: profile.current.company }),
    })
  }
  const school = profile.education.find((item) => item.institution)
  if (school) {
    rows.push({
      id: 'education',
      label: t('glance.labels.education'),
      value: school.degree
        ? t('glance.values.education', { degree: school.degree, institution: school.institution })
        : school.institution,
    })
  }
  const languages = formatLanguages(profile.languages, locale)
  if (languages) rows.push({ id: 'languages', label: t('glance.labels.languages'), value: languages })
  if (profile.availability !== 'unavailable') {
    rows.push({ id: 'openTo', label: t('glance.labels.openTo'), value: t(`glance.values.openTo.${profile.availability}`) })
  }
  rows.push({ id: 'email', label: t('glance.labels.email'), value: profile.email, href: `mailto:${profile.email}` })
  return rows
}

// ---------------------------------------------------------------------------
// FAQ (visible + FAQPage JSON-LD)
// ---------------------------------------------------------------------------

export type AboutFaqId = 'who' | 'location' | 'current' | 'technologies' | 'education' | 'availability' | 'contact'

export interface AboutFaqItem {
  id: AboutFaqId
  question: string
  answer: string
}

/** How many extra skills the "Which technologies…" answer lists after the core stack. */
export const FAQ_EXTRA_SKILLS_LIMIT = 14

function educationSeparator(locale: string): string {
  if (locale === 'ar') return '؛ '
  if (locale === 'fr') return ' ; '
  return '; '
}

function sentences(...parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(' ')
}

/**
 * Seven self-contained Q&As. Every answer repeats the person's name so it still
 * makes sense when quoted on its own by a search engine or an AI assistant.
 */
export function buildAboutFaq(profile: AboutProfile, t: AboutTranslate, locale: string): AboutFaqItem[] {
  const site = displayUrl(SITE_URL)
  const base = {
    name: profile.name,
    fullName: profile.fullName,
    email: profile.email,
    site,
    freelanceUrl: `${site}${localePath(locale, '/freelance')}`,
  }
  const role = { role: roleInSentence(profile.role, locale), roleArticle: englishArticle(profile.role) }
  const items: AboutFaqItem[] = []

  items.push({
    id: 'who',
    question: t('faq.who.question', base),
    answer: t('faq.who.answer', { ...base, ...role }),
  })

  items.push({
    id: 'location',
    question: t('faq.location.question', base),
    answer: t('faq.location.answer', base),
  })

  const { current, previous } = profile
  items.push({
    id: 'current',
    question: t('faq.current.question', base),
    answer: sentences(
      current
        ? t(current.place ? 'faq.current.answerWithPlace' : 'faq.current.answer', {
            ...base,
            currentRole: roleInSentence(current.role, locale),
            currentArticle: englishArticle(current.role),
            company: current.company,
            place: current.place,
          })
        : t('faq.current.none', { ...base, ...role }),
      current && current.technologies.length > 0
        ? t('faq.current.stack', { ...base, technologies: joinList(current.technologies, locale) })
        : '',
      previous
        ? t('faq.current.previous', {
            ...base,
            previousRole: roleInSentence(previous.role, locale),
            previousArticle: englishArticle(previous.role),
            previousCompany: previous.company,
          })
        : '',
    ),
  })

  const extra = pickCoreStack(profile.skills, profile.stack.length + FAQ_EXTRA_SKILLS_LIMIT).slice(profile.stack.length)
  items.push({
    id: 'technologies',
    question: t('faq.technologies.question', base),
    answer: sentences(
      t('faq.technologies.answer', { ...base, technologies: joinList(profile.stack, locale) }),
      extra.length > 0 ? t('faq.technologies.more', { ...base, technologies: joinList(extra, locale) }) : '',
    ),
  })

  const schools = profile.education
    .filter((item) => item.institution || item.degree)
    .map((item) => {
      const title = [item.degree, item.institution].filter(Boolean).join(' — ')
      return item.date ? `${title} (${item.date})` : title
    })
  if (schools.length > 0) {
    items.push({
      id: 'education',
      question: t('faq.education.question', base),
      answer: t('faq.education.answer', { ...base, items: schools.join(educationSeparator(locale)) }),
    })
  }

  items.push({
    id: 'availability',
    question: t('faq.availability.question', base),
    answer: t(`faq.availability.answer.${profile.availability}`, base),
  })

  items.push({
    id: 'contact',
    question: t('faq.contact.question', base),
    answer: profile.linkedinUrl
      ? t('faq.contact.answerWithLinkedin', { ...base, linkedin: displayUrl(profile.linkedinUrl) })
      : t('faq.contact.answer', base),
  })

  return items
}

// ---------------------------------------------------------------------------
// JSON-LD consistency
// ---------------------------------------------------------------------------

/**
 * Fill Person schema gaps from the resolved profile, so the structured data
 * never says less than the visible page (e.g. education rendered from message
 * fallbacks while the CMS table is still empty).
 */
export function aboutPersonInput(
  input: PersonSchemaInput,
  profile: AboutProfile,
  visible: { credentials?: NonNullable<PersonSchemaInput['credentials']> } = {},
): PersonSchemaInput {
  const schools = uniqueNames(profile.education.map((item) => item.institution))
  return {
    ...input,
    credentials: input.credentials?.length ? input.credentials : (visible.credentials ?? []),
    worksFor: input.worksFor ?? (profile.current ? { name: profile.current.company } : null),
    alumniOf: input.alumniOf?.length ? input.alumniOf : schools.map((name) => ({ name })),
    knowsAbout: input.knowsAbout?.length ? input.knowsAbout : profile.skills,
    knowsLanguage: input.knowsLanguage?.length
      ? input.knowsLanguage
      : profile.languages.map((language) => language.name),
  }
}

// ---------------------------------------------------------------------------
// Static fallbacks (mirroring the CV / existing sections)
// ---------------------------------------------------------------------------

/** Skill categories shown when the CMS has none; keys match `skills.categories.*`. */
export const FALLBACK_SKILL_CATEGORIES: readonly { key: string; skills: readonly string[] }[] = [
  { key: 'languages', skills: ['C', 'HTML5', 'CSS3', 'SQL', 'NoSQL', 'JavaScript', 'TypeScript', 'PHP'] },
  {
    key: 'frameworks',
    skills: ['Laravel', 'Node.js', 'React', 'Next.js', 'Express.js', 'NestJS', 'Ruby on Rails', 'Angular', 'Tailwind CSS', 'GraphQL'],
  },
  { key: 'devops', skills: ['Docker', 'CI/CD', 'GitHub Actions'] },
  { key: 'databases', skills: ['MySQL', 'PostgreSQL', 'MongoDB'] },
  { key: 'management', skills: ['Agile', 'Jira'] },
  { key: 'modeling', skills: ['Merise', 'UML'] },
  { key: 'versioning', skills: ['Git', 'GitHub', 'GitLab'] },
  { key: 'design', skills: ['Figma', 'Canva', 'Adobe XD'] },
]

/** Credential link for the fallback Docker certificate. */
export const FALLBACK_DOCKER_CREDENTIAL_URL =
  'https://www.linkedin.com/learning/certificates/8556c209c6898f55066429ef88fa4d13bed6d4bdb38b594b6d7dbc02216898b2'
