import type { DashboardRecord, RecordKind } from './analytics'

// Pure model behind the dashboard's 3D volumes: one glass volume per record
// type, as tall as its record count (relative to the biggest type), with a
// solid core for the share that is live or waiting on you.

/** Smallest height (share of the tallest) for a type that has records, so it stays visible. */
export const MIN_VOLUME = 0.12

export interface VolumeModel {
  kind: RecordKind
  label: string
  href: string
  /** Accent colour (hex) of the volume, its core and its legend dot. */
  color: string
  total: number
  /** Records in the solid core: published content, unread messages, open leads. */
  lit: number
  /** e.g. "7 published". */
  litLabel: string
  /** e.g. "2 not published". */
  restLabel: string
  /** Height relative to the biggest type, 0…1 (0 = no records yet). */
  height: number
  /** Share of the type's records in the core (lit / total), 0…1. */
  share: number
}

const TYPES: readonly { kind: RecordKind; label: string; href: string; color: string; lights: readonly string[]; word: string; rest: string }[] = [
  { kind: 'project', label: 'Projects', href: '/admin/projects', color: '#3b82f6', lights: ['published'], word: 'published', rest: 'not published' },
  { kind: 'article', label: 'Articles', href: '/admin/blog', color: '#8b5cf6', lights: ['published'], word: 'published', rest: 'not published' },
  { kind: 'message', label: 'Inbox', href: '/admin/inbox', color: '#14b8a6', lights: ['new'], word: 'unread', rest: 'handled' },
  { kind: 'lead', label: 'Leads', href: '/admin/leads', color: '#f59e0b', lights: ['new', 'qualified', 'meeting', 'proposal'], word: 'open', rest: 'closed' },
]

export function buildVolumes(records: readonly DashboardRecord[]): VolumeModel[] {
  const stats = TYPES.map(type => {
    const items = records.filter(record => record.kind === type.kind)
    return { type, total: items.length, lit: items.filter(record => type.lights.includes(record.status)).length }
  })
  const peak = Math.max(0, ...stats.map(stat => stat.total))
  return stats.map(({ type, total, lit }) => ({
    kind: type.kind,
    label: type.label,
    href: type.href,
    color: type.color,
    total,
    lit,
    litLabel: `${lit} ${type.word}`,
    restLabel: `${total - lit} ${type.rest}`,
    height: total > 0 ? Math.max(MIN_VOLUME, total / peak) : 0,
    share: total > 0 ? lit / total : 0,
  }))
}
