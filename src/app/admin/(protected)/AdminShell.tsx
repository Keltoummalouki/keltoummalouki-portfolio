'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { signOutAction } from '@/features/auth/actions'
import { getLenisInstance } from '@/lib/motion/smooth-scroll'
import { useStudioSmoothScroll } from '@/lib/motion/studio-motion'
import AdminNav, { type AdminNavCounts } from './AdminNav'
import CommandPalette, { openCommandPalette } from './CommandPalette'
import { sidebarCookie } from './sidebar-state'
import 'lenis/dist/lenis.css'
import './studio.css'

// Mobile drawer lifecycle: 'closing' keeps the native <dialog> open while its
// exit animation plays, then it is closed for real.
type DrawerState = 'closed' | 'open' | 'closing'

interface Tip {
  label: string
  top: number
  left: number
}

const DESKTOP_QUERY = '(min-width: 1024px)'

interface Profile {
  fullName: string
  avatarUrl: string
}

/** The admin's own photo (About profile) as the studio mark; initials if it can't load. */
function ProfileMark({ profile }: { profile: Profile }) {
  const [failed, setFailed] = useState(false)
  if (failed || !profile.avatarUrl) {
    const initials = profile.fullName.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase()
    return <span className="studio-mark-initials">{initials || 'KM'}</span>
  }
  // eslint-disable-next-line @next/next/no-img-element -- admin-managed URL (Storage or /public), same as the About editor
  return <img src={profile.avatarUrl} alt="" width={36} height={36} onError={() => setFailed(true)} />
}

function BrandLink({ inert, profile }: { inert?: boolean; profile: Profile }) {
  return (
    <Link href="/admin/dashboard" className="studio-brand-link" inert={inert}>
      <span className="studio-monogram" aria-hidden="true">
        <ProfileMark profile={profile} />
      </span>
      <span className="studio-brand-text">
        <span>Portfolio studio</span>
        <span>A space for your work</span>
      </span>
    </Link>
  )
}

function Account({ email }: { email: string }) {
  return (
    <div className="studio-account">
      <span className="studio-avatar" aria-hidden="true">
        {email.charAt(0)}
      </span>
      <span className="studio-account-text">
        <span title={email}>{email}</span>
        <span>Administrator</span>
      </span>
      <form action={signOutAction} className="studio-signout">
        <button
          type="submit"
          className="studio-icon-btn"
          aria-label="Sign out"
          data-tip="Sign out"
          data-tip-always
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}

export default function AdminShell({
  email,
  profile,
  counts,
  defaultCollapsed = false,
  children,
}: {
  email: string
  profile: Profile
  counts: AdminNavCounts
  defaultCollapsed?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // Smooth scrolling for every admin page (survives client-side navigation).
  useStudioSmoothScroll()

  // ── Desktop: full sidebar ⇄ icon rail ──────────────────────────────────
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [tip, setTip] = useState<Tip | null>(null)
  const asideRef = useRef<HTMLElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const refocusToggle = useRef(false)

  const toggleSidebar = () => {
    const next = !collapsed
    const focused = document.activeElement
    refocusToggle.current = focused === collapseRef.current || focused === expandRef.current
    setCollapsed(next)
    setTip(null)
    document.cookie = sidebarCookie(next, window.location.protocol === 'https:')
  }

  // The toggle that was just used turns inert; hand focus to its counterpart
  // so keyboard users stay on the control.
  useEffect(() => {
    if (!refocusToggle.current) return
    refocusToggle.current = false
    const target = collapsed ? expandRef.current : collapseRef.current
    target?.focus()
  }, [collapsed])

  // Rail tooltips: one floating label for every `[data-tip]` element. Shown in
  // the folded rail (where labels are hidden), or always with
  // `data-tip-always` for icon-only buttons. It is position: fixed, so the
  // sidebar's overflow clipping doesn't cut it off.
  const showTip = (el: Element | null) => {
    const label = el instanceof HTMLElement ? el.dataset.tip : undefined
    if (!el || !label || (!collapsed && !el.hasAttribute('data-tip-always'))) {
      setTip(null)
      return
    }
    const box = el.getBoundingClientRect()
    const edge = asideRef.current?.getBoundingClientRect().right ?? box.right
    const top = Math.round(box.top + box.height / 2)
    const left = Math.round(edge + 10)
    setTip((prev) => (prev?.label === label && prev.top === top && prev.left === left ? prev : { label, top, left }))
  }
  const hideTip = () => setTip(null)

  // The search pill shows the platform's shortcut (⌘K on Apple devices).
  const [mac, setMac] = useState(false)
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }, [])

  // ── Mobile: slide-in drawer ────────────────────────────────────────────
  const [drawer, setDrawer] = useState<DrawerState>('closed')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const drawerCloseRef = useRef<HTMLButtonElement>(null)
  const closeDrawer = useCallback(() => setDrawer((state) => (state === 'open' ? 'closing' : state)), [])

  // Drive the native <dialog> from state. showModal() gives focus trapping,
  // Escape handling and an inert background for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (drawer === 'open' && !dialog.open) {
      dialog.showModal()
      drawerCloseRef.current?.focus()
    }
    if (drawer === 'closed' && dialog.open) dialog.close()
    if (drawer !== 'closing') return
    // The panel's animationend closes it; this is the fallback if no animation runs.
    const timer = window.setTimeout(() => dialog.close(), 400)
    return () => window.clearTimeout(timer)
  }, [drawer])

  // Navigation (links, back/forward) closes the drawer and any tooltip.
  useEffect(() => {
    closeDrawer()
    setTip(null)
  }, [pathname, closeDrawer])

  // The drawer is hidden on desktop: never leave an invisible modal open.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => {
      if (query.matches) setDrawer('closed')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Lock background scroll (smooth scroll included) while the drawer is on screen.
  const drawerShown = drawer !== 'closed'
  useEffect(() => {
    if (!drawerShown) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const lenis = getLenisInstance()
    lenis?.stop()
    return () => {
      document.body.style.overflow = previous
      lenis?.start()
    }
  }, [drawerShown])

  return (
    <div className="admin-studio min-h-dvh bg-background lg:flex">
      <a href="#admin-content" className="studio-skip">Skip to content</a>

      {/* Desktop sidebar: folds into an icon rail. */}
      <aside
        ref={asideRef}
        id="studio-sidebar"
        className="studio-sidebar"
        data-collapsed={collapsed ? '' : undefined}
        onPointerOver={(e) => {
          if (e.pointerType === 'mouse') showTip((e.target as Element).closest('[data-tip]'))
        }}
        onPointerLeave={hideTip}
        onFocus={(e) => {
          const el = (e.target as Element).closest('[data-tip]')
          if (el?.matches(':focus-visible')) showTip(el)
        }}
        onBlur={hideTip}
      >
        <div className="studio-brand">
          <BrandLink inert={collapsed} profile={profile} />
          <button
            ref={collapseRef}
            type="button"
            className="studio-icon-btn studio-collapse"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            aria-controls="studio-sidebar"
            aria-expanded
            data-tip="Collapse sidebar"
            data-tip-always
            inert={collapsed}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
          {/* In the rail your photo itself reopens the sidebar. */}
          <button
            ref={expandRef}
            type="button"
            className="studio-expand"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            aria-controls="studio-sidebar"
            aria-expanded={false}
            data-tip="Expand sidebar"
            inert={!collapsed}
          >
            <span className="studio-monogram">
              <span className="studio-expand-letters">
                <ProfileMark profile={profile} />
              </span>
              <PanelLeftOpen size={18} className="studio-expand-icon" aria-hidden="true" />
            </span>
          </button>
        </div>

        <div className="studio-nav-scroll" onScroll={hideTip} data-lenis-prevent>
          <AdminNav counts={counts} />
        </div>

        <div className="studio-footer">
          <Account email={email} />
        </div>

        {tip && (
          <span className="studio-tooltip" style={{ top: tip.top, left: tip.left }} aria-hidden="true">
            {tip.label}
          </span>
        )}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div className="studio-topbar">
          <p className="studio-crumbs">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{pathname.split('/')[2]?.replaceAll('-', ' ') || 'Overview'}</strong>
          </p>
          <div className="studio-topbar-actions">
            <button type="button" className="studio-search" onClick={openCommandPalette} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
              <span className="studio-search-text">Search or jump to…</span>
              <kbd aria-hidden="true">{mac ? '⌘K' : 'Ctrl K'}</kbd>
              <span className="studio-search-icon" aria-hidden="true">
                <Search size={15} />
              </span>
            </button>
            {/* Fixed box: the toggle renders after mount, so reserve its space. */}
            <span className="studio-round">
              <ThemeToggle />
            </span>
            <Link href="/" target="_blank" rel="noreferrer" className="studio-round" aria-label="Visit portfolio (opens in a new tab)" title="Visit portfolio">
              <ExternalLink size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setDrawer('open')}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={drawer === 'open'}
          >
            <Menu size={18} />
          </Button>
          <BrandLink profile={profile} />
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={openCommandPalette} aria-label="Search pages and actions" aria-haspopup="dialog">
              <Search size={18} />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* Fills the space beside the sidebar, so folding it gives pages more
            room; the cap only kicks in on very wide monitors. */}
        <main id="admin-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="admin-page-content mx-auto w-full max-w-[1920px]">{children}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      <dialog
        ref={dialogRef}
        data-state={drawer}
        onCancel={(e) => {
          e.preventDefault()
          closeDrawer()
        }}
        onClose={() => setDrawer('closed')}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDrawer()
        }}
        className="studio-drawer"
        aria-label="Admin navigation"
        data-lenis-prevent
      >
        <div
          className="studio-drawer-panel"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && drawer === 'closing') dialogRef.current?.close()
          }}
        >
          <div className="studio-brand">
            <BrandLink profile={profile} />
            <button
              ref={drawerCloseRef}
              type="button"
              className="studio-icon-btn"
              onClick={closeDrawer}
              aria-label="Close navigation menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="studio-nav-scroll">
            <AdminNav counts={counts} onNavigate={closeDrawer} />
          </div>
          <div className="studio-footer">
            <Link href="/" target="_blank" rel="noreferrer" className="studio-nav-link">
              <span className="studio-nav-icon">
                <ExternalLink size={18} aria-hidden="true" />
              </span>
              <span className="studio-nav-label">View live site</span>
            </Link>
            <Account email={email} />
          </div>
        </div>
      </dialog>

      <CommandPalette counts={counts} />
    </div>
  )
}
