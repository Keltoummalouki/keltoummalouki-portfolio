// Pure RSS 2.0 rendering for the blog feeds (no I/O, unit-tested).

export interface FeedArticle {
  title: string
  /** Absolute article URL. */
  url: string
  excerpt: string | null
  author: string | null
  publishedAt: string | null
}

export interface FeedInput {
  title: string
  description: string
  /** Absolute blog index URL. */
  siteUrl: string
  /** Absolute URL of this feed. */
  feedUrl: string
  language: string
  articles: FeedArticle[]
}

/** Feed entries in one locale only: a reader subscribes to one language. */
export function feedArticles<T extends { published_at: string | null; author_name: string | null; article_translations: { locale: string; slug: string; title: string; excerpt: string | null }[] }>(
  articles: readonly T[],
  locale: string,
  articleUrl: (slug: string) => string,
): FeedArticle[] {
  return articles.flatMap((article) => {
    const translation = article.article_translations.find((t) => t.locale === locale && t.title.trim())
    if (!translation) return []
    return [
      {
        title: translation.title.trim(),
        url: articleUrl(translation.slug),
        excerpt: translation.excerpt,
        author: article.author_name,
        publishedAt: article.published_at,
      },
    ]
  })
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function rfc822(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toUTCString()
}

export function renderRss(feed: FeedInput): string {
  const items = feed.articles.map((article) => {
    const date = rfc822(article.publishedAt)
    return [
      '    <item>',
      `      <title>${escapeXml(article.title)}</title>`,
      `      <link>${escapeXml(article.url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(article.url)}</guid>`,
      article.excerpt ? `      <description>${escapeXml(article.excerpt)}</description>` : null,
      article.author ? `      <dc:creator>${escapeXml(article.author)}</dc:creator>` : null,
      date ? `      <pubDate>${date}</pubDate>` : null,
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n')
  })
  const latest = feed.articles.map((article) => rfc822(article.publishedAt)).find(Boolean)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${escapeXml(feed.siteUrl)}</link>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <language>${escapeXml(feed.language)}</language>`,
    `    <atom:link href="${escapeXml(feed.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    latest ? `    <lastBuildDate>${latest}</lastBuildDate>` : null,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n')
}
