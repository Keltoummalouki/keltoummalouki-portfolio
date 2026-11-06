import type { CSSProperties } from 'react'

export const FONT_OPTIONS = [
  {
    value: 'space-grotesk',
    label: 'Space Grotesk',
    tone: 'Geometric and technical',
    stack: 'var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'archivo',
    label: 'Archivo',
    tone: 'Strong editorial headings',
    stack: 'var(--font-archivo), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'inter',
    label: 'Inter',
    tone: 'Neutral and highly readable',
    stack: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'manrope',
    label: 'Manrope',
    tone: 'Clean modern UI',
    stack: 'var(--font-manrope), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'outfit',
    label: 'Outfit',
    tone: 'Rounded and friendly',
    stack: 'var(--font-outfit), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    tone: 'Polished product feel',
    stack: 'var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'sora',
    label: 'Sora',
    tone: 'Compact and futuristic',
    stack: 'var(--font-sora), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'urbanist',
    label: 'Urbanist',
    tone: 'Elegant and spacious',
    stack: 'var(--font-urbanist), ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'jetbrains-mono',
    label: 'JetBrains Mono',
    tone: 'Developer-focused monospace',
    stack: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  {
    value: 'playfair',
    label: 'Playfair Display',
    tone: 'Expressive serif contrast',
    stack: 'var(--font-playfair), Georgia, Cambria, serif',
  },
  {
    value: 'system',
    label: 'System',
    tone: 'Native platform default',
    stack: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
] as const

export type FontKey = (typeof FONT_OPTIONS)[number]['value']

export const CURSOR_OPTIONS = [
  {
    value: 'default',
    label: 'Default',
    tone: 'Browser native pointer',
    previewCursor: 'auto',
    css: '',
  },
  {
    value: 'dot',
    label: 'Precision dot',
    tone: 'Small centered focus point',
    previewCursor: 'crosshair',
    css: 'cursor: crosshair;',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    tone: 'Clean arrow with no flourish',
    previewCursor: 'default',
    css: 'cursor: default;',
  },
  {
    value: 'ring',
    label: 'Ring',
    tone: 'Selection-style pointer',
    previewCursor: 'cell',
    css: 'cursor: cell;',
  },
  {
    value: 'crosshair',
    label: 'Crosshair',
    tone: 'Precise interface feel',
    previewCursor: 'crosshair',
    css: 'cursor: crosshair;',
  },
  {
    value: 'grab',
    label: 'Grab',
    tone: 'Hands-on interactive cue',
    previewCursor: 'grab',
    css: 'cursor: grab;',
  },
  {
    value: 'zoom',
    label: 'Zoom',
    tone: 'Inspection and preview cue',
    previewCursor: 'zoom-in',
    css: 'cursor: zoom-in;',
  },
  {
    value: 'terminal',
    label: 'Terminal',
    tone: 'Technical text cursor',
    previewCursor: 'text',
    css: 'cursor: text;',
  },
] as const satisfies readonly {
  value: string
  label: string
  tone: string
  previewCursor: CSSProperties['cursor']
  css: string
}[]

export type CursorKey = (typeof CURSOR_OPTIONS)[number]['value']

export const HEADER_POSITIONS = [
  { value: 'bottom', label: 'Bottom dock', tone: 'Centered section navigation near the lower edge.' },
  { value: 'left', label: 'Left rail', tone: 'Vertical section navigation pinned to the left.' },
  { value: 'right', label: 'Right rail', tone: 'Vertical section navigation pinned to the right.' },
] as const

export type HeaderPosition = (typeof HEADER_POSITIONS)[number]['value']

// Section links scroll when their anchor is on the current page. Otherwise they
// open the page that holds it: the home page (`#…`) or /about (`/about#…`).
export const NAV_ITEMS = [
  { value: 'home', label: 'Home', href: '/', kind: 'page' },
  { value: 'about', label: 'About', href: '/about', kind: 'page' },
  { value: 'skills', label: 'Skills', href: '/about#skills', kind: 'section' },
  { value: 'experience', label: 'Experience', href: '#experience', kind: 'section' },
  { value: 'education', label: 'Education', href: '/about#education', kind: 'section' },
  { value: 'projects', label: 'Projects', href: '#projects', kind: 'section' },
  { value: 'certifications', label: 'Certifications', href: '/about#certifications', kind: 'section' },
  { value: 'github', label: 'GitHub', href: '/about#github', kind: 'section' },
  { value: 'blog', label: 'Blog', href: '/blog', kind: 'page' },
  { value: 'freelance', label: 'Freelance', href: '/freelance', kind: 'page' },
  { value: 'contact', label: 'Contact', href: '#contact', kind: 'section' },
  { value: 'login', label: 'Login', href: '/admin/login', kind: 'admin' },
  { value: 'profile', label: 'Profile', href: '/admin/profile', kind: 'admin' },
  { value: 'admin', label: 'Admin', href: '/admin', kind: 'admin' },
] as const

export type NavItem = (typeof NAV_ITEMS)[number]
export type NavItemKey = NavItem['value']

const navKeys = new Set<NavItemKey>(NAV_ITEMS.map((item) => item.value))

export const DEFAULT_PUBLIC_NAV_ITEMS: NavItemKey[] = ['about', 'experience', 'projects', 'blog', 'freelance', 'contact']

function isNavItemKey(value: unknown): value is NavItemKey {
  return typeof value === 'string' && navKeys.has(value as NavItemKey)
}

/** Element id a section link points at: `#projects` and `/about#skills` -> `projects`, `skills`. */
export function sectionAnchor(href: string): string {
  return href.slice(href.indexOf('#') + 1)
}

export function normalizeNavItems(value: unknown): NavItemKey[] {
  const raw = Array.isArray(value) ? value : DEFAULT_PUBLIC_NAV_ITEMS
  const seen = new Set<NavItemKey>()
  const normalized: NavItemKey[] = []

  for (const item of raw) {
    if (!isNavItemKey(item) || seen.has(item)) continue
    seen.add(item)
    normalized.push(item)
  }

  return normalized.length > 0 ? normalized : [...DEFAULT_PUBLIC_NAV_ITEMS]
}

export function fontStack(value: string | null | undefined, fallback: FontKey): string {
  return FONT_OPTIONS.find((option) => option.value === value)?.stack ?? fontStack(fallback, 'system')
}

export function cursorCss(value: string | null | undefined): string {
  return CURSOR_OPTIONS.find((option) => option.value === value)?.css ?? ''
}
