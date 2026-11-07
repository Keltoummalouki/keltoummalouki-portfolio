import { afterEach, describe, expect, it, vi } from 'vitest'
import robots from './robots'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('robots', () => {
  it("keeps every crawler group out of Cloudflare's /cdn-cgi/ endpoint in production", () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const rules = [robots().rules].flat()
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) expect(rule.disallow).toEqual(expect.arrayContaining(['/admin', '/api', '/cdn-cgi/']))
  })

  it('blocks everything on preview deployments', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(robots().rules).toEqual([{ userAgent: '*', disallow: '/' }])
  })
})
