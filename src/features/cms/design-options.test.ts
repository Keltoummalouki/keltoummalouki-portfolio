import { describe, expect, it } from 'vitest'
import { DEFAULT_PUBLIC_NAV_ITEMS, NAV_ITEMS, normalizeNavItems, sectionAnchor } from './design-options'

describe('sectionAnchor', () => {
  it('reads the element id of a home-page section', () => {
    expect(sectionAnchor('#projects')).toBe('projects')
  })

  it('reads the element id of a section on another page', () => {
    expect(sectionAnchor('/about#skills')).toBe('skills')
  })
})

describe('NAV_ITEMS', () => {
  it('points every section link at an anchor, optionally on another page', () => {
    for (const item of NAV_ITEMS.filter((navItem) => navItem.kind === 'section')) {
      expect(item.href).toMatch(/^(\/[a-z-]+)?#[a-z-]+$/)
    }
  })

  it('keeps the default links valid', () => {
    expect(normalizeNavItems(DEFAULT_PUBLIC_NAV_ITEMS)).toEqual(DEFAULT_PUBLIC_NAV_ITEMS)
  })
})
