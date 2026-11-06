'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { signOutAction } from '@/features/auth/actions'
import AdminNav, { type AdminNavCounts } from './AdminNav'
import './studio.css'

function Brand() {
  return (
    <Link
      href="/admin/dashboard"
      className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="studio-monogram flex size-10 items-center justify-center rounded-xl text-sm font-bold">
        KM
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-foreground">Portfolio studio</span>
        <span className="text-[11px] text-muted-foreground">A space for your work</span>
      </span>
    </Link>
  )
}

function SidebarBody({
  email,
  counts,
  onNavigate,
}: {
  email: string
  counts: AdminNavCounts
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 shrink-0 items-center border-b border-sidebar-border px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AdminNav counts={counts} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 space-y-3 border-t border-sidebar-border p-3">
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ExternalLink size={16} className="shrink-0" />
          View live site
        </Link>

        <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-card/50 p-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-primary">
            {email.charAt(0)}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
            {email}
          </span>
          <ThemeToggle />
        </div>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm" className="w-full justify-center">
            <LogOut size={16} />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function AdminShell({
  email,
  counts,
  children,
}: {
  email: string
  counts: AdminNavCounts
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()

  // Drive the native <dialog> from React state. showModal() gives us focus
  // trapping, Escape-to-close, and inert background for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // Close the drawer whenever navigation occurs.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <div className="admin-studio min-h-dvh bg-background lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#admin-content" className="studio-skip">Skip to content</a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarBody email={email} counts={counts} />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <div className="hidden h-16 items-center justify-between gap-4 border-b border-border px-8 text-xs text-muted-foreground lg:flex">
          <span>Workspace <span className="mx-3 opacity-40">/</span> <span className="capitalize text-foreground">{pathname.split('/')[2]?.replaceAll('-', ' ') || 'Overview'}</span></span>
          <Link href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-primary">Visit portfolio <ExternalLink size={13} aria-hidden="true" /></Link>
        </div>
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Menu size={18} />
          </Button>
          <Brand />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main id="admin-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="admin-page-content mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false)
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-foreground/40 lg:hidden"
        aria-label="Admin navigation"
      >
        <div className="relative flex h-full w-[18rem] max-w-[85vw] flex-col bg-sidebar shadow-xl">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="absolute right-2 top-2.5 z-10"
          >
            <X size={18} />
          </Button>
          <SidebarBody email={email} counts={counts} onNavigate={() => setOpen(false)} />
        </div>
      </dialog>
    </div>
  )
}
