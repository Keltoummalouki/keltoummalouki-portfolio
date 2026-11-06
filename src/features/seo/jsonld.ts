import type { PublicCmsContent } from '@/features/cms/queries'
import {
  LOCALES,
  ORGANIZATION,
  PERSON,
  SCHEMA_IDS,
  SITE_NAME,
  SITE_URL,
  FALLBACK_SAME_AS,
  absoluteUrl,
  isPublicProfileUrl,
  localePath,
} from './site'
import { resolveRole } from './profile-summary'

// Pure schema.org (JSON-LD) builders. Every page emits ONE `@graph` whose nodes
// reference the shared Person / Organization / WebSite entities by stable `@id`,
// so search engines and AI crawlers resolve "Keltoum Malouki" to a single
// entity across the whole site. No I/O — unit-testable.

export type JsonLdNode = Record<string, unknown>

const CONTEXT = 'https://schema.org'

/** Drop undefined/null/empty-string/empty-array values so output stays clean. */
function compact<T extends JsonLdNode>(node: T): T {
  const out: JsonLdNode = {}
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out as T
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

export function jsonLdGraph(...nodes: (JsonLdNode | null | undefined | false)[]): JsonLdNode {
  return { '@context': CONTEXT, '@graph': nodes.filter(Boolean) }
}

export const personRef = { '@id': SCHEMA_IDS.person }
export const organizationRef = { '@id': SCHEMA_IDS.organization }
export const websiteRef = { '@id': SCHEMA_IDS.website }

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

export interface PersonSchemaInput {
  name?: string
  jobTitle?: string
  description?: string
  image?: string
  sameAs?: string[]
  email?: string
  worksFor?: { name: string; url?: string } | null
  alumniOf?: { name: string; url?: string }[]
  knowsAbout?: string[]
  knowsLanguage?: string[]
  credentials?: { name: string; issuer?: string; url?: string; date?: string }[]
}

export function personSchema(input: PersonSchemaInput = {}): JsonLdNode {
  const name = input.name || PERSON.name
  const jobTitle = input.jobTitle || PERSON.jobTitle
  return compact({
    '@type': 'Person',
    '@id': SCHEMA_IDS.person,
    name,
    givenName: PERSON.givenName,
    familyName: PERSON.familyName,
    alternateName: [...PERSON.alternateName],
    url: SITE_URL,
    image: absoluteUrl(input.image || PERSON.image),
    jobTitle,
    description: input.description,
    email: `mailto:${input.email || PERSON.email}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: PERSON.address.locality,
      addressCountry: PERSON.address.country,
    },
    hasOccupation: {
      '@type': 'Occupation',
      name: jobTitle,
      occupationLocation: {
        '@type': 'City',
        name: `${PERSON.address.locality}, ${PERSON.address.countryName}`,
      },
    },
    worksFor: input.worksFor
      ? compact({ '@type': 'Organization', name: input.worksFor.name, url: input.worksFor.url })
      : undefined,
    alumniOf: (input.alumniOf ?? []).map((school) =>
      compact({ '@type': 'EducationalOrganization', name: school.name, url: school.url }),
    ),
    knowsAbout: unique(input.knowsAbout ?? []),
    knowsLanguage: unique(input.knowsLanguage ?? []),
    hasCredential: (input.credentials ?? []).map((credential) =>
      compact({
        '@type': 'EducationalOccupationalCredential',
        name: credential.name,
        credentialCategory: 'certificate',
        url: credential.url,
        dateCreated: credential.date,
        recognizedBy: credential.issuer
          ? { '@type': 'Organization', name: credential.issuer }
          : undefined,
      }),
    ),
    sameAs: unique(input.sameAs?.length ? input.sameAs : [...FALLBACK_SAME_AS]),
  })
}

/** Map published CMS content to Person schema input (with message fallbacks). */
export function personInputFromCms(
  cms: Pick<
    PublicCmsContent,
    'about' | 'socialLinks' | 'experiences' | 'education' | 'skillCategories' | 'certifications' | 'languages'
  >,
  fallback: { jobTitle?: string; description?: string } = {},
): PersonSchemaInput {
  const links = cms.socialLinks ?? []
  const sameAs = links.map((link) => link.url.trim()).filter(isPublicProfileUrl)
  const email = links
    .map((link) => link.url)
    .find((url) => url.startsWith('mailto:'))
    ?.replace(/^mailto:/, '')
    .split('?')[0]
  const current = (cms.experiences ?? []).find((experience) => experience.isCurrent)

  return {
    name: cms.about?.fullName || undefined,
    // resolveRole drops known placeholder headlines (e.g. a seeded "Get to know me").
    jobTitle: resolveRole(cms.about?.headline, fallback.jobTitle ?? '') || undefined,
    description: cms.about?.bio || fallback.description,
    image: cms.about?.avatarUrl || undefined,
    sameAs,
    email: email || undefined,
    worksFor: current?.company
      ? { name: current.company, url: current.url || undefined }
      : null,
    alumniOf: (cms.education ?? [])
      .filter((item) => item.institution)
      .map((item) => ({ name: item.institution })),
    knowsAbout: (cms.skillCategories ?? []).flatMap((category) =>
      category.skills.map((skill) => skill.name),
    ),
    knowsLanguage: (cms.languages ?? []).map((language) => language.name),
    credentials: (cms.certifications ?? []).map((certification) => ({
      name: certification.name,
      issuer: certification.issuer || undefined,
      url: certification.credentialUrl || undefined,
      date: certification.issueDate || undefined,
    })),
  }
}

// ---------------------------------------------------------------------------
// Organization & WebSite
// ---------------------------------------------------------------------------

export function organizationSchema(input: { description?: string; sameAs?: string[] } = {}): JsonLdNode {
  return compact({
    '@type': 'Organization',
    '@id': SCHEMA_IDS.organization,
    name: ORGANIZATION.name,
    alternateName: ORGANIZATION.alternateName,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(ORGANIZATION.logo),
      width: 512,
      height: 512,
    },
    image: absoluteUrl(PERSON.image),
    description: input.description,
    email: `mailto:${PERSON.email}`,
    founder: personRef,
    employee: personRef,
    knowsLanguage: ['ar', 'fr', 'en'],
    address: {
      '@type': 'PostalAddress',
      addressLocality: PERSON.address.locality,
      addressCountry: PERSON.address.country,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: PERSON.email,
      availableLanguage: ['Arabic', 'French', 'English'],
      url: absoluteUrl(localePath('en', '/freelance')),
    },
    sameAs: unique(input.sameAs?.length ? input.sameAs : [...FALLBACK_SAME_AS]),
  })
}

export function websiteSchema(input: { description?: string } = {}): JsonLdNode {
  return compact({
    '@type': 'WebSite',
    '@id': SCHEMA_IDS.website,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: ['Keltoum Malouki Portfolio', 'keltoummalouki.com'],
    description: input.description,
    inLanguage: [...LOCALES],
    author: personRef,
    publisher: personRef,
    about: personRef,
  })
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export type WebPageType = 'WebPage' | 'AboutPage' | 'ProfilePage' | 'CollectionPage' | 'ContactPage'

export interface WebPageSchemaInput {
  type?: WebPageType
  /** Localized pathname, e.g. `/fr/about`. */
  path: string
  name: string
  description?: string
  locale: string
  /** `@id` of the page's main entity (defaults to the Person for profile/about pages). */
  mainEntityId?: string
  /** Include a `breadcrumb` reference (`<url>#breadcrumb`). */
  hasBreadcrumb?: boolean
  primaryImage?: string
  dateModified?: string
}

export function webPageSchema(input: WebPageSchemaInput): JsonLdNode {
  const url = absoluteUrl(input.path)
  const type = input.type ?? 'WebPage'
  const mainEntityId =
    input.mainEntityId ?? (type === 'ProfilePage' || type === 'AboutPage' ? SCHEMA_IDS.person : undefined)
  return compact({
    '@type': type,
    '@id': `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: input.locale,
    isPartOf: websiteRef,
    about: personRef,
    mainEntity: mainEntityId ? { '@id': mainEntityId } : undefined,
    breadcrumb: input.hasBreadcrumb ? { '@id': `${url}#breadcrumb` } : undefined,
    primaryImageOfPage: input.primaryImage
      ? { '@type': 'ImageObject', url: absoluteUrl(input.primaryImage) }
      : undefined,
    dateModified: input.dateModified,
  })
}

/** BreadcrumbList; `items` are `{ name, path }` with localized paths, in order. */
export function breadcrumbSchema(pagePath: string, items: { name: string; path: string }[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(pagePath)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function faqSchema(pagePath: string, items: { question: string; answer: string }[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(pagePath)}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/** Freelance packages as offers of the organization; a starting price becomes `minPrice`. */
export function offerCatalogSchema(
  pagePath: string,
  name: string,
  items: { title: string; description: string; priceFrom: number | null }[],
  currency: string,
): JsonLdNode {
  return {
    '@type': 'OfferCatalog',
    '@id': `${absoluteUrl(pagePath)}#offers`,
    name,
    itemListElement: items.map((item) =>
      compact({
        '@type': 'Offer',
        offeredBy: organizationRef,
        itemOffered: compact({ '@type': 'Service', name: item.title, description: item.description }),
        priceSpecification:
          item.priceFrom === null
            ? undefined
            : { '@type': 'PriceSpecification', minPrice: item.priceFrom, priceCurrency: currency },
      }),
    ),
  }
}

export function itemListSchema(pagePath: string, items: { name: string; path: string }[]): JsonLdNode {
  return {
    '@type': 'ItemList',
    '@id': `${absoluteUrl(pagePath)}#itemlist`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

// ---------------------------------------------------------------------------
// Content: projects (case studies) and blog posts
// ---------------------------------------------------------------------------

/** Stack entries that are programming languages (vs frameworks, databases, tools). */
const PROGRAMMING_LANGUAGES = new Set([
  'typescript', 'javascript', 'php', 'ruby', 'python', 'java', 'c', 'c#', 'c++', 'go', 'dart',
  'kotlin', 'swift', 'sql', 'html', 'html5', 'css', 'css3', 'coffeescript',
])

export interface ProjectSchemaInput {
  /** Localized pathname of the case study, e.g. `/en/projects/event-booking-app`. */
  path: string
  name: string
  description?: string
  locale: string
  image?: string | null
  repoUrl?: string | null
  demoUrl?: string | null
  technologies?: string[]
  dateCreated?: string | null
  dateModified?: string | null
}

/** A portfolio project: SoftwareSourceCode when a repo exists, else CreativeWork. */
export function projectSchema(input: ProjectSchemaInput): JsonLdNode {
  const url = absoluteUrl(input.path)
  return compact({
    '@type': input.repoUrl ? 'SoftwareSourceCode' : 'CreativeWork',
    '@id': `${url}#project`,
    name: input.name,
    headline: input.name,
    description: input.description,
    url,
    inLanguage: input.locale,
    image: input.image ? absoluteUrl(input.image) : undefined,
    codeRepository: input.repoUrl || undefined,
    sameAs: input.demoUrl || undefined,
    keywords: unique(input.technologies ?? []).join(', ') || undefined,
    programmingLanguage: input.repoUrl
      ? unique(input.technologies ?? []).filter((tech) => PROGRAMMING_LANGUAGES.has(tech.toLowerCase()))
      : undefined,
    dateCreated: input.dateCreated || undefined,
    dateModified: input.dateModified || undefined,
    author: personRef,
    creator: personRef,
    isPartOf: websiteRef,
    mainEntityOfPage: { '@id': `${url}#webpage` },
  })
}

export interface BlogPostingSchemaInput {
  path: string
  headline: string
  description?: string | null
  locale: string
  image?: string | null
  datePublished?: string | null
  dateModified?: string | null
  wordCount?: number
}

export function blogPostingSchema(input: BlogPostingSchemaInput): JsonLdNode {
  const url = absoluteUrl(input.path)
  return compact({
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: input.headline.slice(0, 110),
    description: input.description || undefined,
    url,
    inLanguage: input.locale,
    image: input.image ? absoluteUrl(input.image) : absoluteUrl(PERSON.image),
    datePublished: input.datePublished || undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    wordCount: input.wordCount,
    author: personRef,
    publisher: personRef,
    isPartOf: websiteRef,
    mainEntityOfPage: { '@id': `${url}#webpage` },
  })
}
