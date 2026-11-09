'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { Check, Moon, Sparkles, SlidersHorizontal, Sun } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useOptionalPreference } from '@/components/providers/PreferenceProvider'
import { usePathname, useRouter } from '@/i18n/navigation'
import {
  CURSOR_OPTIONS,
  FONT_OPTIONS,
  HEADER_POSITIONS,
  type CursorKey,
  type FontKey,
  type HeaderPosition,
} from '@/features/cms/design-options'
import { THEME_PRESETS, type ThemePresetKey } from '@/features/preferences/options'
import { cn } from '@/lib/utils'

type SelectOption<T extends string> = {
  value: T
  label: string
  description?: string
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'ar', name: 'العربية' },
] as const

function tr(t: ReturnType<typeof useTranslations>, key: string, fallback: string) {
  try {
    const value = t(key)
    return value === key ? fallback : value
  } catch {
    return fallback
  }
}

function PreferenceSelect<T extends string>({
  id,
  label,
  value,
  options,
  onValueChange,
}: {
  id: string
  label: string
  value: T
  options: readonly SelectOption<T>[]
  onValueChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
        <SelectTrigger id={id} className="h-10 rounded-xl border-border bg-card text-foreground shadow-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} textValue={option.label}>
                <span className="flex flex-col gap-0.5">
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export default function PreferenceMenu() {
  const preferences = useOptionalPreference()
  const t = useTranslations('preferences')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme, theme, resolvedTheme } = useTheme()
  const titleId = useId()
  const autoOpenedRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLanguagePending, startLanguageTransition] = useTransition()

  useEffect(() => {
    // The request form sits right where this panel opens: it waits for the next page.
    if (pathname === '/freelance') return
    if (!preferences || preferences.hasSeenPreference || autoOpenedRef.current) return
    autoOpenedRef.current = true
    // Desktop only: on phones/tablets the panel would cover the page on arrival,
    // which Google treats as an intrusive interstitial for mobile search.
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    setOpen(true)
  }, [preferences, pathname])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!preferences) return null

  const { design, preference, hasVisitorOverrides, applyPreference, skipPreference } = preferences
  const activeTheme = mounted && (theme === 'light' || theme === 'dark')
    ? theme
    : resolvedTheme === 'light' || resolvedTheme === 'dark'
      ? resolvedTheme
      : 'dark'
  const selectedPreset = preference.themePreset ?? 'minimalist-space'
  const fontOptions = FONT_OPTIONS.map((font) => ({
    value: font.value,
    label: font.label,
    description: font.tone,
  })) satisfies SelectOption<FontKey>[]
  const cursorOptions = CURSOR_OPTIONS.map((cursor) => ({
    value: cursor.value,
    label: cursor.label,
    description: cursor.tone,
  })) satisfies SelectOption<CursorKey>[]
  const headerOptions = HEADER_POSITIONS.map((position) => ({
    value: position.value,
    label: position.label,
    description: position.tone,
  })) satisfies SelectOption<HeaderPosition>[]

  const handleSkip = () => {
    skipPreference()
    setOpen(false)
  }

  const handleLanguageChange = (nextLocale: string) => {
    startLanguageTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={tr(t, 'open', 'Open preference panel')}
          className={cn(
            'h-11 min-w-11 rounded-xl border border-border bg-secondary/40 px-3 text-muted-foreground shadow-none transition-all duration-200',
            'hover:border-primary/40 hover:bg-secondary hover:text-foreground hover:shadow-sm',
            'active:scale-[0.98]',
            hasVisitorOverrides && 'border-primary/50 bg-primary/10 text-primary',
          )}
        >
          <SlidersHorizontal data-icon="inline-start" />
          <span className="hidden sm:inline">{tr(t, 'trigger', 'Preference')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        aria-labelledby={titleId}
        data-lenis-prevent
        className="max-h-[min(42rem,calc(100svh-6rem))] w-[min(calc(100vw-1.5rem),23rem)] overflow-y-auto rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-2xl shadow-foreground/10 ring-1 ring-border/60"
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="text-sm font-semibold text-foreground">
                  {tr(t, 'title', 'Preference')}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tr(t, 'description', 'Pick a personal look. Changes apply instantly.')}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleSkip} className="shrink-0 rounded-xl">
              {tr(t, 'skip', 'Skip')}
            </Button>
          </div>

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:hidden">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {tr(t, 'displayMode', 'Display mode')}
              </p>
              <ToggleGroup
                type="single"
                value={activeTheme}
                onValueChange={(value) => {
                  if (value === 'light' || value === 'dark') setTheme(value)
                }}
                aria-label={tr(t, 'displayMode', 'Display mode')}
                className="grid grid-cols-2 gap-2"
              >
                <ToggleGroupItem
                  value="light"
                  aria-label={tr(t, 'lightMode', 'Light')}
                  className="h-11 rounded-xl border border-border bg-background text-foreground data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                >
                  <Sun data-icon="inline-start" />
                  {tr(t, 'lightMode', 'Light')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  aria-label={tr(t, 'darkMode', 'Dark')}
                  className="h-11 rounded-xl border border-border bg-background text-foreground data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                >
                  <Moon data-icon="inline-start" />
                  {tr(t, 'darkMode', 'Dark')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="preference-language" className="text-xs font-medium text-muted-foreground">
                {tr(t, 'language', 'Language')}
              </label>
              <Select value={locale} onValueChange={handleLanguageChange} disabled={isLanguagePending}>
                <SelectTrigger id="preference-language" className="h-11 rounded-xl border-border bg-background text-foreground shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {tr(t, 'themeLabel', 'Theme preset')}
            </p>
            <div className="grid gap-2">
              {THEME_PRESETS.map((preset) => {
                const selected = selectedPreset === preset.value
                return (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={!preset.available}
                    aria-pressed={selected}
                    onClick={() => applyPreference({ themePreset: preset.value as ThemePresetKey })}
                    className={cn(
                      'group flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-sm transition-all duration-200',
                      'hover:border-primary/50 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.99]',
                      selected && 'border-primary/60 bg-primary/10 ring-1 ring-primary/20',
                      !preset.available && 'cursor-not-allowed bg-muted/30 hover:border-border hover:bg-muted/30 active:scale-100',
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn('block text-sm font-semibold text-foreground', !preset.available && 'text-muted-foreground')}>
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{preset.description}</span>
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
                        selected && 'border-primary/40 bg-primary/10 text-primary',
                      )}
                    >
                      {selected && preset.available && <Check className="size-3" aria-hidden="true" />}
                      {preset.available
                        ? selected
                          ? tr(t, 'current', 'Current')
                          : tr(t, 'select', 'Select')
                        : tr(t, 'comingSoon', 'Coming soon')}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <PreferenceSelect
              id="preference-body-font"
              label={tr(t, 'bodyFont', 'Body font')}
              value={design.fontBody as FontKey}
              options={fontOptions}
              onValueChange={(fontBody) => applyPreference({ fontBody })}
            />
            <PreferenceSelect
              id="preference-heading-font"
              label={tr(t, 'headingFont', 'Heading font')}
              value={design.fontHeading as FontKey}
              options={fontOptions}
              onValueChange={(fontHeading) => applyPreference({ fontHeading })}
            />
            <PreferenceSelect
              id="preference-cursor"
              label={tr(t, 'cursorStyle', 'Cursor style')}
              value={design.cursorStyle as CursorKey}
              options={cursorOptions}
              onValueChange={(cursorStyle) => applyPreference({ cursorStyle })}
            />
            <PreferenceSelect
              id="preference-header-position"
              label={tr(t, 'headerPosition', 'Header position')}
              value={design.headerPosition}
              options={headerOptions}
              onValueChange={(headerPosition) => applyPreference({ headerPosition })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
