import { describe, it, expect } from 'vitest'
import { framingAllowed } from './projects.embed'

const SITE = 'https://www.keltoummalouki.com'
const DEMO = 'https://demo.example.com/'

const allowed = (headers: { xfo?: string; csp?: string; url?: string }) =>
  framingAllowed(
    { url: headers.url ?? DEMO, xFrameOptions: headers.xfo ?? null, contentSecurityPolicy: headers.csp ?? null },
    SITE,
  )

describe('framingAllowed', () => {
  it('allows a page that sends no framing headers', () => {
    expect(allowed({})).toBe(true)
  })

  it('applies X-Frame-Options like browsers do', () => {
    expect(allowed({ xfo: 'DENY' })).toBe(false)
    expect(allowed({ xfo: 'SAMEORIGIN' })).toBe(false)
    expect(allowed({ xfo: 'SAMEORIGIN', url: `${SITE}/demo` })).toBe(true)
    expect(allowed({ xfo: 'deny, sameorigin' })).toBe(false)
    // Obsolete / unknown values are ignored.
    expect(allowed({ xfo: 'ALLOW-FROM https://www.keltoummalouki.com' })).toBe(true)
  })

  it('matches frame-ancestors sources against the site origin', () => {
    expect(allowed({ csp: "frame-ancestors 'none'" })).toBe(false)
    expect(allowed({ csp: 'frame-ancestors' })).toBe(false)
    expect(allowed({ csp: "frame-ancestors 'self'" })).toBe(false)
    expect(allowed({ csp: "frame-ancestors 'self'", url: `${SITE}/demo` })).toBe(true)
    expect(allowed({ csp: 'frame-ancestors *' })).toBe(true)
    expect(allowed({ csp: 'frame-ancestors https:' })).toBe(true)
    expect(allowed({ csp: "default-src 'self'; frame-ancestors 'self' https://www.keltoummalouki.com" })).toBe(true)
    expect(allowed({ csp: 'frame-ancestors https://*.keltoummalouki.com' })).toBe(true)
    expect(allowed({ csp: 'frame-ancestors *.keltoummalouki.com' })).toBe(true)
    expect(allowed({ csp: 'frame-ancestors http://www.keltoummalouki.com' })).toBe(true)
    expect(allowed({ csp: 'frame-ancestors https://keltoummalouki.com' })).toBe(false)
    expect(allowed({ csp: 'frame-ancestors https://www.keltoummalouki.com:8443' })).toBe(false)
    expect(allowed({ csp: 'frame-ancestors https://other.example' })).toBe(false)
  })

  it('lets frame-ancestors override X-Frame-Options', () => {
    expect(allowed({ xfo: 'DENY', csp: 'frame-ancestors https://www.keltoummalouki.com' })).toBe(true)
    expect(allowed({ xfo: 'SAMEORIGIN', csp: "default-src 'self'" })).toBe(false)
  })

  it('requires every policy that sets frame-ancestors to allow the site', () => {
    expect(allowed({ csp: "frame-ancestors *, frame-ancestors 'none'" })).toBe(false)
    expect(allowed({ csp: "frame-ancestors *, script-src 'self'" })).toBe(true)
  })

  it('rejects unparsable URLs', () => {
    expect(allowed({ url: 'not a url' })).toBe(false)
  })
})
