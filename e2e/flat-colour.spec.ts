import { expect, test } from '@playwright/test'

// The site uses one solid blue. Elements are read from the browser, so this also
// catches a gradient coming from a shared class or a stylesheet.

const PAGES = ['/en', '/ar', '/en/about', '/en/projects', '/en/blog', '/en/freelance', '/admin/login']

test.describe('one solid colour', () => {
  for (const path of PAGES) {
    test(`${path} paints no gradient`, async ({ page }) => {
      await page.goto(path)

      const gradients = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          // Its faint lines have hard edges: `linear-gradient` is only how CSS draws them.
          .filter((element) => !element.classList.contains('grid-pattern'))
          .filter((element) => getComputedStyle(element).backgroundImage.includes('gradient'))
          .map((element) => `${element.tagName}.${element.getAttribute('class') ?? ''}`.slice(0, 120)),
      )
      expect(gradients).toEqual([])
    })
  }

  test('the theme defines one blue and no gradient to pair it with', async ({ page }) => {
    await page.goto('/en/blog')

    const theme = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement)
      return {
        primary: styles.getPropertyValue('--primary').trim(),
        gradient: styles.getPropertyValue('--gradient-primary').trim(),
      }
    })
    expect(theme.primary.toUpperCase()).toBe('#2A6AFF')
    expect(theme.gradient).toBe('')
  })
})
