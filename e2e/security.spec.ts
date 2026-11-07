import { expect, test, type Page } from '@playwright/test'

// Security checks against the production build: the Content Security Policy
// forbids eval, no page needs anything the policy blocks (a blocked script
// fails silently, so the smoke tests would not notice), and security.txt is
// served where vulnerability reporters and scanners look for it.

type Violation = { directive: string; blocked: string; source: string }

/** Records the page's CSP violations, starting before its first script runs. */
async function watchCspViolations(page: Page): Promise<() => Promise<Violation[]>> {
  await page.addInitScript(() => {
    const seen: Violation[] = []
    Object.assign(window, { __cspViolations: seen })
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        source: `${event.sourceFile}:${event.lineNumber}`,
      })
    })
  })
  return () => page.evaluate(() => (window as unknown as { __cspViolations: Violation[] }).__cspViolations)
}

/** Scrolls to the end in steps, so sections that load on approach load too. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  })
}

test('the production CSP does not allow eval', async ({ request }) => {
  const response = await request.get('/en')
  const csp = response.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("script-src 'self'")
  expect(csp).not.toContain('unsafe-eval')
})

test.describe('pages run within the CSP', () => {
  for (const path of ['/en', '/en/about', '/en/projects', '/en/blog', '/en/freelance', '/admin/login']) {
    test(`${path} causes no CSP violation`, async ({ page }) => {
      const violations = await watchCspViolations(page)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await scrollThrough(page)
      await page.waitForLoadState('networkidle')
      expect(await violations()).toEqual([])
    })
  }
})

test('serves security.txt with a contact and an expiry date', async ({ request }) => {
  const response = await request.get('/.well-known/security.txt')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^text\/plain;\s*charset=utf-8/i)
  const body = await response.text()
  expect(body).toMatch(/^Contact: mailto:\S+@\S+$/m)
  expect(body).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/m)
})
