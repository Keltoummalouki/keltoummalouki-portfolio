'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Award,
  BadgeEuro,
  Briefcase,
  FileText,
  FolderKanban,
  GraduationCap,
  Inbox,
  Languages,
  LayoutDashboard,
  MessageCircleQuestion,
  MessageSquareQuote,
  Palette,
  Share2,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type BadgeKey = 'newMessages' | 'newLeads' | 'pendingReviews'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: BadgeKey
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Grouped by everyday work: content, conversations, profile, and settings.
// Badges on Inbox, Leads and Reviews are fed real
// "new"/"pending" counts from the layout — never invented.
const groups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
      { href: '/admin/blog', label: 'Blog', icon: FileText },
      { href: '/admin/faq', label: 'FAQ', icon: MessageCircleQuestion },
      { href: '/admin/services', label: 'Services & pricing', icon: BadgeEuro },
    ],
  },
  {
    label: 'Conversations',
    items: [
      { href: '/admin/inbox', label: 'Inbox', icon: Inbox, badge: 'newMessages' },
      { href: '/admin/leads', label: 'Freelance leads', icon: Target, badge: 'newLeads' },
      { href: '/admin/reviews', label: 'Reviews', icon: MessageSquareQuote, badge: 'pendingReviews' },
    ],
  },
  {
    label: 'Your profile',
    items: [
      { href: '/admin/about', label: 'About', icon: UserRound },
      { href: '/admin/skills', label: 'Skills', icon: Sparkles },
      { href: '/admin/languages', label: 'Languages', icon: Languages },
      { href: '/admin/experience', label: 'Experience', icon: Briefcase },
      { href: '/admin/education', label: 'Education', icon: GraduationCap },
      { href: '/admin/certifications', label: 'Certifications', icon: Award },
      { href: '/admin/social', label: 'Social links', icon: Share2 },
    ],
  },
  {
    label: 'Settings',
    items: [{ href: '/admin/theme', label: 'Theme & design', icon: Palette }],
  },
]

export interface AdminNavCounts {
  newMessages: number
  newLeads: number
  pendingReviews: number
}

export default function AdminNav({
  counts,
  onNavigate,
}: {
  counts?: AdminNavCounts
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            const count = badge ? counts?.[badge] ?? 0 : 0
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                  />
                )}
                <Icon
                  size={17}
                  className={cn(
                    'shrink-0 transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span className="truncate">{label}</span>
                {count > 0 && (
                  <span
                    className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
                    aria-label={`${count} new`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
