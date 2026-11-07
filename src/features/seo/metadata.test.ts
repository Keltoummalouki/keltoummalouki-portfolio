import { describe, expect, it } from 'vitest'
import { MAX_TITLE_LENGTH, buildLanguageAlternates, buildPageMetadata, fitTitle, truncateDescription } from './metadata'

/** The `<title>` text as Next.js renders it (template `%s | Keltoum Malouki`). */
const rendered = (title: ReturnType<typeof fitTitle>) =>
  typeof title === 'string' ? `${title} | Keltoum Malouki` : title.absolute

// Case-study titles Bing Webmaster Tools flagged as "Title too long".
const REPARELIYA_FR = 'Repareliya — Plateforme de gestion pour atelier de réparation'
const SENDLY_FR = 'Sendly — SaaS Commerce, Marketplace & Livraison'

describe('buildLanguageAlternates', () => {
  it('maps every locale and adds x-default -> default locale', () => {
    expect(buildLanguageAlternates('/about')).toEqual({
      fr: '/fr/about',
      en: '/en/about',
      ar: '/ar/about',
      'x-default': '/fr/about',
    })
  })

  it('handles the home path without a trailing slash', () => {
    expect(buildLanguageAlternates('/')).toMatchObject({ fr: '/fr', en: '/en', 'x-default': '/fr' })
  })

  it('only emits locales present in localizedPaths (per-locale slugs)', () => {
    expect(buildLanguageAlternates('/blog/x', { en: '/blog/hello', ar: '/blog/marhaba' })).toEqual({
      en: '/en/blog/hello',
      ar: '/ar/blog/marhaba',
      'x-default': '/en/blog/hello',
    })
  })
})

describe('buildPageMetadata', () => {
  const base = { locale: 'en', path: '/about', title: 'About', description: 'Desc' }

  it('emits canonical, hreflang, full Open Graph and Twitter tags', () => {
    const meta = buildPageMetadata(base)
    expect(meta.alternates?.canonical).toBe('/en/about')
    expect(meta.openGraph).toMatchObject({
      title: 'About',
      url: '/en/about',
      siteName: 'Keltoum Malouki',
      locale: 'en_US',
      type: 'website',
    })
    expect((meta.openGraph as { alternateLocale: string[] }).alternateLocale).toEqual(['fr_FR', 'ar_MA'])
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'About' })
    expect(meta.robots).toBeUndefined()
  })

  it('supports absolute titles, article type and noindex', () => {
    const meta = buildPageMetadata({
      ...base,
      absoluteTitle: true,
      type: 'article',
      publishedTime: '2026-01-01',
      noindex: true,
      images: [{ url: '/images/x.png' }],
    })
    expect(meta.title).toEqual({ absolute: 'About' })
    expect(meta.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-01-01' })
    expect((meta.openGraph as { images: { url: string }[] }).images[0].url).toBe(
      'https://www.keltoummalouki.com/images/x.png',
    )
    expect(meta.robots).toEqual({ index: false, follow: true })
  })

  it('shortens a too-long <title> but keeps the full title for Open Graph and Twitter', () => {
    const title = `${REPARELIYA_FR} — Étude de cas`
    const meta = buildPageMetadata({ ...base, title, shortTitle: REPARELIYA_FR })
    expect(meta.title).toEqual({ absolute: REPARELIYA_FR })
    expect(meta.openGraph).toMatchObject({ title })
    expect(meta.twitter).toMatchObject({ title })
  })
})

describe('fitTitle', () => {
  it('keeps the preferred title when it fits with the site name', () => {
    const title = 'Caffeine — Coffee & Tea House — Étude de cas'
    expect(fitTitle([title, 'Caffeine — Coffee & Tea House'])).toBe(title)
  })

  it('accepts a title of exactly the limit once suffixed', () => {
    const title = 'CI/CD GitHub Actions et GitLab CI : tutoriel Node.js'
    expect(rendered(fitTitle([title]))).toHaveLength(MAX_TITLE_LENGTH)
    expect(fitTitle([title])).toBe(title)
  })

  it('drops the label before the site name', () => {
    expect(fitTitle([`${SENDLY_FR} — Étude de cas`, SENDLY_FR])).toBe(SENDLY_FR)
  })

  it('drops the site name when no candidate fits with it', () => {
    expect(fitTitle([`${REPARELIYA_FR} — Étude de cas`, REPARELIYA_FR])).toEqual({ absolute: REPARELIYA_FR })
  })

  it('cuts an over-long last candidate on a word boundary', () => {
    const title = rendered(fitTitle(['word '.repeat(30)]))
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
    expect(title).toMatch(/^word( word)*…$/)
  })

  it.each([
    ['fr', `${REPARELIYA_FR} — Étude de cas`, REPARELIYA_FR],
    ['fr', 'DabaDigital — Agence digitale & plateforme de gestion — Étude de cas', 'DabaDigital — Agence digitale & plateforme de gestion'],
    ['en', 'Sendly — Commerce, Marketplace & Delivery SaaS — Case study', 'Sendly — Commerce, Marketplace & Delivery SaaS'],
    ['ar', 'Repareliya — منصة متكاملة لإدارة متجر الصيانة — دراسة حالة', 'Repareliya — منصة متكاملة لإدارة متجر الصيانة'],
  ])('renders the %s case study %j within the limit', (_locale, title, shortTitle) => {
    expect(rendered(fitTitle([title, shortTitle])).length).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
  })
})

describe('truncateDescription', () => {
  it('keeps short text and collapses whitespace', () => {
    expect(truncateDescription('  a   b ')).toBe('a b')
  })

  it('cuts long text on a word boundary with an ellipsis', () => {
    const out = truncateDescription('word '.repeat(60), 50)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out.endsWith('…')).toBe(true)
  })
})
