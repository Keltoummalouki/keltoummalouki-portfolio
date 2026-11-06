import { describe, expect, it } from 'vitest'
import { formatStartingPrice, mapPublicServices, serviceSlug, splitLines, type ServiceRow } from './services'

function row(overrides: Partial<ServiceRow>): ServiceRow {
  return {
    id: 'id',
    slug: 'slug',
    status: 'published',
    sort_order: 0,
    icon: null,
    title: {},
    description: {},
    includes: {},
    price_from: null,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
    ...overrides,
  }
}

describe('splitLines', () => {
  it('keeps non-empty lines and strips typed bullets', () => {
    expect(splitLines('- Design\n\n• Development \r\n* Deployment\nSupport')).toEqual([
      'Design',
      'Development',
      'Deployment',
      'Support',
    ])
  })
})

describe('mapPublicServices', () => {
  it('orders packages, localizes them and parses the included items', () => {
    const packages = mapPublicServices(
      [
        row({
          id: 'shop',
          sort_order: 2,
          title: { fr: 'Boutique', en: 'Online shop' },
          price_from: 2500,
        }),
        row({
          id: 'site',
          sort_order: 1,
          title: { fr: 'Site vitrine' },
          description: { fr: 'Présentez votre activité.' },
          includes: { fr: 'Design responsive\nSEO de base' },
        }),
      ],
      'en',
    )

    expect(packages).toEqual([
      // No English copy: falls back to French.
      { id: 'site', title: 'Site vitrine', description: 'Présentez votre activité.', includes: ['Design responsive', 'SEO de base'], priceFrom: null },
      { id: 'shop', title: 'Online shop', description: '', includes: [], priceFrom: 2500 },
    ])
  })

  it('drops packages without a name', () => {
    expect(mapPublicServices([row({ title: { fr: '  ' } })], 'fr')).toEqual([])
  })
})

describe('formatStartingPrice', () => {
  it('formats whole euros in the visitor locale', () => {
    expect(formatStartingPrice(1500, 'en')).toBe('€1,500')
    expect(formatStartingPrice(1500, 'fr')).toMatch(/^1\s500\s€$/)
  })
})

describe('serviceSlug', () => {
  it('builds a URL-safe slug from any title', () => {
    expect(serviceSlug('Site vitrine & SEO')).toBe('site-vitrine-seo')
    expect(serviceSlug('  Création d’application  ')).toBe('creation-d-application')
  })

  it('falls back when the title has no Latin characters', () => {
    expect(serviceSlug('موقع تعريفي')).toBe('package')
  })
})
