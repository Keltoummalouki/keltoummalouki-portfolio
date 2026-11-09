import { expect, test, type Locator } from '@playwright/test'

// Smoke tests for what unit tests can't see: real rendering, routing, the
// browser side of forms, and right-to-left layout. The server runs with an
// unreachable Supabase (see playwright.config.ts), so pages show their
// built-in fallback content and nothing is ever written to a real database.

test.describe('contact form', () => {
  // Marks the first-visit preference panel as seen. It opens once the page has
  // hydrated and takes the focus: on a busy machine that lands mid-fill and the
  // typed name never reaches its field.
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'visitor-design', value: encodeURIComponent('{"seen":true}'), url: baseURL! }])
  })

  test('blocks an invalid submission in the browser', async ({ page }) => {
    const serverActions: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action']) serverActions.push(request.url())
    })

    await page.goto('/en#contact')
    await page.getByRole('button', { name: 'Send message' }).click()

    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.locator('#contact-name')).toBeFocused()
    await expect(page.locator('#contact-name')).toHaveAttribute('aria-invalid', 'true')
    expect(serverActions).toHaveLength(0)
  })

  test('sends a valid message to the server and reports the outcome', async ({ page }) => {
    await page.goto('/en#contact')
    await page.locator('#contact-name').fill('Playwright Tester')
    await page.locator('#contact-email').fill('tester@example.com')
    await page.locator('#contact-message').fill('Hello! This is an automated end-to-end test message.')

    const action = page.waitForRequest((request) => request.method() === 'POST' && !!request.headers()['next-action'])
    await page.getByRole('button', { name: 'Send message' }).click()
    await action

    // The test backend is offline on purpose, so the server answers with its
    // generic error. What matters: the action ran and the UI recovered, with a
    // way round it. Scoped: Next.js's route announcer is also a role="alert" element.
    const alert = page.locator('#contact').getByRole('alert')
    await expect(alert).toContainText('Please try again in a moment')
    await expect(alert.getByRole('link', { name: 'Email me instead' })).toHaveAttribute('href', /^mailto:/)
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })
})

test.describe('language switch', () => {
  test('switches from English to French and keeps the page', async ({ page }) => {
    await page.goto('/en/about')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.getByRole('button', { name: /English — change language/ }).click()
    await page.getByRole('button', { name: 'Français' }).click()

    // The server renders the French page before the URL changes (/about also
    // waits on the GitHub API, up to its timeout), so allow more than the default.
    await expect(page).toHaveURL(/\/fr\/about$/, { timeout: 15_000 })
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('switching to Arabic flips the page to right-to-left without a reload', async ({ page }) => {
    await page.goto('/en/about')
    await page.getByRole('button', { name: /English — change language/ }).click()
    await page.getByRole('button', { name: 'العربية' }).click()

    await expect(page).toHaveURL(/\/ar\/about$/, { timeout: 15_000 })
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  })

  test('redirects an unprefixed URL to a locale', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/(fr|en|ar)$/)
  })
})

test.describe('home profile', () => {
  test('shows the built-in bio with the CMS offline, its traits and a link to the full profile', async ({ page }) => {
    await page.goto('/en')
    const profile = page.locator('#profile')

    // messages `about.description`: the text the dashboard form pre-fills too.
    await expect(profile).toContainText('a Full Stack Web Developer from Casablanca')
    await expect(profile.getByRole('list', { name: 'Qualities' }).getByRole('listitem')).toHaveCount(4)
    await expect(profile.getByRole('link', { name: 'More about me' })).toHaveAttribute('href', '/en/about')
  })
})

test.describe('experience cards', () => {
  /** Puts the card's centre at this share of the viewport height. */
  const scrollCardTo = (card: Locator, share: number) =>
    card.evaluate((el, share) => {
      const item = el.closest('.timeline-item')!.getBoundingClientRect()
      window.scrollTo(0, window.scrollY + item.top + item.height / 2 - share * window.innerHeight)
    }, share)

  /** Drawn width over layout width: below 1 while the card is scaled down or turned. */
  const drawnScale = (card: Locator) =>
    card.evaluate((el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth)

  test.describe('with motion allowed', () => {
    test.use({ reducedMotion: 'no-preference' })

    test('shrink at the edge of the screen and rest full size in the middle', async ({ page, context, baseURL }) => {
      // Marks the first-visit preference panel as seen, so it can't pause the scroll.
      await context.addCookies([{ name: 'visitor-design', value: encodeURIComponent('{"seen":true}'), url: baseURL! }])
      await page.goto('/en')
      const card = page.locator('#experience [data-card]').first()

      await scrollCardTo(card, 0.9)
      await expect.poll(() => drawnScale(card)).toBeLessThan(0.9)

      await scrollCardTo(card, 0.5)
      await expect.poll(() => drawnScale(card)).toBeCloseTo(1, 2)
    })
  })

  test('stay flat under reduced motion', async ({ page }) => {
    await page.goto('/en')
    await page.waitForLoadState('networkidle')
    const card = page.locator('#experience [data-card]').first()

    await scrollCardTo(card, 0.9)
    await expect(card).toHaveCSS('transform', 'none')
  })
})

test.describe('Arabic right-to-left layout', () => {
  test('renders the Arabic site right to left', async ({ page }) => {
    await page.goto('/ar')

    const html = page.locator('html')
    await expect(html).toHaveAttribute('lang', 'ar')
    await expect(html).toHaveAttribute('dir', 'rtl')
    expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl')

    // Arabic UI copy, not a fallback language.
    await expect(page.getByRole('button', { name: 'إرسال الرسالة' })).toBeVisible()
  })

  test('mirrors the layout: start-aligned text sits on the right', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/ar#contact')

    const label = page.locator('label[for="contact-name"]')
    const field = page.locator('#contact-name')
    const [labelBox, fieldBox] = await Promise.all([label.boundingBox(), field.boundingBox()])
    expect(labelBox && fieldBox).toBeTruthy()
    // The label hugs the field's right edge in RTL (its left edge in LTR).
    expect(Math.abs(labelBox!.x + labelBox!.width - (fieldBox!.x + fieldBox!.width))).toBeLessThan(4)
  })
})
