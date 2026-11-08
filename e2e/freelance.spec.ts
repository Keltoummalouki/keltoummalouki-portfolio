import { expect, test, type Page } from '@playwright/test'

// The request form on /freelance. The server runs with an unreachable Supabase
// (see playwright.config.ts), so a valid submission reaches the Server Action and
// comes back with its generic error; nothing is ever written to a real database.

const option = (page: Page, name: string, value: string) =>
  page.locator(`label:has(input[name="${name}"][value="${value}"])`)

const isChecked = (page: Page, name: string, value: string) =>
  page.locator(`input[name="${name}"][value="${value}"]`).isChecked()

/** Records Server Action calls, to prove what stays in the browser. */
function watchServerActions(page: Page): string[] {
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['next-action']) calls.push(request.url())
  })
  return calls
}

test.describe('request form', () => {
  test('asks one thing at a time and keeps the answers between steps', async ({ page }) => {
    await page.goto('/en/freelance')
    await expect(page.getByRole('heading', { level: 1, name: 'Work with me' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible()
    await expect(page.locator('#lead-email')).toBeHidden()

    await option(page, 'projectType', 'ecommerce').click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByRole('heading', { name: 'What’s the budget and timing?' })).toBeFocused()
    await option(page, 'budget', '1k_5k').click()
    await option(page, 'timeline', 'asap').click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByRole('heading', { name: 'Tell me about it' })).toBeFocused()
    await expect(page.locator('#lead-email')).toBeVisible()

    // The answers so far show as a summary, and each one leads back to its step.
    await page.getByRole('button', { name: 'Change: E-commerce' }).click()
    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeFocused()
    expect(await isChecked(page, 'projectType', 'ecommerce')).toBe(true)

    await page.getByRole('button', { name: /Budget & timing/ }).click()
    expect(await isChecked(page, 'budget', '1k_5k')).toBe(true)
    expect(await isChecked(page, 'timeline', 'asap')).toBe(true)
  })

  test('lets a visitor skip the optional steps', async ({ page }) => {
    await page.goto('/en/freelance')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('button', { name: 'Send my request' })).toBeVisible()
  })

  test('moves on with Enter from a selected answer, without sending anything', async ({ page }) => {
    const actions = watchServerActions(page)
    await page.goto('/en/freelance')
    await page.locator('input[name="projectType"][value="website"]').focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'What’s the budget and timing?' })).toBeVisible()
    expect(actions).toHaveLength(0)
  })

  test('blocks an incomplete request in the browser and points to the first problem', async ({ page }) => {
    const actions = watchServerActions(page)
    await page.goto('/en/freelance')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Send my request' }).click()

    await expect(page.getByText('Please add a few details (at least 10 characters).')).toBeVisible()
    await expect(page.getByText('Please enter your name.')).toBeVisible()
    await expect(page.getByText('Please enter a valid email.')).toBeVisible()
    await expect(page.locator('#lead-details')).toBeFocused()
    await expect(page.locator('#lead-details')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#lead-details')).toHaveAttribute('aria-describedby', 'lead-details-error')

    // Fixing a field clears its message right away.
    await page.locator('#lead-details').fill('A booking site for a small clinic.')
    await expect(page.getByText('Please add a few details (at least 10 characters).')).toBeHidden()
    expect(actions).toHaveLength(0)
  })

  test('keeps every answer when the server refuses the request', async ({ page }) => {
    await page.goto('/en/freelance')
    await option(page, 'projectType', 'api').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await option(page, 'budget', '5k_15k').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.locator('#lead-details').fill('An API for a booking application.')
    await page.locator('#lead-name').fill('Playwright Tester')
    await page.locator('#lead-email').fill('tester@example.com')
    await option(page, 'contactPreference', 'video').click()

    const action = page.waitForRequest((request) => request.method() === 'POST' && !!request.headers()['next-action'])
    await page.getByRole('button', { name: 'Send my request' }).click()
    await action

    // The test backend is offline on purpose, so the server answers with its generic error.
    await expect(page.locator('#request').getByRole('alert')).toContainText('Something went wrong')
    await expect(page.getByRole('button', { name: 'Send my request' })).toBeEnabled()

    await expect(page.locator('#lead-details')).toHaveValue('An API for a booking application.')
    await expect(page.locator('#lead-name')).toHaveValue('Playwright Tester')
    await expect(page.locator('#lead-email')).toHaveValue('tester@example.com')
    expect(await isChecked(page, 'contactPreference', 'video')).toBe(true)
    expect(await isChecked(page, 'projectType', 'api')).toBe(true)
    expect(await isChecked(page, 'budget', '5k_15k')).toBe(true)
  })

  test('sentence starters fill the details and leave the cursor ready to type', async ({ page }) => {
    await page.goto('/en/freelance')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'The main goal is…' }).click()
    await expect(page.locator('#lead-details')).toBeFocused()
    await page.keyboard.type('more bookings.')
    await expect(page.locator('#lead-details')).toHaveValue('The main goal is more bookings.')
  })

  test('works from the keyboard alone', async ({ page }) => {
    await page.goto('/en/freelance')
    await page.locator('input[name="projectType"][value="web_app"]').focus()
    await page.keyboard.press('ArrowRight')
    expect(await isChecked(page, 'projectType', 'website')).toBe(true)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused()
  })
})

test('keeps the first-visit preference panel off the form, for the next page to open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/en/freelance')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/en/blog')
  await expect(page.getByRole('dialog')).toBeVisible()
})

test.describe('3D model', () => {
  test('stays out of assistive technology', async ({ page }) => {
    await page.goto('/en/freelance')
    await expect(page.locator('[data-mode]')).toHaveAttribute('aria-hidden', 'true')
  })

  test('falls back to the drawing without WebGL, and the form keeps working', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext as (...args: unknown[]) => unknown
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type.includes('webgl') ? null : original.call(this, type, ...rest)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto('/en/freelance')

    const stage = page.locator('[data-mode]')
    await expect(stage).toHaveAttribute('data-mode', 'static')
    await expect(stage.locator('svg').first()).toBeVisible()

    await option(page, 'projectType', 'website').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'What’s the budget and timing?' })).toBeVisible()
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('shows every field at once and can still be sent', async ({ page }) => {
    await page.goto('/en/freelance')
    await expect(page.locator('#lead-email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeHidden()

    await page.locator('label:has(input[name="projectType"][value="website"])').click()
    await page.locator('#lead-details').fill('A site for a small clinic, in two languages.')
    await page.locator('#lead-name').fill('Playwright Tester')
    await page.locator('#lead-email').fill('tester@example.com')

    await page.getByRole('button', { name: 'Send my request' }).click()
    await expect(page.locator('#request').getByRole('alert')).toContainText('Something went wrong')
  })
})

test.describe('layout', () => {
  test('never scrolls sideways on a small phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/en/freelance')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('mirrors for Arabic', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/ar/freelance')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'ماذا سنبني؟' })).toBeVisible()

    // The form column comes first in reading order, so it sits on the left in RTL.
    const [title, form] = await Promise.all([
      page.getByRole('heading', { level: 1 }).boundingBox(),
      page.getByRole('heading', { name: 'ماذا سنبني؟' }).boundingBox(),
    ])
    expect(title && form).toBeTruthy()
    expect(title!.x).toBeGreaterThan(form!.x)
  })
})
