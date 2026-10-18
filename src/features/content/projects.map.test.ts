import { describe, it, expect } from 'vitest'
import {
  caseStudyUrls,
  formatProjectDate,
  latestIsoDate,
  markdownToPlainText,
  parseStackList,
  projectHost,
  projectSummary,
  toProjectCard,
  toProjectDetail,
  type ProjectInput,
} from './projects.map'

const base: ProjectInput = {
  id: 'p1',
  slug: 'event-booking-app',
  cover_image_url: '/images/cover.png',
  repo_url: 'https://github.com/example/repo',
  demo_url: null,
  featured: true,
  tech_stack: ['Next.js', 'TypeScript'],
  started_at: '2025-04-01',
  project_translations: [
    { locale: 'fr', title: 'Titre FR', description: 'Desc FR' },
    { locale: 'en', title: 'Title EN', description: 'Desc EN' },
  ],
}

describe('toProjectCard', () => {
  it('uses the requested locale translation', () => {
    const card = toProjectCard(base, 'en')
    expect(card.slug).toBe('event-booking-app')
    expect(card.title).toBe('Title EN')
    expect(card.description).toBe('Desc EN')
    expect(card.stack).toEqual(['Next.js', 'TypeScript'])
    expect(card.image).toBe('/images/cover.png')
  })

  it('falls back to tech_stack when no skills are linked', () => {
    const card = toProjectCard(base, 'fr')
    expect(card.stack).toEqual(['Next.js', 'TypeScript'])
    expect(card.stackItems).toEqual([
      { name: 'Next.js', icon: null, imageUrl: null },
      { name: 'TypeScript', icon: null, imageUrl: null },
    ])
  })

  it('prefers linked skills (ordered by sort_order) over tech_stack', () => {
    const card = toProjectCard(
      {
        ...base,
        project_skills: [
          { sort_order: 1, skills: { id: 's2', name: 'Docker', icon: 'docker', image_url: null } },
          { sort_order: 0, skills: { id: 's1', name: 'React', icon: null, image_url: '/img/react.png' } },
        ],
      },
      'en',
    )
    expect(card.stack).toEqual(['React', 'Docker'])
    expect(card.stackItems).toEqual([
      { name: 'React', icon: null, imageUrl: '/img/react.png' },
      { name: 'Docker', icon: 'docker', imageUrl: null },
    ])
  })

  it('ignores links whose skill is missing (e.g. unpublished)', () => {
    const card = toProjectCard(
      {
        ...base,
        project_skills: [
          { sort_order: 0, skills: null },
          { sort_order: 1, skills: { id: 's1', name: 'React', icon: null, image_url: null } },
        ],
      },
      'en',
    )
    expect(card.stack).toEqual(['React'])
  })

  it('falls back to the default locale (fr) when the requested locale is missing', () => {
    const card = toProjectCard(base, 'ar')
    expect(card.title).toBe('Titre FR')
  })

  it('returns empty title when there are no translations', () => {
    const card = toProjectCard({ ...base, project_translations: [] }, 'fr')
    expect(card.title).toBe('')
    expect(card.description).toBeNull()
  })

  it('returns a null dateLabel when started_at is missing', () => {
    const card = toProjectCard({ ...base, started_at: null }, 'fr')
    expect(card.dateLabel).toBeNull()
  })

  it('formats the start date as month + year in the requested locale', () => {
    expect(toProjectCard(base, 'en').dateLabel).toBe('Apr 2025')
  })

  it('ignores translations in unsupported locales', () => {
    const card = toProjectCard(
      { ...base, project_translations: [{ locale: 'de', title: 'Titel', description: null }] },
      'fr',
    )
    expect(card.title).toBe('')
  })
})

describe('formatProjectDate', () => {
  it('never shifts the month (dates are interpreted in UTC)', () => {
    expect(formatProjectDate('2025-12-01', 'en')).toBe('Dec 2025')
    expect(formatProjectDate('2025-04-01', 'fr')).toMatch(/avr\.? 2025/)
  })

  it('returns null for missing or invalid dates', () => {
    expect(formatProjectDate(null, 'en')).toBeNull()
    expect(formatProjectDate('not-a-date', 'en')).toBeNull()
  })
})

describe('projectHost', () => {
  it('returns the bare host of a web URL', () => {
    expect(projectHost('https://www.example.com/fr/demo?x=1')).toBe('example.com')
    expect(projectHost('https://app.vercel.app')).toBe('app.vercel.app')
    expect(projectHost('http://localhost:3000')).toBe('localhost')
  })

  it('returns null for missing, invalid or non-web URLs', () => {
    expect(projectHost(null)).toBeNull()
    expect(projectHost('')).toBeNull()
    expect(projectHost('not a url')).toBeNull()
    expect(projectHost('mailto:hello@example.com')).toBeNull()
  })
})

describe('parseStackList', () => {
  it('splits Latin and Arabic commas and trims names', () => {
    expect(parseStackList('NestJS, Next.js ,TypeScript')).toEqual(['NestJS', 'Next.js', 'TypeScript'])
    expect(parseStackList('NestJS، Next.js، Docker')).toEqual(['NestJS', 'Next.js', 'Docker'])
    expect(parseStackList(' , ')).toEqual([])
  })
})

describe('latestIsoDate', () => {
  it('returns the most recent valid date as ISO', () => {
    expect(latestIsoDate('2026-01-01T00:00:00Z', null, '2026-03-01T10:00:00Z', 'bad')).toBe(
      '2026-03-01T10:00:00.000Z',
    )
  })

  it('returns null when no date is valid', () => {
    expect(latestIsoDate(null, undefined, '')).toBeNull()
  })
})

describe('toProjectDetail', () => {
  const detailBase: ProjectInput = {
    ...base,
    updated_at: '2026-01-10T08:00:00Z',
    project_translations: [
      { locale: 'fr', title: 'Titre FR', description: 'Desc FR', body_markdown: '## Vue\n\nCorps FR', updated_at: '2026-02-01T00:00:00Z' },
      { locale: 'en', title: 'Title EN', description: 'Desc EN', body_markdown: '   ', updated_at: '2025-12-01T00:00:00Z' },
    ],
  }

  it('maps the card fields plus the case study of the requested locale', () => {
    const detail = toProjectDetail(detailBase, 'fr')
    expect(detail.slug).toBe('event-booking-app')
    expect(detail.title).toBe('Titre FR')
    expect(detail.bodyMarkdown).toBe('## Vue\n\nCorps FR')
    expect(detail.startedAt).toBe('2025-04-01')
    expect(detail.github).toBe('https://github.com/example/repo')
    expect(detail.stack).toEqual(['Next.js', 'TypeScript'])
    expect(detail.contentLocale).toBe('fr')
  })

  it('treats a blank case study as missing (no cross-language fallback)', () => {
    const detail = toProjectDetail(detailBase, 'en')
    expect(detail.title).toBe('Title EN')
    expect(detail.bodyMarkdown).toBeNull()
    expect(detail.contentLocale).toBe('en')
  })

  it('falls back to the default-locale translation and reports its locale', () => {
    const detail = toProjectDetail(detailBase, 'ar')
    expect(detail.title).toBe('Titre FR')
    expect(detail.bodyMarkdown).toBe('## Vue\n\nCorps FR')
    expect(detail.contentLocale).toBe('fr')
  })

  it('lists only locales that have a titled translation', () => {
    expect(toProjectDetail(detailBase, 'fr').availableLocales).toEqual(['fr', 'en'])
  })

  it('uses the latest of the project and shown-translation update times', () => {
    expect(toProjectDetail(detailBase, 'fr').updatedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(toProjectDetail(detailBase, 'en').updatedAt).toBe('2026-01-10T08:00:00.000Z')
  })

  it('handles a project without translations', () => {
    const detail = toProjectDetail({ ...base, project_translations: [] }, 'en')
    expect(detail.title).toBe('')
    expect(detail.bodyMarkdown).toBeNull()
    expect(detail.contentLocale).toBe('en')
    expect(detail.availableLocales).toEqual([])
    expect(detail.updatedAt).toBeNull()
  })
})

describe('markdownToPlainText', () => {
  it('strips headings, emphasis, links, tables and code', () => {
    const text = markdownToPlainText(
      '## Overview\n\n**Bold** and [a link](https://x.y) with `code`.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1\n```',
    )
    expect(text).toBe('Overview Bold and a link with code. A B 1 2')
  })
})

describe('projectSummary', () => {
  it('prefers the description', () => {
    expect(projectSummary({ description: '  Short description.  ', bodyMarkdown: '## A\n\nBody.' })).toBe(
      'Short description.',
    )
  })

  it('falls back to the first non-heading paragraph of the case study', () => {
    expect(
      projectSummary({
        description: null,
        bodyMarkdown: '## Overview\n\nEvent Booking App is a **full-stack** app by [Keltoum Malouki](/en).\n\n## More',
      }),
    ).toBe('Event Booking App is a full-stack app by Keltoum Malouki.')
  })

  it('returns an empty string when there is nothing to summarize', () => {
    expect(projectSummary({ description: '', bodyMarkdown: null })).toBe('')
  })
})

describe('caseStudyUrls', () => {
  it('keeps the requested locale canonical when it is translated', () => {
    const urls = caseStudyUrls({ slug: 'reservez-moi', availableLocales: ['fr', 'en'], contentLocale: 'en' }, 'en')
    expect(urls.path).toBe('/projects/reservez-moi')
    expect(urls.canonicalLocale).toBe('en')
    expect(urls.localizedPaths).toEqual({ fr: '/projects/reservez-moi', en: '/projects/reservez-moi' })
  })

  it('canonicalizes an untranslated locale to the language shown', () => {
    const urls = caseStudyUrls({ slug: 'reservez-moi', availableLocales: ['fr', 'en'], contentLocale: 'fr' }, 'ar')
    expect(urls.canonicalLocale).toBe('fr')
    expect(urls.localizedPaths.ar).toBeUndefined()
  })

  it('falls back to the content locale when no locale is listed', () => {
    const urls = caseStudyUrls({ slug: 'x', availableLocales: [], contentLocale: 'en' }, 'fr')
    expect(urls.canonicalLocale).toBe('en')
    expect(urls.localizedPaths).toEqual({ en: '/projects/x' })
  })
})
