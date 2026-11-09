import type { PublicDesignSettings } from '@/features/cms/queries'
import { cursorCss, fontStack } from '@/features/cms/design-options'

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function color(value: string | undefined) {
  return value && HEX.test(value) ? value : ''
}

export function buildDesignCss(settings?: PublicDesignSettings) {
  if (!settings) return ''

  const primary = color(settings.primaryColor)
  const bodyFont = fontStack(settings.fontBody, 'space-grotesk')
  const headingFont = fontStack(settings.fontHeading, 'archivo')
  const cursor = cursorCss(settings.cursorStyle)

  return `
    :root, .dark {
      ${primary ? `--primary: ${primary}; --ring: ${primary}; --sidebar-primary: ${primary}; --chart-1: ${primary};` : ''}
    }
    body { font-family: ${bodyFont}; ${cursor} }
    h1, h2, h3, h4, h5, h6 { font-family: ${headingFont}; }
    a, button, [role="button"], input[type="submit"], input[type="button"], .cursor-pointer { ${cursor} }
  `
}
