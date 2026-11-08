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

type BadgeKey = 'newMessages' | 'newLeads' | 'pendingReviews'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: BadgeKey
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Grouped by everyday work: content, conversations, profile, and settings.
// Badges on Inbox, Leads and Reviews are fed real
// "new"/"pending" counts from the layout — never invented. The command
// palette (⌘K) lists the same pages.
export const NAV_GROUPS: readonly NavGroup[] = [
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

  // Styling lives in studio.css (`.studio-nav*`): in the folded rail the icons
  // keep their exact position while labels and badges fade out, a dot stands in
  // for the badge, and `data-tip` feeds the rail tooltip in AdminShell.
  return (
    <nav aria-label="Admin sections" className="studio-nav">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="studio-nav-group">
          <p className="studio-nav-heading">
            <span>{group.label}</span>
          </p>
          {group.items.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            const count = badge ? counts?.[badge] ?? 0 : 0
            const shown = count > 99 ? '99+' : String(count)
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className="studio-nav-link"
                data-tip={count > 0 ? `${label} · ${shown} new` : label}
              >
                <span className="studio-nav-icon">
                  <Icon size={18} aria-hidden="true" />
                  {count > 0 && <span className="studio-nav-dot" aria-hidden="true" />}
                </span>
                <span className="studio-nav-label">{label}</span>
                {count > 0 && (
                  <span className="studio-nav-badge">
                    {shown}
                    <span className="sr-only"> new</span>
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
