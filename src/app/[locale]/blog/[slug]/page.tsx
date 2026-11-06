import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import Markdown from '@/components/ui/Markdown'
import JsonLd from '@/components/seo/JsonLd'
import {
  getPublishedArticleBySlug,
  getArticleLocaleSlugs,
  type PublishedArticleDetail,
} from '@/features/articles/queries'
import { readingMinutes } from '@/features/articles/reading-time'
import { getPublishedCmsContent } from '@/features/cms/queries'
import {
  blogPostingSchema,
  breadcrumbSchema,
  jsonLdGraph,
  personInputFromCms,
  personSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata, truncateDescription } from '@/features/seo/metadata'
import { PERSON, absoluteUrl, localePath } from '@/features/seo/site'
import { latestDate } from '@/features/seo/sitemap'
import type { Locale } from '@/lib/validation/locale'

// Cached and shared between visitors (ISR). Admin edits purge it at once
// (revalidatePublicSite); the hourly revalidation is only a safety net.
export const revalidate = 3600

// No slugs at build: each article is rendered on its first visit, then cached
// like the other pages. Unknown slugs still 404.
export function generateStaticParams() {
  return []
}

/**
 * Per-locale locale-less paths (`/blog/<slug>`) of the article's published
 * translations, plus the locale whose URL is canonical for this request: the
 * requested locale when it has a translation, otherwise the language of the
 * translation actually shown (so `/en/blog/<fr-slug>` without an English
 * version canonicalizes to the French URL instead of duplicating it).
 */
async function resolveArticleUrls(slug: string, locale: string, detail: PublishedArticleDetail) {
  const slugs = await getArticleLocaleSlugs(slug, locale)
  if (Object.keys(slugs).length === 0) slugs[detail.locale] = slug
  const localizedPaths = Object.fromEntries(
    Object.entries(slugs).map(([l, s]) => [l, `/blog/${s}`]),
  ) as Record<string, string>
  const canonicalLocale = slugs[locale] ? locale : detail.locale
  return { slugs, localizedPaths, canonicalLocale }
}

/** Rough Markdown -> plain text, for body-derived meta descriptions. */
function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]+/g, '')
}

/** SEO description > excerpt > start of the body > site default. */
function articleDescription(detail: PublishedArticleDetail, fallback: string): string {
  const text = detail.seo_description?.trim() || detail.excerpt?.trim() || markdownToText(detail.body_markdown ?? '').trim()
  return text ? truncateDescription(text) : fallback
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const detail = await getPublishedArticleBySlug(slug, locale)
  if (!detail) return { title: 'Article', robots: { index: false, follow: true } }

  const seo = await getTranslations({ locale, namespace: 'seo' })
  const { localizedPaths, canonicalLocale } = await resolveArticleUrls(slug, locale, detail)
  const cover = detail.articles.cover_image_url

  return buildPageMetadata({
    locale: canonicalLocale,
    path: localizedPaths[canonicalLocale],
    localizedPaths,
    title: detail.seo_title || detail.title,
    description: articleDescription(detail, seo('defaultDescription')),
    type: 'article',
    publishedTime: detail.articles.published_at,
    modifiedTime: latestDate(detail.articles.updated_at, detail.updated_at)?.toISOString(),
    authors: [detail.articles.author_name || PERSON.name],
    rssFeed: { title: seo('blogTitle') },
    images: cover
      ? [{ url: cover, alt: detail.title }]
      : [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale: rawLocale, slug } = await params
  const locale = rawLocale as Locale

  const [detail, cms, t, seo, nav, hero] = await Promise.all([
    getPublishedArticleBySlug(slug, locale),
    getPublishedCmsContent(locale),
    getTranslations({ locale, namespace: 'blog' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'hero' }),
  ])
  if (!detail) notFound()

  const { slugs, localizedPaths, canonicalLocale } = await resolveArticleUrls(slug, locale, detail)
  // Another language's slug under this locale while this locale has its own
  // translation: send readers and crawlers to the right URL.
  if (slugs[locale] && slugs[locale] !== slug) {
    permanentRedirect(localePath(locale, `/blog/${encodeURIComponent(slugs[locale])}`))
  }

  const published = formatDate(detail.articles.published_at, locale)
  const minutes = readingMinutes(detail.body_markdown)
  const rtl = detail.locale === 'ar'
  const cover = detail.articles.cover_image_url
  const modified = latestDate(detail.articles.updated_at, detail.updated_at)?.toISOString()
  const description = articleDescription(detail, seo('defaultDescription'))

  const pagePath = localePath(canonicalLocale, localizedPaths[canonicalLocale])
  const blogPath = localePath(locale, '/blog')
  const jsonLd = jsonLdGraph(
    blogPostingSchema({
      path: pagePath,
      headline: detail.title,
      description,
      locale: detail.locale,
      image: cover,
      datePublished: detail.articles.published_at,
      dateModified: modified,
      wordCount: detail.body_markdown?.trim().split(/\s+/).filter(Boolean).length || undefined,
    }),
    webPageSchema({
      path: pagePath,
      name: detail.seo_title || detail.title,
      description,
      locale: detail.locale,
      mainEntityId: `${absoluteUrl(pagePath)}#article`,
      hasBreadcrumb: true,
      primaryImage: cover || undefined,
      dateModified: modified,
    }),
    breadcrumbSchema(pagePath, [
      { name: nav('home'), path: localePath(locale, '/') },
      { name: nav('blog'), path: blogPath },
      { name: detail.title, path: pagePath },
    ]),
    websiteSchema({ description: seo('defaultDescription') }),
    personSchema(personInputFromCms(cms, { jobTitle: hero('role'), description: seo('defaultDescription') })),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />
      <main id="main-content" className="section-padding">
        <div className="container-main max-w-3xl">
          <nav aria-label={seo('breadcrumbLabel')}>
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/"
                  className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {nav('home')}
                </Link>
              </li>
              <li aria-hidden className="flex items-center">
                <ChevronRight size={14} className="rtl:rotate-180" />
              </li>
              <li>
                <Link
                  href="/blog"
                  className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {nav('blog')}
                </Link>
              </li>
              <li aria-hidden className="flex items-center">
                <ChevronRight size={14} className="rtl:rotate-180" />
              </li>
              <li aria-current="page" className="min-w-0 max-w-full truncate text-foreground">
                {detail.title}
              </li>
            </ol>
          </nav>

          <article className="mt-6" dir={rtl ? 'rtl' : 'ltr'} lang={detail.locale}>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{detail.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {detail.articles.author_name && <span>{detail.articles.author_name}</span>}
              {detail.articles.author_name && <span aria-hidden>·</span>}
              {published && (
                <time dateTime={detail.articles.published_at ?? undefined}>{published}</time>
              )}
              <span aria-hidden>·</span>
              <span>{t('minRead', { minutes })}</span>
            </div>

            {cover && (
              <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl">
                <Image
                  src={cover}
                  alt={detail.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {detail.excerpt && (
              <p className="mt-6 text-lg text-muted-foreground">{detail.excerpt}</p>
            )}

            <div className="mt-8">
              <Markdown>{detail.body_markdown ?? ''}</Markdown>
            </div>
          </article>
        </div>
      </main>
      <Footer links={cms.socialLinks} />
    </div>
  )
}
