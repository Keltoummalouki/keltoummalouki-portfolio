import { expect, test, type Locator } from '@playwright/test'

// The /projects index lists one project per row, like the home page's section.
// The test server has no database, so it shows the two fallback projects.

test.describe('projects index', () => {
  /** The cover comes first in the row, ahead of the stack chips' icons (also images). */
  const coverOf = (row: Locator) => row.getByRole('img').first()

  /** Whether the row's cover sits to the left of its title. */
  const coverIsLeftOfTitle = async (row: Locator) => {
    const cover = await coverOf(row).boundingBox()
    const title = await row.getByRole('heading', { level: 2 }).boundingBox()
    return cover!.x < title!.x
  }

  test('shows one project per row, on alternating sides', async ({ page }) => {
    await page.goto('/en/projects')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const rows = page.getByRole('list', { name: 'Projects', exact: true }).locator('> li')
    await expect(rows).toHaveCount(2)
    await expect(rows.first().getByText('01', { exact: true })).toBeVisible()

    expect(await coverIsLeftOfTitle(rows.nth(0))).toBe(true)
    expect(await coverIsLeftOfTitle(rows.nth(1))).toBe(false)
  })

  test('links each row to its case study', async ({ page }) => {
    await page.goto('/en/projects')
    const row = page.getByRole('list', { name: 'Projects', exact: true }).locator('> li').first()

    await row.getByRole('heading', { level: 2 }).getByRole('link').click()

    await expect(page).toHaveURL(/\/en\/projects\/event-booking-app$/)
  })

  test('mirrors the rows in Arabic', async ({ page }) => {
    await page.goto('/ar/projects')
    const rows = page.locator('main ol[aria-label] > li:has(h2)')
    await expect(rows).toHaveCount(2)

    expect(await coverIsLeftOfTitle(rows.nth(0))).toBe(false)
    expect(await coverIsLeftOfTitle(rows.nth(1))).toBe(true)
  })

  test('stacks each row on a phone, with the cover first', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/en/projects')
    const rows = page.getByRole('list', { name: 'Projects', exact: true }).locator('> li')

    for (const row of [rows.nth(0), rows.nth(1)]) {
      const cover = await coverOf(row).boundingBox()
      const title = await row.getByRole('heading', { level: 2 }).boundingBox()
      expect(cover!.y + cover!.height).toBeLessThanOrEqual(title!.y)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
