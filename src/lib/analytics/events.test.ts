import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTrackedClick, trackClick, trackEvent } from './events'

/** Minimal element backed by the attributes trackClick() returns. */
function element(attributes: Record<string, string>) {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    getAttributeNames: () => Object.keys(attributes),
  }
}

describe('trackClick', () => {
  it('marks an element with the event and its properties', () => {
    expect(trackClick('project-demo', { project: 'sendly', from: 'home' })).toEqual({
      'data-track': 'project-demo',
      'data-track-project': 'sendly',
      'data-track-from': 'home',
    })
  })
})

describe('readTrackedClick', () => {
  it('reads back what trackClick() wrote, ignoring other attributes', () => {
    const attributes = { ...trackClick('contact-link', { channel: 'email', from: 'contact' }), href: 'mailto:x@y.z', class: 'row' }
    expect(readTrackedClick(element(attributes))).toEqual({
      event: 'contact-link',
      data: { channel: 'email', from: 'contact' },
    })
  })

  it('ignores elements that are not marked', () => {
    expect(readTrackedClick(element({ href: '/projects' }))).toBeNull()
  })
})

describe('trackEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing on the server or before the tracker loads', () => {
    expect(() => trackEvent('contact-form-sent')).not.toThrow()
    vi.stubGlobal('window', {})
    expect(() => trackEvent('contact-form-sent')).not.toThrow()
  })

  it('sends the event through the loaded tracker', () => {
    const track = vi.fn()
    vi.stubGlobal('window', { umami: { track } })
    trackEvent('lead-form-sent', { type: 'website' })
    expect(track).toHaveBeenCalledWith('lead-form-sent', { type: 'website' })
  })
})
