import type { ReactNode } from 'react'
import { ArrowUpRight, ChevronDown, Layers3, CheckCircle2, PenLine, Archive } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from './ui'

export function CollectionOverview({ items, label = 'entries' }: { items: { status: string | null }[]; label?: string }) {
  const published = items.filter(item => item.status === 'published').length
  return <OverviewMetrics items={[
    { label: `Total ${label}`, value: items.length, hint: 'Your collection', icon: <Layers3 size={18} /> },
    { label: 'Published', value: published, hint: items.length ? `${Math.round(published/items.length*100)}% of your collection` : 'Ready when you are', icon: <CheckCircle2 size={18} /> },
    { label: 'In draft', value: items.filter(item => item.status === 'draft').length, hint: 'Room for your next idea', icon: <PenLine size={18} /> },
    { label: 'Archived', value: items.filter(item => item.status === 'archived').length, hint: 'Kept off the public site', icon: <Archive size={18} /> },
  ]} />
}
export function OverviewMetrics({ items }: { items: { label: string; value: number | string; hint: string; icon?: ReactNode; href?: string }[] }) {
  return <section className="admin-overview" aria-label="Collection statistics">{items.map((item,index) => {
    const content = <><div className="admin-overview-label"><span>{item.label}</span>{item.icon || <Layers3 size={18} aria-hidden="true" />}</div><strong>{item.value}</strong><p>{item.hint}</p>{item.href && <ArrowUpRight size={14} className="admin-overview-arrow" aria-hidden="true" />}</>
    return item.href ? <Link className={index === 0 ? 'admin-overview-featured' : ''} key={item.label} href={item.href}>{content}</Link> : <div className={index === 0 ? 'admin-overview-featured' : ''} key={item.label}>{content}</div>
  })}</section>
}
export function EditorDisclosure({ title, subtitle, status, children }: { title: string; subtitle?: string; status?: string | null; children: ReactNode }) {
  return <details className="admin-editor-disclosure"><summary><span className="admin-entry-mark"><PenLine size={17} aria-hidden="true" /></span><span className="admin-entry-title"><strong>{title || 'Untitled entry'}</strong><small>{subtitle || 'Open to edit details and translations'}</small></span>{status && <StatusBadge status={status} />}<ChevronDown size={17} className="admin-disclosure-chevron" aria-hidden="true" /></summary><div className="admin-editor-body">{children}</div></details>
}
export function EditorGuide({ items }: { items: { href: string; label: string; detail: string }[] }) {
  return <nav className="admin-editor-guide" aria-label="Jump to section">{items.map((item,index)=><a key={item.href} href={item.href}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><ArrowUpRight size={16} aria-hidden="true" /></a>)}</nav>
}
