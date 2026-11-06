import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getPublishedArticles } from '@/features/articles/queries'
import { feedArticles, renderRss } from '@/features/articles/rss'
import { absoluteUrl, localePath } from '@/features/seo/site'
import { routing } from '@/i18n/routing'

// /{locale}/blog/rss.xml: one RSS feed per language, listing only articles
// written in it. Published articles only; an unreachable database yields an
// empty (still valid) feed. Cached like the pages: purged on admin edits,
// refreshed at least hourly.
export const revalidate = 3600

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }): Promise<Response> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return new Response('Not found', { status: 404 })

  const [seo, articles] = await Promise.all([getTranslations({ locale, namespace: 'seo' }), getPublishedArticles()])
  const body = renderRss({
    title: seo('blogTitle'),
    description: seo('blogDescription'),
    siteUrl: absoluteUrl(localePath(locale, '/blog')),
    feedUrl: absoluteUrl(localePath(locale, '/blog/rss.xml')),
    language: locale,
    articles: feedArticles(articles, locale, (slug) => absoluteUrl(localePath(locale, `/blog/${slug}`))),
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
