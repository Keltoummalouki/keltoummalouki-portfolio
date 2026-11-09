import { expect, test, type Page } from '@playwright/test'

// The home page's contact form and the 3D letter beside it. The server runs with
// an unreachable Supabase (see playwright.config.ts), so a valid message reaches
// the Server Action and comes back with its generic error; nothing is ever
// written to a real database.

const topic = (page: Page, value: string) => page.locator(`#contact label:has(input[name="topic"][value="${value}"])`)

/** Records Server Action calls, to prove what stays in the browser. */
function watchServerActions(page: Page): string[] {
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['next-action']) calls.push(request.url())
  })
  return calls
}

async function fillValidMessage(page: Page) {
  await page.locator('#contact-name').fill('Playwright Tester')
  await page.locator('#contact-email').fill('tester@example.com')
  await page.locator('#contact-message').fill('Hello! This is an automated end-to-end test message.')
}

// The first-visit preference panel opens after hydration and takes the focus: on a
// busy machine that lands mid-fill. Marked as seen for every test here.
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'visitor-design', value: encodeURIComponent('{"seen":true}'), url: baseURL! }])
})

test.describe('contact form', () => {
  test('a topic tailors the message prompt, and Enter on a topic moves on without sending', async ({ page }) => {
    const actions = watchServerActions(page)
    await page.goto('/en#contact')
    const message = page.locator('#contact-message')
    await expect(message).toHaveAttribute('placeholder', 'Tell me what’s on your mind…')

    await topic(page, 'job').click()
    await expect(message).toHaveAttribute('placeholder', 'The role, the team, and what happens next…')

    await page.locator('#contact input[name="topic"][value="other"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#contact-name')).toBeFocused()
    expect(actions).toHaveLength(0)
  })

  test('points a project to the freelance form', async ({ page }) => {
    await page.goto('/en#contact')
    const link = page.locator('#contact').getByRole('link', { name: 'Open the project form' })
    await expect(link).toHaveCount(0)
    await topic(page, 'project').click()
    await expect(link).toHaveAttribute('href', '/en/freelance')
  })

  test('sends the topic with the message, and keeps every answer when the server refuses', async ({ page }) => {
    await page.goto('/en#contact')
    await topic(page, 'job').click()
    await fillValidMessage(page)

    const action = page.waitForRequest((request) => request.method() === 'POST' && !!request.headers()['next-action'])
    await page.getByRole('button', { name: 'Send message' }).click()
    // FormData travels as multipart; React prefixes each field with its argument's id.
    expect((await action).postData() ?? '').toMatch(/name="[^"]*topic"\r\n\r\njob\r\n/)

    await expect(page.locator('#contact').getByRole('alert')).toBeVisible()
    await expect(page.locator('#contact input[name="topic"][value="job"]')).toBeChecked()
    await expect(page.locator('#contact-name')).toHaveValue('Playwright Tester')
    await expect(page.locator('#contact-message')).toHaveValue('Hello! This is an automated end-to-end test message.')
  })

  test('keeps an unsent message for the visit, across a reload', async ({ page }) => {
    await page.goto('/en#contact')
    await topic(page, 'other').click()
    await page.locator('#contact-name').fill('Draft Keeper')
    await page.locator('#contact-message').fill('Half a thought, to finish later.')

    await page.reload()
    await expect(page.locator('#contact-name')).toHaveValue('Draft Keeper')
    await expect(page.locator('#contact-message')).toHaveValue('Half a thought, to finish later.')
    await expect(page.locator('#contact input[name="topic"][value="other"]')).toBeChecked()
  })
})

test.describe('3D letter', () => {
  test('stays out of assistive technology', async ({ page }) => {
    await page.goto('/en#contact')
    await expect(page.locator('#contact [data-mode]')).toHaveAttribute('aria-hidden', 'true')
  })

  test('falls back to the drawing without WebGL, and the form keeps working', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext as (...args: unknown[]) => unknown
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type.includes('webgl') ? null : original.call(this, type, ...rest)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto('/en#contact')
    await page.locator('#contact').scrollIntoViewIfNeeded()

    const stage = page.locator('#contact [data-mode]')
    await expect(stage).toHaveAttribute('data-mode', 'static')
    await expect(stage.locator('svg')).toBeVisible()

    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.locator('#contact-name')).toBeFocused()
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('can still be sent', async ({ page }) => {
    await page.goto('/en')
    await page.locator('label:has(input[name="topic"][value="project"])').click()
    await fillValidMessage(page)
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.locator('#contact').getByRole('alert')).toContainText('Please try again in a moment')
  })
})

test.describe('layout', () => {
  test('never scrolls sideways on a small phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/en#contact')
    await page.locator('#contact').scrollIntoViewIfNeeded()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('mirrors for Arabic: the letter stands on the other side of the form', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/ar#contact')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    const [stage, form] = await Promise.all([
      page.locator('#contact [data-mode]').boundingBox(),
      page.locator('#contact form').boundingBox(),
    ])
    expect(stage && form).toBeTruthy()
    expect(stage!.x).toBeGreaterThan(form!.x)
  })
})
