'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import CommandPalette from '@/components/ui/CommandPalette'
import PreferenceMenu from '@/components/ui/PreferenceMenu'
import { NAV_ICONS } from '@/components/ui/navIcons'
import { useOptionalPreference } from '@/components/providers/PreferenceProvider'
import { Link, usePathname } from '@/i18n/navigation'
import type { PublicDesignSettings } from '@/features/cms/queries'
import {
  DEFAULT_PUBLIC_NAV_ITEMS,
  NAV_ITEMS,
  normalizeNavItems,
  sectionAnchor,
  type NavItemKey,
} from '@/features/cms/design-options'
import { cn } from '@/lib/utils'
import { scrollToElement, scrollToTop } from '@/lib/motion/smooth-scroll'

const Logo3D = dynamic(() => import('@/components/three/Logo3D'), {
  ssr: false,
  loading: () => (
    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary text-primary-text font-bold">
      M
    </div>
  ),
})

type NavItem = (typeof NAV_ITEMS)[number]

const HOME_ITEM = NAV_ITEMS.find((item) => item.value === 'home')!

const pillSpring = { type: 'spring', stiffness: 380, damping: 32 } as const

function tr(t: ReturnType<typeof useTranslations>, key: string, fallback: string) {
  try {
    const value = t(key)
    return value === key ? fallback : value
  } catch {
    return fallback
  }
}

function translateNav(t: ReturnType<typeof useTranslations>, item: NavItem) {
  return tr(t, item.value, item.label)
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export default function Header({
  brandName,
  design,
}: {
  brandName?: string
  design?: PublicDesignSettings
}) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [mounted, setMounted] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const preferences = useOptionalPreference()

  const navKeys = design?.navItems?.length ? design.navItems : DEFAULT_PUBLIC_NAV_ITEMS
  const visibleNavItems = useMemo(() => {
    const normalizedKeys = new Set<NavItemKey>(normalizeNavItems(navKeys))
    return NAV_ITEMS.filter((item) => normalizedKeys.has(item.value))
  }, [navKeys])

  const sectionItems = useMemo(() => visibleNavItems.filter((item) => item.kind === 'section'), [visibleNavItems])
  const pageItems = useMemo(() => {
    const pages = visibleNavItems.filter((item) => item.kind === 'page' && item.value !== 'home')
    return [HOME_ITEM, ...pages]
  }, [visibleNavItems])

  // The top bar stays fixed for identity and page links. The Header-position
  // setting controls where the section dock floats: bottom, left, or right.
  const headerPosition = preferences?.design.headerPosition ?? design?.headerPosition ?? 'bottom'
  const dockSide: 'bottom' | 'left' | 'right' =
    headerPosition === 'left' ? 'left' : headerPosition === 'right' ? 'right' : 'bottom'
  const dockHorizontal = dockSide === 'bottom'

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 20)

    for (const item of sectionItems) {
      const anchor = sectionAnchor(item.href)
      const element = document.getElementById(anchor)
      if (element) {
        const rect = element.getBoundingClientRect()
        if (rect.top <= 160 && rect.bottom >= 160) {
          setActiveSection(anchor)
          break
        }
      }
    }
  }, [sectionItems])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    setMounted(true)
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent))
  }, [])

  // Global shortcuts: ⌘K / Ctrl+K toggles, "/" opens (when not typing).
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsCommandOpen((open) => !open)
      } else if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault()
        setIsCommandOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  const handleSectionClick = (href: string) => {
    const element = document.getElementById(sectionAnchor(href))
    if (element) {
      scrollToElement(element)
      return
    }
    // `#projects` -> /fr#projects, `/about#skills` -> /fr/about#skills.
    window.location.href = `/${locale}${href}`
  }

  const isPageActive = (item: NavItem) => {
    if (item.value === 'home') return pathname === '/'
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  const displayBrand = brandName?.trim() || 'Malouki'
  const openLabel = tr(t, 'openCommand', 'Open command menu')

  return (
    <>
      {/* ── Top bar: logo · page switcher · utilities ── */}
      <header ref={headerRef} className="fixed left-4 right-4 top-4 z-50">
        <div
          className={cn(
            'mx-auto max-w-7xl rounded-2xl border px-4 py-3 transition-all duration-300',
            isScrolled
              ? 'border-border bg-background/85 shadow-lg shadow-black/5 backdrop-blur-xl'
              : 'border-transparent bg-background/50 backdrop-blur-md',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
              <Link
                href="/"
                className="relative flex items-center gap-2 group"
                onClick={() => scrollToTop()}
              >
                <div className="h-10 w-10">
                  <Logo3D className="h-full w-full" />
                </div>
                {/* sr-only (not display:none) on mobile so the link keeps an accessible name. */}
                <span className="sr-only text-lg font-semibold tracking-tight text-foreground sm:not-sr-only sm:block">
                  <span className="text-primary">{displayBrand.charAt(0)}</span>{displayBrand.slice(1)}
                </span>
              </Link>
            </motion.div>

            {/* Page switcher — sliding segmented control */}
            {pageItems.length > 1 && (
              <nav
                className="flex flex-1 justify-center"
                aria-label={tr(t, 'groupPages', 'Pages')}
              >
                <div className="flex items-center gap-0.5 rounded-full bg-secondary p-1">
                  {pageItems.map((item) => {
                    const active = isPageActive(item)
                    const Icon = NAV_ICONS[item.value]
                    const label = translateNav(t, item)
                    return (
                      <Link
                        key={item.value}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200',
                          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="pagePill"
                            className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border"
                            transition={pillSpring}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                          <Icon size={15} className="shrink-0" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:inline">{label}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </nav>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                aria-label={openLabel}
                aria-keyshortcuts="Control+K Meta+K"
                className={cn(
                  'group flex h-10 items-center gap-2 rounded-xl border border-border bg-secondary/40 px-2.5 text-muted-foreground transition-all duration-200',
                  'hover:border-primary/40 hover:bg-secondary hover:text-foreground hover:shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'active:scale-[0.98]',
                )}
              >
                <Search size={16} className="shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden />
                {mounted && (
                  <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:flex">
                    <span className="text-[13px] leading-none">{isMac ? '⌘' : 'Ctrl'}</span>
                    <span>K</span>
                  </kbd>
                )}
              </button>

              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <PreferenceMenu />
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Floating section dock — placement driven by Header-position setting ── */}
      {sectionItems.length > 0 && (
        <motion.nav
          aria-label={tr(t, 'groupExplore', 'Explore')}
          data-section-dock
          initial={{ opacity: 0, y: dockHorizontal ? 24 : 0, x: dockSide === 'left' ? -24 : dockSide === 'right' ? 24 : 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
          className={cn(
            'fixed z-40 flex max-w-[calc(100vw-1.5rem)] items-center rounded-full border border-border bg-background/80 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl',
            dockSide === 'bottom' && 'bottom-4 left-1/2 -translate-x-1/2 gap-0.5',
            dockSide === 'left' && 'left-4 top-1/2 -translate-y-1/2 flex-col gap-0.5',
            dockSide === 'right' && 'right-4 top-1/2 -translate-y-1/2 flex-col gap-0.5',
          )}
        >
          {sectionItems.map((item) => {
            const active = activeSection === sectionAnchor(item.href)
            const Icon = NAV_ICONS[item.value]
            const label = translateNav(t, item)
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleSectionClick(item.href)}
                title={label}
                aria-label={label}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'group relative flex items-center rounded-full px-2.5 py-2 transition-colors duration-200',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sectionPill"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={pillSpring}
                  />
                )}
                <span className="relative z-10 flex items-center">
                  <Icon size={17} className="shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden />
                  <AnimatePresence initial={false}>
                    {active && dockHorizontal && (
                      <motion.span
                        initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                        animate={{ width: 'auto', opacity: 1, marginLeft: 6 }}
                        exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden whitespace-nowrap text-xs font-semibold"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            )
          })}
        </motion.nav>
      )}

      <CommandPalette
        open={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        items={visibleNavItems}
        activeSection={activeSection}
        pathname={pathname}
      />
    </>
  )
}
