import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import JsonLd from '@/components/seo/JsonLd'
import { getPublishedArticles } from '@/features/articles/queries'
import { toArticleCard, type ArticleCardData } from '@/features/articles/map'
import { getPublishedCmsContent } from '@/features/cms/queries'
import {
  breadcrumbSchema,
  itemListSchema,
  jsonLdGraph,
  personInputFromCms,
  personSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata } from '@/features/seo/metadata'
import { absoluteUrl, localePath } from '@/features/seo/site'
import type { Locale } from '@/lib/validation/locale'

// Rendered per request so newly published articles appear without a rebuild.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = await getTranslations({ locale, namespace: 'seo' })
  return buildPageMetadata({
    locale,
    path: '/blog',
    title: seo('blogTitle'),
    absoluteTitle: true,
    description: seo('blogDescription'),
    rssFeed: { title: seo('blogTitle') },
    // Explicit: a page-level `openGraph` replaces the layout's file-based image.
    images: [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = (await params).locale as Locale
  const [t, seo, nav, hero, articleRows, cms] = await Promise.all([
    getTranslations({ locale, namespace: 'blog' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'hero' }),
    getPublishedArticles(),
    getPublishedCmsContent(locale),
  ])
  const articles = articleRows
    .map((a) => toArticleCard(a, locale))
    .filter((a): a is ArticleCardData => a !== null)

  const pagePath = localePath(locale, '/blog')
  const jsonLd = jsonLdGraph(
    webPageSchema({
      type: 'CollectionPage',
      path: pagePath,
      name: seo('blogTitle'),
      description: seo('blogDescription'),
      locale,
      hasBreadcrumb: true,
      mainEntityId: articles.length > 0 ? `${absoluteUrl(pagePath)}#itemlist` : undefined,
    }),
    articles.length > 0 &&
      itemListSchema(
        pagePath,
        articles.map((article) => ({ name: article.title, path: localePath(locale, `/blog/${article.slug}`) })),
      ),
    breadcrumbSchema(pagePath, [
      { name: nav('home'), path: localePath(locale, '/') },
      { name: nav('blog'), path: pagePath },
    ]),
    websiteSchema({ description: seo('defaultDescription') }),
    personSchema(personInputFromCms(cms, { jobTitle: hero('role'), description: seo('defaultDescription') })),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />
      <main id="main-content" className="section-padding">
        <div className="container-main">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{t('title')}</h1>
            <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
          </header>

          {articles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {t('empty')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
                >
                  {article.coverImage && (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={article.coverImage}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDate(article.publishedAt, locale) && (
                        <span>{formatDate(article.publishedAt, locale)}</span>
                      )}
                      <span aria-hidden>·</span>
                      <span>{t('minRead', { minutes: article.readingMinutes })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer links={cms.socialLinks} />
    </div>
  )
}
