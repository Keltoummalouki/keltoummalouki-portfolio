import { describe, expect, it } from 'vitest'
import { escapeXml, feedArticles, renderRss } from './rss'

const articles = [
  {
    published_at: '2026-10-01T09:00:00Z',
    author_name: 'Keltoum Malouki',
    article_translations: [
      { locale: 'fr', slug: 'rls-supabase', title: 'RLS avec Supabase', excerpt: 'Autorisation côté base.' },
      { locale: 'en', slug: 'supabase-rls', title: 'Supabase RLS & Next.js', excerpt: 'Authorization <in> the database.' },
    ],
  },
  {
    published_at: null,
    author_name: null,
    article_translations: [{ locale: 'fr', slug: 'brouillon-fr', title: 'Seulement en français', excerpt: null }],
  },
]

describe('feedArticles', () => {
  it('keeps only articles written in the feed language', () => {
    const items = feedArticles(articles, 'en', (slug) => `https://site.test/en/blog/${slug}`)
    expect(items).toEqual([
      {
        title: 'Supabase RLS & Next.js',
        url: 'https://site.test/en/blog/supabase-rls',
        excerpt: 'Authorization <in> the database.',
        author: 'Keltoum Malouki',
        publishedAt: '2026-10-01T09:00:00Z',
      },
    ])
    expect(feedArticles(articles, 'fr', (slug) => slug)).toHaveLength(2)
  })
})

describe('renderRss', () => {
  it('renders a valid, escaped RSS 2.0 channel', () => {
    const xml = renderRss({
      title: 'Blog',
      description: 'Notes',
      siteUrl: 'https://site.test/en/blog',
      feedUrl: 'https://site.test/en/blog/rss.xml',
      language: 'en',
      articles: feedArticles(articles, 'en', (slug) => `https://site.test/en/blog/${slug}`),
    })
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<atom:link href="https://site.test/en/blog/rss.xml" rel="self" type="application/rss+xml"/>')
    expect(xml).toContain('<title>Supabase RLS &amp; Next.js</title>')
    expect(xml).toContain('<description>Authorization &lt;in&gt; the database.</description>')
    expect(xml).toContain('<pubDate>Thu, 01 Oct 2026 09:00:00 GMT</pubDate>')
    expect(xml).toContain('<lastBuildDate>Thu, 01 Oct 2026 09:00:00 GMT</lastBuildDate>')
  })

  it('stays valid with no articles', () => {
    const xml = renderRss({ title: 'Blog', description: 'Notes', siteUrl: 'https://s.test', feedUrl: 'https://s.test/rss.xml', language: 'ar', articles: [] })
    expect(xml).toContain('<channel>')
    expect(xml).not.toContain('<item>')
    expect(xml).not.toContain('lastBuildDate')
  })
})

describe('escapeXml', () => {
  it('escapes markup characters', () => {
    expect(escapeXml(`<a href="x">Tom's & co</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom&apos;s &amp; co&lt;/a&gt;')
  })
})
