import type { Metadata } from 'next'
import { DEFAULT_LOCALE, LOCALES, OG_LOCALES, SITE_NAME, TITLE_TEMPLATE, absoluteUrl, localePath } from './site'

// One builder for every public page's metadata, so canonical, hreflang, Open
// Graph and Twitter tags are always complete and consistent. Next.js merges
// metadata SHALLOWLY (a page's `openGraph` replaces the layout's entirely), so
// each page must emit the full object — this helper guarantees that.

/** Longest `<title>` allowed: Bing Webmaster Tools flags titles over 70 characters. */
export const MAX_TITLE_LENGTH = 70

export interface PageMetadataInput {
  locale: string
  /** Locale-less path, e.g. `/`, `/about`, `/projects/event-booking-app`. */
  path: string
  title: string
  /**
   * Fallback `<title>` for when `title` plus the ` | Keltoum Malouki` suffix is
   * over MAX_TITLE_LENGTH (e.g. the project name without "— Case study").
   * Open Graph and Twitter keep `title`.
   */
  shortTitle?: string
  description: string
  /** Use the title as-is (skip the `%s | Keltoum Malouki` template). */
  absoluteTitle?: boolean
  type?: 'website' | 'article' | 'profile'
  /**
   * Absolute or site-relative image URLs. Defaults to the locale's generated
   * share card (`/<locale>/opengraph-image`): Next only applies a file-based OG
   * image to its own segment once a page sets `openGraph`, so pass it explicitly.
   */
  images?: { url: string; width?: number; height?: number; alt?: string }[]
  /**
   * Per-locale locale-less paths when slugs differ by language (articles).
   * Defaults to `path` for every locale. Locales missing here get no hreflang.
   */
  localizedPaths?: Partial<Record<string, string>>
  publishedTime?: string | null
  modifiedTime?: string | null
  authors?: string[]
  noindex?: boolean
  /** Advertise the blog RSS feed (`/<locale>/blog/rss.xml`) for autodiscovery. */
  rssFeed?: { title: string }
}

/** hreflang map (+ x-default -> default locale) with locale-prefixed paths. */
export function buildLanguageAlternates(
  path: string,
  localizedPaths?: Partial<Record<string, string>>,
): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const locale of LOCALES) {
    const localized = localizedPaths ? localizedPaths[locale] : path
    if (localized !== undefined) languages[locale] = localePath(locale, localized)
  }
  const fallback = languages[DEFAULT_LOCALE] ?? Object.values(languages)[0]
  if (fallback) languages['x-default'] = fallback
  return languages
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const {
    locale,
    path,
    title,
    shortTitle,
    description,
    absoluteTitle = false,
    type = 'website',
    images,
    localizedPaths,
    publishedTime,
    modifiedTime,
    authors,
    noindex = false,
    rssFeed,
  } = input

  const canonical = localePath(locale, localizedPaths?.[locale] ?? path)
  const languages = buildLanguageAlternates(path, localizedPaths)
  const alternateLocale = Object.keys(languages)
    .filter((l) => l !== locale && l !== 'x-default')
    .map((l) => OG_LOCALES[l] ?? l)
  const ogImages = (
    images ?? [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: SITE_NAME }]
  ).map((image) => ({ ...image, url: absoluteUrl(image.url) }))

  const openGraphBase = {
    title,
    description,
    url: canonical,
    siteName: SITE_NAME,
    locale: OG_LOCALES[locale] ?? locale,
    alternateLocale,
    images: ogImages,
  }

  const openGraph: Metadata['openGraph'] =
    type === 'article'
      ? {
          ...openGraphBase,
          type: 'article',
          ...(publishedTime ? { publishedTime } : {}),
          ...(modifiedTime ? { modifiedTime } : {}),
          ...(authors?.length ? { authors } : {}),
        }
      : type === 'profile'
        ? { ...openGraphBase, type: 'profile', firstName: 'Keltoum', lastName: 'Malouki' }
        : { ...openGraphBase, type: 'website' }

  return {
    title: absoluteTitle ? { absolute: title } : fitTitle(shortTitle ? [title, shortTitle] : [title]),
    description,
    alternates: {
      canonical,
      languages,
      ...(rssFeed ? { types: { 'application/rss+xml': [{ url: localePath(locale, '/blog/rss.xml'), title: rssFeed.title }] } } : {}),
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.map((image) => image.url),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * A `<title>` of at most `max` characters, as rendered. The first candidate
 * that fits with the site-name suffix wins; otherwise the last candidate is
 * used without the suffix, cut on a word boundary if it is still too long.
 */
export function fitTitle(
  candidates: readonly [string, ...string[]],
  max = MAX_TITLE_LENGTH,
): string | { absolute: string } {
  const suffixLength = TITLE_TEMPLATE.length - '%s'.length
  const fits = candidates.find((candidate) => candidate.length + suffixLength <= max)
  if (fits !== undefined) return fits
  const last = candidates[candidates.length - 1]
  return { absolute: last.length <= max ? last : truncateOnWord(last, max) }
}

/** Trim text to a meta-description-friendly length on a word boundary. */
export function truncateDescription(text: string, max = 160): string {
  return truncateOnWord(text, max)
}

/** Cut text to at most `max` characters on a word boundary, ending with an ellipsis. */
function truncateOnWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}
