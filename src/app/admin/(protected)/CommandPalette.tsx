'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, CornerDownLeft, ExternalLink, Inbox, MessageSquareQuote, PenLine, Plus, Search, Target, type LucideIcon } from 'lucide-react'
import { getLenisInstance } from '@/lib/motion/smooth-scroll'
import { NAV_GROUPS, type AdminNavCounts } from './AdminNav'
import { filterCommands } from './command-palette'

const OPEN_EVENT = 'studio:command-palette'

/** Opens the palette from anywhere in the admin (topbar search, dashboard orb). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

type Group = 'Quick actions' | 'Go to'

interface Command {
  id: string
  label: string
  href: string
  group: Group
  icon: LucideIcon
  hint?: string
  keywords?: string
  external?: boolean
}

function buildCommands(counts: AdminNavCounts): Command[] {
  const waiting = (count: number, word: string) => (count > 0 ? `${count} ${word}` : undefined)
  const quick: Command[] = [
    { id: 'new-project', label: 'New project', href: '/admin/projects/new', group: 'Quick actions', icon: Plus, keywords: 'create add portfolio work' },
    { id: 'new-article', label: 'New article', href: '/admin/blog/new', group: 'Quick actions', icon: PenLine, keywords: 'create write blog post story' },
    { id: 'reply', label: 'Reply to new messages', href: '/admin/inbox?status=new', group: 'Quick actions', icon: Inbox, hint: waiting(counts.newMessages, 'new'), keywords: 'inbox contact unread' },
    { id: 'leads', label: 'Review new leads', href: '/admin/leads?status=new', group: 'Quick actions', icon: Target, hint: waiting(counts.newLeads, 'new'), keywords: 'freelance clients pipeline' },
    { id: 'reviews', label: 'Moderate reviews', href: '/admin/reviews?status=pending', group: 'Quick actions', icon: MessageSquareQuote, hint: waiting(counts.pendingReviews, 'pending'), keywords: 'testimonials approve' },
    { id: 'live-site', label: 'Open the live site', href: '/', group: 'Quick actions', icon: ExternalLink, keywords: 'visit portfolio public view', external: true },
  ]
  const pages: Command[] = NAV_GROUPS.flatMap(group =>
    group.items.map(item => ({ id: item.href, label: item.label, href: item.href, group: 'Go to' as const, icon: item.icon, hint: group.label })),
  )
  return [...quick, ...pages]
}

export default function CommandPalette({ counts }: { counts: AdminNavCounts }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // A single palette lives in the shell, so fixed ids are safe (and immune to
  // server/client tree differences elsewhere on the page, unlike useId).
  const baseId = 'studio-palette'
  const commands = useMemo(() => buildCommands(counts), [counts])
  const results = useMemo(() => filterCommands(commands, query), [commands, query])
  const current = Math.min(active, Math.max(0, results.length - 1))
  const optionId = (command: Command) => `${baseId}-${command.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  // ⌘K / Ctrl+K anywhere (unless a focused editor already handled it), and
  // open requests from other components.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.shiftKey) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(value => !value)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  // Drive the native modal <dialog>: focus trap, Escape and an inert page come
  // for free. The page behind stops scrolling (smooth scroll included).
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (!open) {
      if (el.open) el.close()
      return
    }
    if (!el.open) el.showModal()
    input.current?.focus()
    const lenis = getLenisInstance()
    lenis?.stop()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      lenis?.start()
    }
  }, [open])

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current, open])

  const run = (command: Command | undefined) => {
    if (!command) return
    setOpen(false)
    if (command.external) window.open(command.href, '_blank', 'noopener,noreferrer')
    else router.push(command.href)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!results.length) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[current])
    }
  }

  const groups = (['Quick actions', 'Go to'] as const)
    .map(name => ({ name, items: results.map((command, index) => ({ command, index })).filter(({ command }) => command.group === name) }))
    .filter(group => group.items.length > 0)

  return (
    <dialog
      ref={dialog}
      className="studio-palette"
      aria-label="Search pages and actions"
      data-lenis-prevent
      onClose={() => {
        setOpen(false)
        setQuery('')
        setActive(0)
      }}
      onClick={e => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="studio-palette-panel">
        <div className="studio-palette-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={results[current] ? optionId(results[current]) : undefined}
            placeholder="Search pages and actions…"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd aria-hidden="true">esc</kbd>
        </div>
        <div ref={list} id={`${baseId}-list`} role="listbox" aria-label="Results" className="studio-palette-list">
          {groups.length > 0 ? (
            groups.map(group => (
              <div key={group.name} role="group" aria-label={group.name}>
                <div className="studio-palette-heading" aria-hidden="true">
                  {group.name}
                </div>
                {group.items.map(({ command, index }) => {
                  const Icon = command.icon
                  return (
                    <div
                      key={command.id}
                      id={optionId(command)}
                      role="option"
                      aria-selected={index === current}
                      className="studio-palette-option"
                      onPointerMove={() => setActive(index)}
                      onClick={() => run(command)}
                    >
                      <span className="studio-palette-icon">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="studio-palette-label">{command.label}</span>
                      {command.hint && <span className="studio-palette-hint">{command.hint}</span>}
                      {command.external ? <ArrowUpRight size={15} aria-hidden="true" /> : <CornerDownLeft size={14} className="studio-palette-enter" aria-hidden="true" />}
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            <p className="studio-palette-empty">No results for “{query.trim()}”</p>
          )}
        </div>
        <div className="studio-palette-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
          <span><kbd>↵</kbd> to open</span>
          <span><kbd>esc</kbd> to close</span>
        </div>
      </div>
    </dialog>
  )
}
