import { expect, test, type Page } from '@playwright/test'

// The /about profile page: its chapter rail (a sticky column with the 3D companion
// from lg, a sticky bar of chips on phones) and the outline search engines read,
// which the redesign must leave exactly as it was. Offline backend (see
// playwright.config.ts), so the page shows its built-in fallback content.

const SECTION_HEADINGS = [
  'at-a-glance-title',
  'what-i-do-title',
  'experience-title',
  'education-title',
  'skills-title',
  'certifications-title',
  'github-title',
  'languages-title',
  'how-i-work-title',
  'faq-title',
  'contact-title',
]

const chapters = (page: Page) => page.getByRole('navigation', { name: 'On this page' })

/** Bottom edge of the fixed site header, in viewport px. */
const headerBottom = (page: Page) => page.locator('header').first().evaluate((el) => el.getBoundingClientRect().bottom)

/** Makes the browser report no WebGL, as on an old device or with acceleration off. */
const withoutWebGL = (page: Page) =>
  page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as (...args: unknown[]) => unknown
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.includes('webgl') ? null : original.call(this, type, ...rest)
    } as typeof HTMLCanvasElement.prototype.getContext
  })

// The first-visit preference panel opens after hydration and takes the focus.
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'visitor-design', value: encodeURIComponent('{"seen":true}'), url: baseURL! }])
})

test.describe('about page outline', () => {
  test('keeps one h1, the section headings in order and the structured data', async ({ page }) => {
    await page.goto('/en/about')

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('About Keltoum Malouki')
    await expect(page.locator('h1')).toHaveId('about-title')
    expect(await page.locator('main h2').evaluateAll((headings) => headings.map((heading) => heading.id))).toEqual(SECTION_HEADINGS)

    // Every FAQ answer is on the page, as the FAQPage structured data says.
    const graph = await page.locator('script[type="application/ld+json"]').first().textContent()
    const types = JSON.stringify(JSON.parse(graph ?? '{}'))
    for (const type of ['ProfilePage', 'Person', 'BreadcrumbList', 'FAQPage']) expect(types).toContain(`"${type}"`)
    const questions = (JSON.parse(graph ?? '{}')['@graph'] as { '@type': string; mainEntity?: unknown[] }[]).find(
      (node) => node['@type'] === 'FAQPage',
    )?.mainEntity
    await expect(page.locator('#faq h3')).toHaveCount(questions?.length ?? -1)
    await expect(page.locator('#faq [id^="faq-"]').first()).toBeVisible()
  })
})

test.describe('chapter rail', () => {
  test('lists every chapter as a plain in-page link', async ({ page }) => {
    await page.goto('/en/about')
    const links = chapters(page).getByRole('link')
    await expect(links).toHaveCount(12)
    await expect(links.first()).toHaveText('Profile')
    await expect(links.first()).toHaveAttribute('aria-current', 'location')
    await expect(chapters(page).getByRole('link', { name: 'Experience', exact: true })).toHaveAttribute('href', '#experience')
  })

  test('jumps to a chapter below the header, marks it and moves focus to its heading', async ({ page }) => {
    await page.goto('/en/about')
    const experience = chapters(page).getByRole('link', { name: 'Experience', exact: true })
    await experience.click()

    await expect(page).toHaveURL(/\/en\/about#experience$/)
    await expect(experience).toHaveAttribute('aria-current', 'location')
    await expect(page.locator('#experience-title')).toBeFocused()
    const top = await page.locator('#experience').evaluate((el) => el.getBoundingClientRect().top)
    expect(top).toBeGreaterThanOrEqual(await headerBottom(page))
    expect(top).toBeLessThan(200)

    // The next Tab continues from the chapter, not from the list.
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('section')?.id ?? null)).not.toBe(null)
  })

  test('follows the page as it scrolls', async ({ page }) => {
    await page.goto('/en/about')
    await page.locator('#faq').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100))
    await expect(chapters(page).getByRole('link', { name: 'Frequently asked questions' })).toHaveAttribute('aria-current', 'location')
    await expect(chapters(page).locator('[aria-current="location"]')).toHaveCount(1)
  })

  test('is a sticky bar of chips on a phone, without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await page.goto('/en/about')
    await expect(page.locator('[data-voxel-stage]')).toBeHidden()

    await page.locator('#skills').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 170))
    const bar = chapters(page)
    await expect(bar.getByRole('link', { name: 'Skills', exact: true })).toHaveAttribute('aria-current', 'location')
    const box = await bar.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual((await headerBottom(page)) - 1)
    expect(box!.y).toBeLessThan(160)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // A jump clears the bar too.
    await bar.getByRole('link', { name: 'Skills', exact: true }).click()
    const heading = await page.locator('#skills-title').boundingBox()
    expect(heading!.y).toBeGreaterThanOrEqual(box!.y + box!.height)
  })

  test('sits at the reading start on right-to-left pages', async ({ page }) => {
    await page.goto('/ar/about')
    const rail = page.getByRole('navigation', { name: 'في هذه الصفحة' })
    await expect(rail.getByRole('link')).toHaveCount(12)
    const railBox = await rail.boundingBox()
    const titleBox = await page.locator('h1').boundingBox()
    expect(railBox!.x + railBox!.width).toBeLessThan(titleBox!.x)
  })
})

test.describe('3D chapter companion', () => {
  test('stays out of assistive technology', async ({ page }) => {
    await page.goto('/en/about')
    await expect(page.locator('[data-voxel-stage]')).toHaveAttribute('aria-hidden', 'true')
  })

  test('falls back to the flat icon without WebGL, still following the chapters', async ({ page }) => {
    await withoutWebGL(page)
    await page.goto('/en/about')
    const stage = page.locator('[data-voxel-stage]')
    await expect(stage).toHaveAttribute('data-mode', 'static')
    await expect(stage.locator('svg')).toBeVisible()

    await chapters(page).getByRole('link', { name: 'Skills', exact: true }).click()
    await expect(stage).toHaveAttribute('data-icon', 'layers')
    await expect(stage.locator('svg')).toBeVisible()
  })
})
