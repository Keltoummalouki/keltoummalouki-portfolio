import { describe, expect, it } from 'vitest'
import { readVisitorDesignCookie, visitorDesignCookieString } from './options'

describe('readVisitorDesignCookie', () => {
  it('reads the preference back from document.cookie', () => {
    const written = visitorDesignCookieString({ fontBody: 'inter', headerPosition: 'left', seen: true })
    const cookieHeader = `theme=dark; ${written.split(';')[0]}; NEXT_LOCALE=fr`
    expect(readVisitorDesignCookie(cookieHeader)).toEqual({ fontBody: 'inter', headerPosition: 'left', seen: true })
  })

  it('returns an empty preference when the cookie is absent or broken', () => {
    expect(readVisitorDesignCookie('')).toEqual({})
    expect(readVisitorDesignCookie('theme=dark')).toEqual({})
    expect(readVisitorDesignCookie('visitor-design=%7Bnot-json')).toEqual({})
  })

  it('drops unknown values', () => {
    expect(readVisitorDesignCookie(`visitor-design=${encodeURIComponent('{"fontBody":"comic-sans","seen":true}')}`)).toEqual({ seen: true })
  })
})
