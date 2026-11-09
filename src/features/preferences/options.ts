import type { PublicDesignSettings } from '@/features/cms/queries'
import {
  CURSOR_OPTIONS,
  DEFAULT_PUBLIC_NAV_ITEMS,
  FONT_OPTIONS,
  HEADER_POSITIONS,
  type CursorKey,
  type FontKey,
  type HeaderPosition,
} from '@/features/cms/design-options'

export const VISITOR_DESIGN_COOKIE = 'visitor-design'
export const VISITOR_DESIGN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const THEME_PRESETS = [
  {
    value: 'minimalist-space',
    label: 'Minimalist Space',
    description: 'The polished admin-selected portfolio theme.',
    available: true,
  },
  {
    value: 'f1',
    label: 'F1 Theme',
    description: 'A fast motorsport-inspired palette.',
    available: false,
  },
  {
    value: 'sakura',
    label: 'Sakura Theme',
    description: 'A soft pink editorial direction.',
    available: false,
  },
] as const

export type ThemePresetKey = (typeof THEME_PRESETS)[number]['value']

export interface VisitorDesignPreference {
  seen?: boolean
  themePreset?: ThemePresetKey
  fontBody?: FontKey
  fontHeading?: FontKey
  cursorStyle?: CursorKey
  headerPosition?: HeaderPosition
}

const themePresetValues = new Set<string>(THEME_PRESETS.map((preset) => preset.value))
const fontValues = new Set<string>(FONT_OPTIONS.map((font) => font.value))
const cursorValues = new Set<string>(CURSOR_OPTIONS.map((cursor) => cursor.value))
const headerPositionValues = new Set<string>(HEADER_POSITIONS.map((position) => position.value))
const defaultThemeValues = new Set<string>(['light', 'dark', 'system'])

export const DEFAULT_PUBLIC_DESIGN: PublicDesignSettings = {
  primaryColor: '#2A6AFF',
  defaultTheme: 'dark',
  fontBody: 'space-grotesk',
  fontHeading: 'archivo',
  cursorStyle: 'default',
  headerPosition: 'bottom',
  navItems: DEFAULT_PUBLIC_NAV_ITEMS,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function validThemePreset(value: unknown): ThemePresetKey | undefined {
  const key = stringValue(value)
  return key && themePresetValues.has(key) ? (key as ThemePresetKey) : undefined
}

function validFont(value: unknown): FontKey | undefined {
  const key = stringValue(value)
  return key && fontValues.has(key) ? (key as FontKey) : undefined
}

function validCursor(value: unknown): CursorKey | undefined {
  const key = stringValue(value)
  return key && cursorValues.has(key) ? (key as CursorKey) : undefined
}

function validHeaderPosition(value: unknown): HeaderPosition | undefined {
  const key = stringValue(value)
  return key && headerPositionValues.has(key) ? (key as HeaderPosition) : undefined
}

function validDefaultTheme(value: unknown): PublicDesignSettings['defaultTheme'] | undefined {
  const key = stringValue(value)
  return key && defaultThemeValues.has(key)
    ? (key as PublicDesignSettings['defaultTheme'])
    : undefined
}

export function normalizeVisitorDesignPreference(value: unknown): VisitorDesignPreference {
  const raw = asRecord(value)
  if (!raw) return {}

  const normalized: VisitorDesignPreference = {}
  if (raw.seen === true) normalized.seen = true

  const themePreset = validThemePreset(raw.themePreset)
  if (themePreset) normalized.themePreset = themePreset

  const fontBody = validFont(raw.fontBody)
  if (fontBody) normalized.fontBody = fontBody

  const fontHeading = validFont(raw.fontHeading)
  if (fontHeading) normalized.fontHeading = fontHeading

  const cursorStyle = validCursor(raw.cursorStyle)
  if (cursorStyle) normalized.cursorStyle = cursorStyle

  const headerPosition = validHeaderPosition(raw.headerPosition)
  if (headerPosition) normalized.headerPosition = headerPosition

  return normalized
}

export function parseVisitorDesignPreference(value: string | null | undefined): VisitorDesignPreference {
  if (!value) return {}

  try {
    return normalizeVisitorDesignPreference(JSON.parse(decodeURIComponent(value)))
  } catch {
    try {
      return normalizeVisitorDesignPreference(JSON.parse(value))
    } catch {
      return {}
    }
  }
}

/** The visitor's saved preference from a `document.cookie` string ({} when absent). */
export function readVisitorDesignCookie(cookieString: string): VisitorDesignPreference {
  const prefix = `${VISITOR_DESIGN_COOKIE}=`
  const entry = cookieString.split(/;\s*/).find((part) => part.startsWith(prefix))
  return parseVisitorDesignPreference(entry?.slice(prefix.length))
}

export function encodeVisitorDesignPreference(preference: VisitorDesignPreference) {
  return encodeURIComponent(JSON.stringify(normalizeVisitorDesignPreference(preference)))
}

export function visitorDesignCookieString(preference: VisitorDesignPreference) {
  return [
    `${VISITOR_DESIGN_COOKIE}=${encodeVisitorDesignPreference(preference)}`,
    'Path=/',
    `Max-Age=${VISITOR_DESIGN_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ].join('; ')
}

function normalizeAdminDesign(settings?: PublicDesignSettings): PublicDesignSettings {
  if (!settings) return DEFAULT_PUBLIC_DESIGN

  return {
    primaryColor: settings.primaryColor || DEFAULT_PUBLIC_DESIGN.primaryColor,
    defaultTheme: validDefaultTheme(settings.defaultTheme) ?? DEFAULT_PUBLIC_DESIGN.defaultTheme,
    fontBody: validFont(settings.fontBody) ?? DEFAULT_PUBLIC_DESIGN.fontBody,
    fontHeading: validFont(settings.fontHeading) ?? DEFAULT_PUBLIC_DESIGN.fontHeading,
    cursorStyle: validCursor(settings.cursorStyle) ?? DEFAULT_PUBLIC_DESIGN.cursorStyle,
    headerPosition: validHeaderPosition(settings.headerPosition) ?? DEFAULT_PUBLIC_DESIGN.headerPosition,
    navItems: settings.navItems?.length ? settings.navItems : DEFAULT_PUBLIC_DESIGN.navItems,
  }
}

export function mergeVisitorDesign(
  adminDesign: PublicDesignSettings | undefined,
  preference: VisitorDesignPreference,
): PublicDesignSettings {
  const base = normalizeAdminDesign(adminDesign)
  const safePreference = normalizeVisitorDesignPreference(preference)

  return {
    ...base,
    fontBody: safePreference.fontBody ?? base.fontBody,
    fontHeading: safePreference.fontHeading ?? base.fontHeading,
    cursorStyle: safePreference.cursorStyle ?? base.cursorStyle,
    headerPosition: safePreference.headerPosition ?? base.headerPosition,
  }
}
