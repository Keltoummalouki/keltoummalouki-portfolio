'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { animate, stagger } from 'animejs'
import {
  Activity, ArrowRight, ArrowUpRight, ChevronRight, FileText, FolderKanban, Inbox, PenLine, Search, Shuffle, Target, TrendingDown, TrendingUp, type LucideIcon,
} from 'lucide-react'
import { StatusBadge } from '@/components/admin/ui'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import {
  ACTIVITY_RANGES, activityScale, calendarDayLabel, formatCount, isContent, recordKey, smoothPath,
  type ActivityPoint, type ActivityRange, type DashboardRecord, type DashboardStats, type RecordKind, type WeekTrend,
} from './analytics'
import type { StackItem } from './scenes/CardStackScene'

const CardStackScene = dynamic(() => import('./scenes/CardStackScene'), { ssr: false })

// Dates shown here come pre-formatted from the server (DashboardStats), or
// are calendar days formatted in UTC: never Casablanca time computed in the
// browser, whose time-zone data can differ from Node's.
export const KIND_ICON: Record<RecordKind, LucideIcon> = { project: FolderKanban, article: FileText, message: Inbox, lead: Target }

/* ── Total cards ─────────────────────────────────────────────────────────── */

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <span className="d3-bars" aria-hidden="true">
      {values.map((value, i) => (
        <span key={i} data-bar="y" className={i === values.length - 1 ? 'is-now' : undefined} style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
      ))}
    </span>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  const last = Math.max(1, values.length - 1)
  const line = smoothPath(values.map((value, i) => [i, max - value] as const))
  return (
    <svg className="d3-spark" viewBox={`0 -0.35 ${last} ${max + 0.7}`} preserveAspectRatio="none" aria-hidden="true" data-clip>
      <path d={`${line}L${last},${max + 0.35}L0,${max + 0.35}Z`} className="d3-spark-area" />
      <path d={line} className="d3-spark-line" />
    </svg>
  )
}

export interface KpiProps {
  href: string
  label: string
  icon: LucideIcon
  value: number
  unit?: string
  series: number[]
  chart: 'bars' | 'line'
  accent: string
  featured?: boolean
  chip: string
  note: string
}

export function KpiCard({ href, label, icon: Icon, value, unit, series, chart, accent, featured, chip, note }: KpiProps) {
  return (
    <Link href={href} className={featured ? 'd3-kpi d3-kpi-featured' : 'd3-kpi'} style={{ '--accent': accent } as CSSProperties} data-tilt>
      <span className="d3-kpi-top">
        <span className="d3-kpi-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="d3-kpi-label">{label}</span>
        <ArrowUpRight size={16} className="d3-kpi-arrow" aria-hidden="true" />
      </span>
      <span className="d3-kpi-body">
        <span className="d3-kpi-value">
          <span data-count={value}>{formatCount(value)}</span>
          {unit && <small>{unit}</small>}
        </span>
        {chart === 'bars' ? <MiniBars values={series} /> : <Sparkline values={series} />}
      </span>
      <span className="d3-kpi-foot">
        <span className="d3-kpi-chip">{chip}</span>
        <span>{note}</span>
      </span>
    </Link>
  )
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

export function ProfileCard({ name, email, avatarUrl, stats }: { name: string; email: string; avatarUrl: string; stats: { label: string; value: number }[] }) {
  const [broken, setBroken] = useState(false)
  const initials = name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <section className="d3-card d3-profile" aria-labelledby="d3-profile-name" data-stage data-tilt>
      <div className="d3-avatar">
        {avatarUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-managed URL (Storage or /public), same as the About editor
          <img src={avatarUrl} alt="" width={84} height={84} onError={() => setBroken(true)} />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </div>
      <h2 id="d3-profile-name">{name}</h2>
      <p className="d3-profile-role">Administrator · Portfolio studio</p>
      {email && (
        <p className="d3-profile-email" title={email}>
          {email}
        </p>
      )}
      <dl className="d3-profile-stats">
        {stats.map(stat => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd data-count={stat.value}>{formatCount(stat.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="d3-profile-actions">
        <Link className="d3-btn d3-btn-ink" href="/" target="_blank" rel="noreferrer">
          View live site <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link className="d3-btn d3-btn-soft" href="/admin/about">
          Edit profile
        </Link>
      </div>
    </section>
  )
}

/* ── Content balance gauge ───────────────────────────────────────────────── */

const ARC = 'M20 112A90 90 0 0 1 200 112'

export function GaugeCard({ published, drafts, archived }: { published: number; drafts: number; archived: number }) {
  const total = published + drafts + archived
  const p = total ? published / total : 0
  const d = total ? drafts / total : 0
  const pct = Math.round(p * 100)
  return (
    <section className="d3-card d3-gauge" aria-labelledby="d3-gauge-title" data-stage>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">From idea to live</p>
          <h2 id="d3-gauge-title">Content balance</h2>
        </div>
        <Link href="/admin/projects" className="d3-icon-link" aria-label="Manage your projects">
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <div className="d3-gauge-dial" role="img" aria-label={`${pct}% of your ${total} projects and articles are published`}>
        <svg viewBox="0 0 220 124" aria-hidden="true">
          <path d={ARC} className="d3-gauge-track" pathLength={1} />
          {d > 0 && <path d={ARC} className="d3-gauge-drafts" pathLength={1} strokeDasharray={`${d} 1`} strokeDashoffset={-p} data-arc={d} data-arc-offset={p} />}
          {p > 0 && <path d={ARC} className="d3-gauge-value" stroke="#2563eb" pathLength={1} strokeDasharray={`${p} 1`} data-arc={p} />}
        </svg>
        <div className="d3-gauge-center">
          <strong>
            <span data-count={pct}>{formatCount(pct)}</span>
            <small>%</small>
          </strong>
          <span>published</span>
        </div>
      </div>
      <ul className="d3-gauge-legend">
        <li><span><i className="is-published" />Published</span><strong>{published}</strong></li>
        <li><span><i className="is-draft" />In draft</span><strong>{drafts}</strong></li>
        <li><span><i />Archived</span><strong>{archived}</strong></li>
      </ul>
    </section>
  )
}

/* ── Activity chart ──────────────────────────────────────────────────────── */

export function ActivityCard({ activity, trend }: { activity: Record<ActivityRange, ActivityPoint[]>; trend: WeekTrend }) {
  const [days, setDays] = useState<ActivityRange>(30)
  const [selected, setSelected] = useState<number | null>(null)
  const plot = useRef<SVGSVGElement>(null)
  const firstRange = useRef(true)
  const series = activity[days]
  const scale = activityScale(Math.max(...series.map(p => Math.max(p.content, p.inquiries))))
  const last = days - 1
  const contentLine = smoothPath(series.map((p, i) => [i, scale.max - p.content] as const))
  const inquiryLine = smoothPath(series.map((p, i) => [i, scale.max - p.inquiries] as const))
  const totals = series.reduce((sum, p) => ({ content: sum.content + p.content, inquiries: sum.inquiries + p.inquiries }), { content: 0, inquiries: 0 })
  const point = selected === null ? null : series[selected]

  // Re-draw the curves left to right when the range changes.
  useEffect(() => {
    if (firstRange.current) {
      firstRange.current = false
      return
    }
    const el = plot.current
    if (!el || prefersReducedMotion()) return
    const state = { t: 0 }
    const reveal = animate(state, {
      t: 1, duration: 900, ease: 'outExpo',
      onUpdate: () => (el.style.clipPath = `inset(-2px ${(1 - state.t) * 100}% -2px 0)`),
      onComplete: () => (el.style.clipPath = ''),
    })
    return () => {
      reveal.cancel()
      el.style.clipPath = ''
    }
  }, [days])

  const TrendIcon = trend.change !== null && trend.change < 0 ? TrendingDown : TrendingUp
  const trendText = trend.change === null ? (trend.current ? `${trend.current} new this week` : 'A quiet week') : `${trend.change > 0 ? '+' : ''}${trend.change}% vs last week`

  return (
    <section className="d3-card d3-activity" aria-labelledby="d3-activity-title" data-reveal>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">The big picture</p>
          <h2 id="d3-activity-title">Workspace activity</h2>
        </div>
        <div className="d3-segment" role="group" aria-label="Activity time range">
          {ACTIVITY_RANGES.map(d => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => { setDays(d); setSelected(null) }}>
              {d}d
            </button>
          ))}
        </div>
      </header>
      <div className="d3-activity-summary">
        <strong>
          <span data-count={totals.content + totals.inquiries}>{formatCount(totals.content + totals.inquiries)}</span>
          <small>new records</small>
        </strong>
        <span className={`d3-trend ${trend.change !== null && trend.change < 0 ? 'is-down' : ''}`}>
          <TrendIcon size={14} aria-hidden="true" /> {trendText}
        </span>
        <span className="d3-legend-dots">
          <span><i className="is-content" /> Content {totals.content}</span>
          <span><i className="is-inquiries" /> Inquiries {totals.inquiries}</span>
        </span>
      </div>
      <div className="d3-chart" onMouseLeave={() => setSelected(null)}>
        <div className="d3-chart-y" aria-hidden="true">
          {scale.ticks.map(t => (
            <span key={t} style={{ bottom: `${(t / scale.max) * 100}%` }}>{t}</span>
          ))}
        </div>
        <div className="d3-chart-plot">
          <svg
            ref={plot}
            viewBox={`0 0 ${last} ${scale.max}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Activity over ${days} days: ${totals.content} content records created and ${totals.inquiries} inquiries received`}
            data-clip
          >
            {scale.ticks.map(t => (
              <line key={t} x1="0" x2={last} y1={scale.max - t} y2={scale.max - t} className="d3-gridline" />
            ))}
            <path d={`${contentLine}L${last},${scale.max}L0,${scale.max}Z`} className="d3-area" />
            <path d={contentLine} className="d3-line-content" />
            <path d={inquiryLine} className="d3-line-inquiries" />
            {series.map((p, i) => (
              <rect key={p.date} x={Math.max(0, i - 0.5)} y="0" width={i === 0 || i === last ? 0.5 : 1} height={scale.max} fill="transparent" onMouseEnter={() => setSelected(i)} />
            ))}
          </svg>
          {point && selected !== null && (
            <>
              <span className="d3-chart-guide" style={{ left: `${(selected / last) * 100}%` }} aria-hidden="true" />
              <span className="d3-chart-dot is-content" style={{ left: `${(selected / last) * 100}%`, top: `${(1 - point.content / scale.max) * 100}%` }} aria-hidden="true" />
              <span className="d3-chart-dot is-inquiries" style={{ left: `${(selected / last) * 100}%`, top: `${(1 - point.inquiries / scale.max) * 100}%` }} aria-hidden="true" />
              <span className={`d3-chart-tip ${selected > last * 0.7 ? 'is-left' : ''}`} style={{ left: `${(selected / last) * 100}%` }} aria-live="polite">
                <strong>{calendarDayLabel(point.date)}</strong>
                <span>{point.content} content · {point.inquiries} inquiries</span>
              </span>
            </>
          )}
        </div>
        <div className="d3-chart-x" aria-hidden="true">
          {[0, Math.floor(last / 3), Math.floor((last * 2) / 3), last].map(i => (
            <span key={i} style={{ left: `${(i / last) * 100}%` }}>{calendarDayLabel(series[i].date)}</span>
          ))}
        </div>
      </div>
      <details className="d3-chart-data">
        <summary>View daily data</summary>
        <div data-lenis-prevent>
          <table>
            <thead><tr><th>Date</th><th>Content</th><th>Inquiries</th></tr></thead>
            <tbody>
              {series.map(p => (
                <tr key={p.date}><td>{p.date}</td><td>{p.content}</td><td>{p.inquiries}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

/* ── Latest work: the 3D card deck ───────────────────────────────────────── */

export function StackCard({ items }: { items: StackItem[] }) {
  const [front, setFront] = useState(0)
  const cycle = () => setFront(f => (f + 1) % Math.max(1, items.length))
  const ordered = items.map((_, i) => ({ item: items[(front + i) % items.length], number: ((front + i) % items.length) + 1 }))
  return (
    <section className="d3-card d3-stack" aria-labelledby="d3-stack-title" data-reveal>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">On display</p>
          <h2 id="d3-stack-title">Latest work</h2>
        </div>
        {items.length > 1 && (
          <button type="button" className="d3-chip-btn" onClick={cycle}>
            <Shuffle size={14} aria-hidden="true" /> Shuffle
          </button>
        )}
      </header>
      <div className="d3-stack-stage">
        <CardStackScene className="d3-scene" items={items} front={front} onCycle={cycle} />
      </div>
      <ol className="d3-stack-list">
        {ordered.map(({ item, number }, i) => (
          <li key={item.id}>
            <Link href={item.href} className={i === 0 ? 'is-front' : undefined} data-row>
              <span className="d3-stack-number">{String(number).padStart(2, '0')}</span>
              <span className="d3-stack-text">
                <strong>{item.title}</strong>
                <span>{item.label.toLowerCase()}{item.date ? ` · ${item.date}` : ''}</span>
              </span>
              <StatusBadge status={item.status} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ── Recent activity ─────────────────────────────────────────────────────── */

type FeedFilter = 'all' | 'content' | 'inquiries'

export function FeedCard({ records, labels }: { records: DashboardRecord[]; labels: DashboardStats['labels'] }) {
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [search, setSearch] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const firstFilter = useRef(true)
  const query = search.trim().toLowerCase()
  const visible = records
    .filter(r => filter === 'all' || (filter === 'content') === isContent(r.kind))
    .filter(r => `${r.title} ${r.detail}`.toLowerCase().includes(query))
    .slice(0, 8)

  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false
      return
    }
    const rows = list.current?.querySelectorAll('[data-row]')
    if (!rows?.length || prefersReducedMotion()) return
    const enter = animate(rows, { opacity: [0, 1], translateY: [10, 0], duration: 500, delay: stagger(35), ease: 'outQuad' })
    return () => {
      enter.revert()
    }
  }, [filter])

  return (
    <section className="d3-card d3-feed" aria-labelledby="d3-feed-title" data-reveal>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">Fresh from your workspace</p>
          <h2 id="d3-feed-title">Recent activity</h2>
        </div>
        <span className="d3-total">{formatCount(records.length)} records</span>
      </header>
      <div className="d3-feed-toolbar">
        <div className="d3-segment" role="group" aria-label="Filter recent activity">
          {(['all', 'content', 'inquiries'] as const).map(f => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <label className="d3-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" aria-label="Search recent activity" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find something…" />
        </label>
      </div>
      <div className="d3-feed-list" ref={list}>
        {visible.length ? (
          visible.map(r => {
            const Icon = KIND_ICON[r.kind]
            return (
              <Link key={`${r.kind}-${r.id}`} href={r.href} className="d3-row" data-row>
                <span className={`d3-row-icon is-${r.kind}`}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="d3-row-text">
                  <strong>{r.title}</strong>
                  <span>{r.detail}</span>
                </span>
                <StatusBadge status={r.status} />
                <time dateTime={r.createdAt}>{labels[recordKey(r)]?.day}</time>
                <ChevronRight size={15} className="d3-row-chevron" aria-hidden="true" />
              </Link>
            )
          })
        ) : (
          <div className="d3-empty">
            <Activity size={24} aria-hidden="true" />
            <strong>{query ? 'No matching records' : 'A clean slate'}</strong>
            <p>{query ? 'Try a different name or clear your search.' : 'New projects, stories, and conversations will appear here.'}</p>
            {query && (
              <button type="button" onClick={() => setSearch('')}>
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Focus list ──────────────────────────────────────────────────────────── */

export interface FocusTask {
  label: string
  count: number
  href: string
  icon: LucideIcon
}

export function FocusCard({ tasks }: { tasks: FocusTask[] }) {
  const total = tasks.reduce((sum, task) => sum + task.count, 0)
  return (
    <section className="d3-card d3-focus" aria-labelledby="d3-focus-title" data-reveal>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">Make space for what’s next</p>
          <h2 id="d3-focus-title">Your focus</h2>
        </div>
        <span className="d3-count-pill" data-count={total}>{formatCount(total)}</span>
      </header>
      <ul className="d3-tasks">
        {tasks.map(task => {
          const Icon = task.icon
          return (
            <li key={task.href}>
              <Link href={task.href} className="d3-task" data-row>
                <span className="d3-task-icon">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="d3-task-label">{task.label}</span>
                <strong className={task.count ? 'is-due' : undefined}>{task.count}</strong>
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
      <Link href="/admin/blog/new" className="d3-focus-cta">
        <PenLine size={16} aria-hidden="true" /> Write something new <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </section>
  )
}

/* ── Freelance pipeline ──────────────────────────────────────────────────── */

const STAGES = ['new', 'qualified', 'meeting', 'proposal', 'won', 'lost'] as const

export function PipelineCard({ leads }: { leads: DashboardRecord[] }) {
  const counts = STAGES.map(stage => leads.filter(lead => lead.status === stage).length)
  const max = Math.max(1, ...counts)
  return (
    <section className="d3-card d3-pipeline" aria-labelledby="d3-pipeline-title" data-reveal>
      <header className="d3-card-head">
        <div>
          <p className="d3-eyebrow">Opportunity board</p>
          <h2 id="d3-pipeline-title">Freelance pipeline</h2>
        </div>
        <Link href="/admin/leads" className="d3-icon-link" aria-label="View all leads">
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <ol className="d3-stages">
        {STAGES.map((stage, i) => (
          <li key={stage}>
            <Link href={`/admin/leads?status=${stage}`}>
              <span className="d3-stage-name">
                <i className={`is-${stage}`} />
                {stage}
              </span>
              <span className="d3-stage-track">
                <span data-bar="x" className={`is-${stage}`} style={{ width: `${(counts[i] / max) * 100}%` }} />
              </span>
              <strong data-count={counts[i]}>{formatCount(counts[i])}</strong>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
