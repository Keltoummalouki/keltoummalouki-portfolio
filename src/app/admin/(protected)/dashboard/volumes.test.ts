import { describe, expect, it } from 'vitest'
import type { DashboardRecord } from './analytics'
import { MIN_VOLUME, buildVolumes } from './volumes'

let id = 0
const record = (kind: DashboardRecord['kind'], status: string): DashboardRecord => ({ id: String(++id), kind, title: 'Test', detail: '', status, createdAt: '2025-10-25T10:00:00Z', href: '/' })
const many = (count: number, kind: DashboardRecord['kind'], status: string) => Array.from({ length: count }, () => record(kind, status))

describe('dashboard volumes', () => {
  it('sizes each type against the biggest one', () => {
    const volumes = buildVolumes([...many(8, 'project', 'published'), ...many(4, 'article', 'draft'), ...many(2, 'message', 'new')])
    expect(volumes.map(v => [v.kind, v.total, v.height])).toEqual([['project', 8, 1], ['article', 4, 0.5], ['message', 2, 0.25], ['lead', 0, 0]])
  })
  it('keeps a small type visible', () => {
    const [projects, articles] = buildVolumes([...many(40, 'project', 'draft'), record('article', 'draft')])
    expect(projects.height).toBe(1)
    expect(articles.height).toBe(MIN_VOLUME)
  })
  it('fills the core with what is live or waiting', () => {
    const volumes = buildVolumes([
      record('project', 'published'), record('project', 'draft'), record('project', 'archived'), record('project', 'published'),
      record('message', 'new'), record('message', 'replied'), record('lead', 'proposal'), record('lead', 'won'),
    ])
    expect(volumes.map(v => [v.lit, v.share])).toEqual([[2, 0.5], [0, 0], [1, 0.5], [1, 0.5]])
    expect(volumes.map(v => `${v.litLabel} · ${v.restLabel}`)).toEqual([
      '2 published · 2 not published', '0 published · 0 not published', '1 unread · 1 handled', '1 open · 1 closed',
    ])
  })
  it('has empty volumes when nothing exists yet', () => {
    expect(buildVolumes([]).every(v => v.total === 0 && v.height === 0 && v.share === 0)).toBe(true)
  })
})
