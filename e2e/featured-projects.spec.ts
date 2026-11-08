import { expect, test, type Page } from '@playwright/test'

// The home page's featured projects: short rows that open one project at a time,
// beside a 3D concertina doing the same. The test server has no database, so it
// shows the two fallback projects. The rows are the real interface, so these tests
// hold with or without WebGL; design-system/pages/home-projects.md says how to
// check the model itself.

const FIRST = 'Event Booking App'
const SECOND = 'Réservez-Moi'

const section = (page: Page) => page.locator('#projects')
const list = (page: Page) => section(page).getByRole('list', { name: 'Projects', exact: true })
const row = (page: Page, name: string) => list(page).getByRole('button', { name })
const caseStudy = (page: Page, name: string) => list(page).getByRole('link', { name: `Read the case study: ${name}` })

test.describe('featured projects', () => {
  // Marks the first-visit preference panel as seen, so it can't take the focus.
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'visitor-design', value: encodeURIComponent('{"seen":true}'), url: baseURL! }])
  })

  test('opens one project at a time', async ({ page }) => {
    await page.goto('/en')
    await expect(row(page, FIRST)).toHaveAttribute('aria-expanded', 'true')
    await expect(row(page, SECOND)).toHaveAttribute('aria-expanded', 'false')
    await expect(caseStudy(page, FIRST)).toBeVisible()
    await expect(caseStudy(page, SECOND)).toBeHidden()

    await row(page, SECOND).click()

    await expect(row(page, SECOND)).toHaveAttribute('aria-expanded', 'true')
    await expect(row(page, FIRST)).toHaveAttribute('aria-expanded', 'false')
    await expect(caseStudy(page, SECOND)).toBeVisible()
    await expect(caseStudy(page, FIRST)).toBeHidden()
  })

  test('keeps the open project open when its row is clicked again', async ({ page }) => {
    await page.goto('/en')
    // Forced: the open row is `aria-disabled`, which Playwright refuses to click. A visitor can.
    await row(page, FIRST).click({ force: true })
    await expect(row(page, FIRST)).toHaveAttribute('aria-expanded', 'true')
    await expect(caseStudy(page, FIRST)).toBeVisible()
  })

  test('works from the keyboard', async ({ page }) => {
    await page.goto('/en')
    await row(page, FIRST).focus()

    await page.keyboard.press('ArrowDown')
    await expect(row(page, SECOND)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(row(page, FIRST)).toBeFocused()
    await page.keyboard.press('End')
    await expect(row(page, SECOND)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(row(page, FIRST)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(row(page, SECOND)).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(row(page, SECOND)).toHaveAttribute('aria-expanded', 'true')

    // Tab goes on to the open panel's links, never into a closed one.
    await page.keyboard.press('Tab')
    await expect(caseStudy(page, SECOND)).toBeFocused()
  })

  test('comes back to the same project from its case study', async ({ page }) => {
    await page.goto('/en')
    await row(page, SECOND).click()
    await caseStudy(page, SECOND).click()
    await expect(page).toHaveURL(/\/en\/projects\/reservez-moi$/)

    await page.goBack()

    await expect(row(page, SECOND)).toHaveAttribute('aria-expanded', 'true')
  })

  test('leads to every project', async ({ page }) => {
    await page.goto('/en')
    await expect(section(page).getByRole('link', { name: 'All 2 projects' })).toHaveAttribute('href', '/en/projects')
  })

  test('uses one flat colour for its main action', async ({ page }) => {
    await page.goto('/en')
    await expect(caseStudy(page, FIRST)).toHaveCSS('background-image', 'none')
  })
})

test.describe('3D stage', () => {
  /** Makes the browser report no WebGL, as on an old device or with acceleration off. */
  const withoutWebGL = (page: Page) =>
    page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext as (...args: unknown[]) => unknown
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type.includes('webgl') ? null : original.call(this, type, ...rest)
      } as typeof HTMLCanvasElement.prototype.getContext
    })

  test('stays out of assistive technology', async ({ page }) => {
    await page.goto('/en')
    await expect(section(page).locator('canvas')).toHaveAttribute('aria-hidden', 'true')
  })

  test('falls back to a window showing the open project, without WebGL', async ({ page }) => {
    await withoutWebGL(page)
    await page.goto('/en')
    await section(page).scrollIntoViewIfNeeded()
    const stage = section(page).locator('[data-mode]')
    await expect(stage).toHaveAttribute('data-mode', 'static')
    const cover = (name: string) => stage.getByRole('img', { name: `Screenshot of ${name}, a project by Keltoum Malouki` })
    await expect(cover(FIRST)).toBeVisible()
    await expect(cover(SECOND)).toBeHidden()

    await row(page, SECOND).click()

    await expect(cover(SECOND)).toBeVisible()
    await expect(cover(FIRST)).toBeHidden()
    await expect(stage.getByRole('link', { name: `Read the case study: ${SECOND}` })).toHaveAttribute('href', /reservez-moi$/)
  })
})

test.describe('layout', () => {
  test('fits one screen on a laptop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/en')
    expect((await section(page).boundingBox())!.height).toBeLessThanOrEqual(900)
  })

  test('puts the stage first on a phone, without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/en')
    const stage = await section(page).locator('[data-mode]').boundingBox()
    const rows = await list(page).boundingBox()
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(rows!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('mirrors in Arabic', async ({ page }) => {
    await page.goto('/ar')
    const stage = await section(page).locator('[data-mode]').boundingBox()
    const rows = await section(page).locator('ol').boundingBox()
    expect(rows!.x + rows!.width).toBeLessThanOrEqual(stage!.x)
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('shows every project at once', async ({ page }) => {
    await page.goto('/en')
    await expect(caseStudy(page, FIRST)).toBeVisible()
    await expect(caseStudy(page, SECOND)).toBeVisible()
  })
})
