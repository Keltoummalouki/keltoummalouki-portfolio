'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, FileText, FolderKanban, Inbox, Layers3, Plus, Search, Sparkles, Target, Zap } from 'lucide-react'
import { StatusBadge } from '@/components/admin/ui'
import { activitySeries, type DashboardRecord, type RecordKind } from './analytics'

const kinds = {
  project: { label: 'Projects', icon: FolderKanban, href: '/admin/projects' },
  article: { label: 'Articles', icon: FileText, href: '/admin/blog' },
  message: { label: 'Messages', icon: Inbox, href: '/admin/inbox' },
  lead: { label: 'Freelance leads', icon: Target, href: '/admin/leads' },
}
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'Africa/Casablanca' })

export default function DashboardView({ records, now }: { records: DashboardRecord[]; now: string }) {
  const [days, setDays] = useState(30)
  const [filter, setFilter] = useState<'all' | 'content' | 'inquiries'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const series = useMemo(() => activitySeries(records, days, now), [records, days, now])
  const content = records.filter(r => r.kind === 'project' || r.kind === 'article')
  const published = content.filter(r => r.status === 'published').length
  const drafts = content.filter(r => r.status === 'draft').length
  const archived = content.length - published - drafts
  const unread = records.filter(r => (r.kind === 'message' || r.kind === 'lead') && r.status === 'new')
  const leads = records.filter(r => r.kind === 'lead')
  const totalActivity = series.reduce((sum, p) => sum + p.content + p.inquiries, 0)
  const maxY = Math.max(4, ...series.map(p => Math.max(p.content, p.inquiries)))
  const point = (index: number, value: number) => `${40 + index * 660 / (days - 1)},${190 - value / maxY * 155}`
  const path = (key: 'content' | 'inquiries') => series.map((p, i) => `${i === 0 ? 'M' : 'L'}${point(i, p[key])}`).join(' ')
  const selectedPoint = selected === null ? null : series[selected]
  const visible = records.filter(r => (filter === 'all' || (filter === 'content' ? r.kind === 'project' || r.kind === 'article' : r.kind === 'message' || r.kind === 'lead')) && `${r.title} ${r.detail}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
  const tasks = [
    { label: 'Reply to new messages', count: unread.filter(r => r.kind === 'message').length, href: '/admin/inbox?status=new', icon: Inbox },
    { label: 'Explore new opportunities', count: unread.filter(r => r.kind === 'lead').length, href: '/admin/leads?status=new', icon: Target },
    { label: 'Finish project drafts', count: content.filter(r => r.kind === 'project' && r.status === 'draft').length, href: '/admin/projects', icon: FolderKanban },
    { label: 'Continue your stories', count: content.filter(r => r.kind === 'article' && r.status === 'draft').length, href: '/admin/blog', icon: FileText },
  ]

  return <div className="dash">
    <header className="dash-heading">
      <div><div className="dash-eyebrow"><span /> YOUR PORTFOLIO, AT A GLANCE</div><h1>Big ideas. <span>Clear overview.</span></h1><p>Welcome to your studio. Let’s make your next move count.</p></div>
      <Link className="studio-primary" href="/admin/projects/new"><Plus size={17} /> Create project</Link>
    </header>

    <section className="dash-metrics" aria-label="All-time statistics">
      {(Object.entries(kinds) as [RecordKind, typeof kinds.project][]).map(([kind, config], index) => {
        const items = records.filter(r => r.kind === kind)
        const isContent = kind === 'project' || kind === 'article'
        const highlighted = items.filter(r => r.status === (isContent ? 'published' : 'new')).length
        const Icon = config.icon
        return <Link href={config.href} key={kind} className={`dash-metric ${index === 0 ? 'dash-metric-featured' : ''}`}>
          <div className="dash-metric-top"><span className="dash-icon"><Icon size={19} /></span><span>{config.label}</span><ArrowUpRight size={16} /></div>
          <div className="dash-metric-value">{items.length.toLocaleString()}<span>all time</span></div>
          <div className="dash-metric-bottom"><span>{isContent ? <Check size={12} /> : <ArrowDownLeft size={12} />}{highlighted} {isContent ? 'published' : 'new'}</span><span>{isContent ? `${items.filter(r => r.status === 'draft').length} drafts` : kind === 'lead' ? 'View leads' : 'Open inbox'} <ChevronRight size={12} /></span></div>
        </Link>
      })}
    </section>

    <div className="dash-main-grid">
      <section className="dash-panel dash-chart-panel">
        <div className="dash-panel-heading"><div><span className="dash-eyebrow">THE BIG PICTURE</span><h2>Workspace activity</h2></div><div className="dash-segment" aria-label="Activity time range">{[7, 30, 90].map(d => <button key={d} aria-pressed={days === d} onClick={() => { setDays(d); setSelected(null) }}>{d} days</button>)}</div></div>
        <div className="dash-chart-summary"><strong>{totalActivity}<small>new records</small></strong><div className="dash-legend"><span><i /> Content created</span><span><i /> Inquiries received</span></div></div>
        <div className="dash-chart" onMouseLeave={() => setSelected(null)}>
          <svg viewBox="0 0 740 230" role="img" aria-label={`Activity over ${days} days: ${series.reduce((s,p) => s+p.content,0)} content records created and ${series.reduce((s,p) => s+p.inquiries,0)} inquiries received`}>
            <defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity=".22" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
            {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="40" x2="700" y1={190-i*38.75} y2={190-i*38.75} className="dash-gridline" /><text x="25" y={194-i*38.75} textAnchor="end">{Math.round(maxY*i/4)}</text></g>)}
            <g key={days} className="dash-chart-lines"><path d={`${path('content')} L700,190 L40,190 Z`} fill="url(#activity-fill)" /><path d={path('content')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" /><path d={path('inquiries')} fill="none" stroke="#6caec4" strokeWidth="2.5" strokeDasharray="5 5" strokeLinejoin="round" /></g>
            {[0, Math.floor((days-1)/3), Math.floor((days-1)*2/3), days-1].map(i => <text key={i} x={40+i*660/(days-1)} y="220" textAnchor="middle">{dateLabel(series[i].date+'T12:00:00Z')}</text>)}
            {series.map((p, i) => <rect key={p.date} x={40+i*660/(days-1)-330/(days-1)} y="25" width={660/(days-1)} height="170" fill="transparent" onMouseEnter={() => setSelected(i)}><title>{dateLabel(p.date+'T12:00:00Z')}: {p.content} content, {p.inquiries} inquiries</title></rect>)}
            {selected !== null && <line x1={40+selected*660/(days-1)} x2={40+selected*660/(days-1)} y1="25" y2="190" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 4" />}
          </svg>
          <div className="dash-chart-caption" aria-live="polite">{selectedPoint ? `${dateLabel(selectedPoint.date+'T12:00:00Z')} · ${selectedPoint.content} content created · ${selectedPoint.inquiries} inquiries received` : totalActivity ? 'Created dates · Casablanca time · Hover to explore' : 'No new records in this period. Your next creation starts the story.'}</div>
        </div>
        <details className="dash-chart-data"><summary>View daily data</summary><div><table><thead><tr><th>Date</th><th>Content</th><th>Inquiries</th></tr></thead><tbody>{series.map(p => <tr key={p.date}><td>{p.date}</td><td>{p.content}</td><td>{p.inquiries}</td></tr>)}</tbody></table></div></details>
      </section>

      <section className="dash-panel dash-content-panel"><div className="dash-panel-heading"><div><span className="dash-eyebrow">FROM IDEA TO LIVE</span><h2>Content balance</h2></div><Layers3 size={20} className="text-primary" /></div>
        <div className="dash-ring-wrap"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="76" className="dash-ring-track" />{content.length > 0 && <><circle cx="100" cy="100" r="76" stroke="#3b82f6" strokeDasharray={`${published/content.length*477.52} 477.52`} /><circle cx="100" cy="100" r="76" stroke="#a9c6ff" strokeDasharray={`${drafts/content.length*477.52} 477.52`} strokeDashoffset={-published/content.length*477.52} /></>}</svg><div><strong>{content.length ? Math.round(published/content.length*100) : 0}<small>%</small></strong><span>published</span></div></div>
        <div className="dash-content-legend">{[['Published',published,'#3b82f6'],['In draft',drafts,'#a9c6ff'],['Archived / other',archived,'var(--border)']].map(([label,count,color]) => <div key={label}><span><i style={{background: String(color)}} />{label}</span><strong>{count}</strong></div>)}</div>
        <Link href="/admin/projects" className="dash-panel-link">Manage your content <ArrowRight size={15} /></Link>
      </section>
    </div>

    <div className="dash-lower-grid">
      <section className="dash-panel dash-feed"><div className="dash-panel-heading"><div><span className="dash-eyebrow">FRESH FROM YOUR WORKSPACE</span><h2>Recent activity</h2></div><span className="dash-total">{records.length} records</span></div>
        <div className="dash-feed-toolbar"><div className="dash-segment" aria-label="Filter recent activity">{(['all','content','inquiries'] as const).map(f => <button key={f} aria-pressed={filter===f} onClick={() => setFilter(f)}>{f === 'all' ? 'All activity' : f}</button>)}</div><label className="dash-search"><Search size={15} /><input aria-label="Search recent activity" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find something…" /></label></div>
        <div className="dash-feed-labels"><span>Item</span><span>Status / created</span></div>
        <div className="dash-feed-list">{visible.length ? visible.map(r => { const Icon = kinds[r.kind].icon; return <Link key={`${r.kind}-${r.id}`} href={r.href} className="dash-feed-row"><span className={`dash-feed-icon dash-feed-icon-${r.kind}`}><Icon size={18} /></span><div className="dash-feed-title"><strong>{r.title}</strong><span>{r.detail}</span></div><StatusBadge status={r.status} /><time dateTime={r.createdAt}>{dateLabel(r.createdAt)}</time><ChevronRight size={14} /></Link> }) : <div className="dash-empty"><Activity size={25} /><strong>{search ? 'No matching records' : 'A clean slate'}</strong><p>{search ? 'Try a different name or clear your search.' : 'New projects, stories, and conversations will appear here.'}</p>{search && <button onClick={() => setSearch('')}>Clear search</button>}</div>}</div>
      </section>
      <div className="dash-right-column">
        <section className="dash-panel dash-focus"><div className="dash-panel-heading"><div><span className="dash-eyebrow">MAKE SPACE FOR WHAT’S NEXT</span><h2>Your focus list</h2></div><span className="dash-focus-count">{tasks.reduce((s,t)=>s+t.count,0)}</span></div>{tasks.map(t => { const Icon=t.icon; return <Link className="dash-task" href={t.href} key={t.href}><Icon size={17} /><span>{t.label}</span><strong>{t.count}</strong><ChevronRight size={14} /></Link> })}</section>
        <section className="dash-launch"><div className="dash-launch-orbit" aria-hidden="true"><span /><span /><Sparkles size={38} /></div><span className="dash-eyebrow">THE NEXT CHAPTER</span><h2>Ideas belong<br />out in the world.</h2><Link href="/admin/blog/new">Write something new <ArrowUpRight size={17} /></Link></section>
      </div>
    </div>

    <section className="dash-panel dash-pipeline"><div className="dash-panel-heading"><div><span className="dash-eyebrow">OPPORTUNITY BOARD</span><h2>Your freelance pipeline</h2></div><Link href="/admin/leads">View leads <ArrowUpRight size={16} /></Link></div><div className="dash-pipeline-stages">{['new','qualified','meeting','proposal','won','lost'].map((status,index) => { const count = leads.filter(l=>l.status===status).length; return <Link href={`/admin/leads?status=${status}`} key={status}><span><i />{status}</span><strong>{count}</strong><div className="dash-stage-track"><span style={{transform:`scaleX(${leads.length ? count/leads.length : 0})`,opacity:1-index*.1}} /></div></Link> })}</div></section>
    <footer className="dash-footer"><span><Zap size={13} /> Built around your work.</span><span>Statistics reflect saved records · {dateLabel(now)}</span></footer>
  </div>
}

