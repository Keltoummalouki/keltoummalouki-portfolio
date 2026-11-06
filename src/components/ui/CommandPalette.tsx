'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { NAV_ITEMS, sectionAnchor } from '@/features/cms/design-options'
import { NAV_ICONS } from '@/components/ui/navIcons'
import { cn } from '@/lib/utils'
import { scrollToElement, scrollToTop } from '@/lib/motion/smooth-scroll'

type NavItem = (typeof NAV_ITEMS)[number]

const HOME_ITEM = NAV_ITEMS.find((item) => item.value === 'home')!

type RunItem = {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  active: boolean
  run: () => void
}

function tr(t: ReturnType<typeof useTranslations>, key: string, fallback: string) {
  try {
    const value = t(key)
    return value === key ? fallback : value
  } catch {
    return fallback
  }
}

export default function CommandPalette({
  open,
  onClose,
  items,
  activeSection,
  pathname,
}: {
  open: boolean
  onClose: () => void
  items: readonly NavItem[]
  activeSection: string
  pathname: string
}) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()

  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => setMounted(true), [])

  const labelFor = useCallback((item: NavItem) => tr(t, item.value, item.label), [t])

  const navigate = useCallback(
    (item: NavItem) => {
      onClose()
      if (item.kind === 'section') {
        const el = document.getElementById(sectionAnchor(item.href))
        if (el) {
          scrollToElement(el)
          return
        }
        window.location.href = `/${locale}${item.href}`
        return
      }
      if (item.kind === 'page') {
        router.push(item.href)
        return
      }
      window.location.href = item.href
    },
    [onClose, locale, router],
  )

  // Build grouped commands: nav sections / pages / manage, plus quick actions.
  const groups = useMemo(() => {
    const isActive = (item: NavItem) => {
      if (item.kind === 'section') return activeSection === sectionAnchor(item.href)
      if (item.kind === 'page') return pathname === item.href || pathname.startsWith(`${item.href}/`)
      return false
    }

    const toRun = (item: NavItem): RunItem => ({
      id: item.value,
      label: labelFor(item),
      icon: NAV_ICONS[item.value],
      active: isActive(item),
      run: () => navigate(item),
    })

    const sections = items.filter((i) => i.kind === 'section').map(toRun)
    const rawPages = items.filter((i) => i.kind === 'page')
    const pages = (rawPages.some((i) => i.value === 'home') ? rawPages : [HOME_ITEM, ...rawPages]).map(toRun)
    const manage = items.filter((i) => i.kind === 'admin').map(toRun)

    const actions: RunItem[] = [
      {
        id: 'back-to-top',
        label: tr(t, 'backToTop', 'Back to top'),
        icon: ArrowUpToLine,
        active: false,
        run: () => {
          onClose()
          scrollToTop()
        },
      },
    ]

    return [
      { key: 'explore', label: tr(t, 'groupExplore', 'Explore'), items: sections },
      { key: 'pages', label: tr(t, 'groupPages', 'Pages'), items: pages },
      { key: 'manage', label: tr(t, 'groupManage', 'Manage'), items: manage },
      { key: 'actions', label: tr(t, 'groupActions', 'Actions'), items: actions },
    ].filter((g) => g.items.length > 0)
  }, [items, activeSection, pathname, labelFor, navigate, onClose, t])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [groups, query])

  const flat = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups])

  // Reset selection / query when the palette opens; focus the input.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(id)
  }, [open])

  // Keep highlight in range and scrolled into view.
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(flat.length > 0 ? flat.length - 1 : 0)
  }, [flat.length, activeIndex])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      flat[activeIndex]?.run()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(flat.length ? flat.length - 1 : 0)
    }
  }

  if (!mounted) return null

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          aria-hidden={!open}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label={tr(t, 'closeMenu', 'Close menu')}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            data-lenis-prevent
            aria-label={tr(t, 'commandTitle', 'Command menu')}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={handleKeyDown}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl shadow-black/30 backdrop-blur-2xl ring-1 ring-black/5"
          >
            {/* Gradient sheen */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
            />

            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-list"
                aria-activedescendant={flat[activeIndex] ? `command-${flat[activeIndex].id}` : undefined}
                aria-label={tr(t, 'searchPlaceholder', 'Search or jump to…')}
                placeholder={tr(t, 'searchPlaceholder', 'Search or jump to…')}
                className="w-full bg-transparent py-4 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden shrink-0 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              id="command-list"
              role="listbox"
              aria-label={tr(t, 'commandTitle', 'Command menu')}
              className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain p-2"
            >
              {flat.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Search size={22} className="text-muted-foreground/50" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    {tr(t, 'noResults', 'No results for')} <span className="font-medium text-foreground">“{query}”</span>
                  </p>
                </div>
              ) : (
                (() => {
                  let runningIndex = -1
                  return filteredGroups.map((group) => (
                    <div key={group.key} className="mb-1 last:mb-0">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        runningIndex += 1
                        const index = runningIndex
                        const isHighlighted = index === activeIndex
                        const Icon = item.icon
                        return (
                          <button
                            key={item.id}
                            id={`command-${item.id}`}
                            ref={(el) => {
                              itemRefs.current[index] = el
                            }}
                            role="option"
                            aria-selected={isHighlighted}
                            type="button"
                            onClick={() => item.run()}
                            onMouseMove={() => setActiveIndex(index)}
                            className={cn(
                              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150',
                              isHighlighted ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150',
                                isHighlighted
                                  ? 'border-primary/30 bg-primary/15 text-primary'
                                  : 'border-border bg-secondary/60 text-muted-foreground group-hover:text-foreground',
                              )}
                            >
                              <Icon size={16} aria-hidden />
                            </span>
                            <span className="flex-1 font-medium">{item.label}</span>
                            {item.active && (
                              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                <span className="size-1.5 rounded-full bg-primary" />
                                {tr(t, 'current', 'Current')}
                              </span>
                            )}
                            <CornerDownLeft
                              size={14}
                              aria-hidden
                              className={cn(
                                'shrink-0 transition-opacity duration-150',
                                isHighlighted ? 'opacity-100 text-muted-foreground' : 'opacity-0',
                              )}
                            />
                          </button>
                        )
                      })}
                    </div>
                  ))
                })()
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="flex size-5 items-center justify-center rounded border border-border bg-secondary">
                    <ArrowUp size={11} />
                  </kbd>
                  <kbd className="flex size-5 items-center justify-center rounded border border-border bg-secondary">
                    <ArrowDown size={11} />
                  </kbd>
                  {tr(t, 'hintNavigate', 'Navigate')}
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  <kbd className="flex h-5 items-center justify-center rounded border border-border bg-secondary px-1">
                    <CornerDownLeft size={11} />
                  </kbd>
                  {tr(t, 'hintSelect', 'Select')}
                </span>
              </div>
              <span className="font-medium text-muted-foreground/80">{flat.length}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
