'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { FileText, FolderKanban, Inbox, Moon, PenLine, Plus, Sun, Target, Zap } from 'lucide-react'
import './dashboard.css'
import { openCommandPalette } from '../CommandPalette'
import { formatCount, isContent, recordKey, type DashboardRecord, type DashboardStats, type RecordKind } from './analytics'
import { buildVolumes, type VolumeModel } from './volumes'
import { ActivityCard, FeedCard, FocusCard, GaugeCard, KpiCard, PipelineCard, ProfileCard, StackCard, type FocusTask, type KpiProps } from './cards'
import { useDashboardMotion } from './motion'
import type { StackItem } from './scenes/CardStackScene'

// The 3D scenes are client-only and load after the page: three.js never
// touches the server bundle or the first paint.
const VolumesScene = dynamic(() => import('./scenes/VolumesScene'), { ssr: false })
const PulseOrb = dynamic(() => import('./scenes/PulseOrb'), { ssr: false })

const noop = () => () => undefined
/** False on the server and during hydration, true afterwards: for browser-only UI. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false)

interface DashboardProps {
  records: DashboardRecord[]
  /** Calendar-dependent values, computed on the server (see dashboardStats). */
  stats: DashboardStats
  profile: { fullName: string; avatarUrl: string; email: string }
  reviews: { approved: number; pending: number }
}

function VolumesCard({ volumes, scroll }: { volumes: VolumeModel[]; scroll: { current: number } }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const { resolvedTheme, setTheme } = useTheme()
  const [active, setActive] = useState<RecordKind | null>(null)
  const dark = resolvedTheme === 'dark'
  return (
    <section className="d3-card d3-volumes" aria-labelledby="d3-volumes-title" data-stage>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">Studio in volume</p>
          <h2 id="d3-volumes-title">Your work at a glance</h2>
          <p className="d3-card-sub">Each volume grows with its records. The solid core is what’s published, unread or open.</p>
        </div>
        {hydrated && (
          <button type="button" className="d3-chip-btn" onClick={() => setTheme(dark ? 'light' : 'dark')}>
            {dark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            {dark ? 'Day view' : 'Night view'}
          </button>
        )}
      </header>
      <div className="d3-volumes-stage">
        {hydrated && <VolumesScene className="d3-scene" volumes={volumes} dark={dark} active={active} onHover={setActive} onSelect={href => router.push(href)} scroll={scroll} />}
      </div>
      <ul className="d3-legend">
        {volumes.map(volume => (
          <li key={volume.kind}>
            <Link
              href={volume.href}
              style={{ '--tower': volume.color } as CSSProperties}
              data-active={active === volume.kind ? '' : undefined}
              onMouseEnter={() => setActive(volume.kind)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(volume.kind)}
              onBlur={() => setActive(null)}
            >
              <span className="d3-legend-name">
                <i aria-hidden="true" />
                {volume.label}
              </span>
              <strong data-count={volume.total}>{formatCount(volume.total)}</strong>
              <span className="d3-legend-sub">{volume.litLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Floating "Quick actions" button: the liquid orb opens the command palette. */
function PulseButton({ attention }: { attention: number }) {
  const hydrated = useHydrated()
  const [excited, setExcited] = useState(false)
  const [mac, setMac] = useState(false)
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }, [])
  return (
    <button
      type="button"
      className="d3-fab"
      onClick={openCommandPalette}
      onPointerEnter={() => setExcited(true)}
      onPointerLeave={() => setExcited(false)}
      onFocus={() => setExcited(true)}
      onBlur={() => setExcited(false)}
      aria-keyshortcuts="Control+K Meta+K"
    >
      <span className="d3-fab-orb" aria-hidden="true">
        {hydrated && <PulseOrb className="d3-fab-canvas" energy={0.3 + Math.min(attention, 6) * 0.09} excited={excited} />}
      </span>
      <span className="d3-fab-label">Quick actions</span>
      {attention > 0 && (
        <span className="d3-fab-badge">
          {attention}
          <span className="sr-only"> waiting for you</span>
        </span>
      )}
      <kbd aria-hidden="true">{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  )
}

export default function DashboardView({ records, stats, profile, reviews }: DashboardProps) {
  const root = useRef<HTMLDivElement>(null)
  const volumesScroll = useRef(0.5)
  useDashboardMotion(root, volumesScroll)

  const data = useMemo(() => {
    const of = (kind: RecordKind) => records.filter(r => r.kind === kind)
    const projects = of('project')
    const articles = of('article')
    const messages = of('message')
    const leads = of('lead')
    const content = records.filter(r => isContent(r.kind))
    const count = (list: DashboardRecord[], status: string) => list.filter(r => r.status === status).length
    const unread = count(messages, 'new')
    const newLeads = count(leads, 'new')
    const openLeads = leads.filter(l => ['new', 'qualified', 'meeting', 'proposal'].includes(l.status)).length
    const series = (kind: RecordKind) => stats.weekly[kind]

    const kpis: (KpiProps & { key: string })[] = [
      { key: 'project', href: '/admin/projects', label: 'Projects', icon: FolderKanban, value: projects.length, series: series('project'), chart: 'bars', accent: '#2a6aff', chip: `${count(projects, 'published')} published`, note: `${count(projects, 'draft')} in draft` },
      { key: 'article', href: '/admin/blog', label: 'Articles', icon: FileText, value: articles.length, series: series('article'), chart: 'line', accent: '#8b5cf6', chip: `${count(articles, 'published')} published`, note: `+${stats.lastMonth.article} this month` },
      { key: 'message', href: '/admin/inbox', label: 'Inbox', icon: Inbox, value: unread, unit: 'unread', series: series('message'), chart: 'bars', accent: '#14b8a6', chip: `${messages.length} messages`, note: unread ? 'Reply now' : 'All caught up' },
      { key: 'lead', href: '/admin/leads', label: 'Open leads', icon: Target, value: openLeads, unit: 'open', series: series('lead'), chart: 'line', accent: '#f59e0b', featured: true, chip: `${count(leads, 'won')} won`, note: `${leads.length} total` },
    ]

    const tasks: FocusTask[] = [
      { label: 'Reply to new messages', count: unread, href: '/admin/inbox?status=new', icon: Inbox },
      { label: 'Explore new opportunities', count: newLeads, href: '/admin/leads?status=new', icon: Target },
      { label: 'Finish project drafts', count: count(projects, 'draft'), href: '/admin/projects', icon: FolderKanban },
      { label: 'Continue your stories', count: count(articles, 'draft'), href: '/admin/blog', icon: PenLine },
    ]

    // The three most recent projects (topped up with articles) become the 3D deck.
    const picks = [...projects, ...articles].slice(0, 3)
    const stack: StackItem[] = picks.length
      ? picks.map(r => ({ id: recordKey(r), title: r.title, status: r.status, label: r.kind === 'project' ? 'PROJECT' : 'ARTICLE', date: stats.labels[recordKey(r)]?.month ?? '', href: r.href }))
      : [
          { id: 'idea-project', title: 'Your next big project', status: 'idea', label: 'PROJECT', date: '', href: '/admin/projects/new' },
          { id: 'idea-article', title: 'A story worth telling', status: 'idea', label: 'ARTICLE', date: '', href: '/admin/blog/new' },
        ]

    return {
      kpis,
      tasks,
      stack,
      leads,
      volumes: buildVolumes(records),
      published: count(content, 'published'),
      drafts: count(content, 'draft'),
      archived: content.length - count(content, 'published') - count(content, 'draft'),
      wonLeads: count(leads, 'won'),
      unread,
      newLeads,
    }
  }, [records, stats])

  const firstName = profile.fullName.trim().split(/\s+/)[0] || 'there'
  const hello = `${stats.greeting},`
  const attention = data.unread + data.newLeads + reviews.pending
  const waiting = [
    data.unread && `${data.unread} unread ${data.unread === 1 ? 'message' : 'messages'}`,
    data.newLeads && `${data.newLeads} new ${data.newLeads === 1 ? 'lead' : 'leads'}`,
    reviews.pending && `${reviews.pending} ${reviews.pending === 1 ? 'review' : 'reviews'} to moderate`,
  ].filter(Boolean)
  const lede = waiting.length ? `Waiting for you: ${waiting.join(', ')}.` : 'Inbox zero. A perfect moment to build something new.'

  return (
    <>
      <div className="d3" ref={root}>
        <header className="d3-hero">
          <div className="d3-hero-text">
            <p className="d3-date" data-intro>
              <span className="d3-live" aria-hidden="true" />
              {stats.today}
            </p>
            <h1 className="d3-title">
              <span className="sr-only">{`${hello} ${firstName}`}</span>
              <span aria-hidden="true">
                {hello.split(' ').map(word => (
                  <span className="d3-word" key={word}>
                    <span>{word}</span>
                  </span>
                ))}
                <span className="d3-word">
                  <span className="d3-name">{firstName}</span>
                </span>
              </span>
            </h1>
            <p className="d3-lede" data-intro>{lede}</p>
          </div>
          <div className="d3-hero-actions" data-intro>
            <Link href="/admin/blog/new" className="d3-btn d3-btn-soft">
              <PenLine size={16} aria-hidden="true" /> New article
            </Link>
            <Link href="/admin/projects/new" className="d3-btn d3-btn-ink" data-magnetic>
              <Plus size={16} aria-hidden="true" /> New project
            </Link>
          </div>
        </header>

        <section className="d3-kpis" aria-label="Totals">
          {data.kpis.map(({ key, ...kpi }) => (
            <KpiCard key={key} {...kpi} />
          ))}
        </section>

        <div className="d3-grid">
          <VolumesCard volumes={data.volumes} scroll={volumesScroll} />
          <div className="d3-side">
            <ProfileCard
              name={profile.fullName}
              email={profile.email}
              avatarUrl={profile.avatarUrl}
              stats={[
                { label: 'Published', value: data.published },
                { label: 'Reviews', value: reviews.approved },
                { label: 'Leads won', value: data.wonLeads },
              ]}
            />
            <GaugeCard published={data.published} drafts={data.drafts} archived={data.archived} />
          </div>
        </div>

        <div className="d3-grid d3-grid-b">
          <ActivityCard activity={stats.activity} trend={stats.trend} />
          <StackCard items={data.stack} />
        </div>

        <div className="d3-grid">
          <FeedCard records={records} labels={stats.labels} />
          <div className="d3-side">
            <FocusCard tasks={data.tasks} />
            <PipelineCard leads={data.leads} />
          </div>
        </div>

        <footer className="d3-footer" data-reveal>
          <span>
            <Zap size={13} aria-hidden="true" /> Built around your work.
          </span>
          <span>Statistics reflect saved records · {stats.today}</span>
        </footer>
      </div>
      {/* Outside .d3: its container query would otherwise become the button's containing block. */}
      <PulseButton attention={attention} />
    </>
  )
}
