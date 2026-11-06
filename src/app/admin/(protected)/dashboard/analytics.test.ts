import { describe, expect, it } from 'vitest'
import { activitySeries, type DashboardRecord } from './analytics'
const record = (createdAt: string, kind: DashboardRecord['kind'] = 'project'): DashboardRecord => ({ id: '1', kind, title: 'Test', detail: '', status: 'draft', createdAt, href: '/' })
describe('dashboard calendar statistics', () => {
  it('includes today and fills missing days with zero', () => {
    const points = activitySeries([record('2026-10-25T10:00:00Z')], 7, '2026-10-25T15:00:00Z')
    expect(points).toHaveLength(7)
    expect(points[0]).toEqual({ date: '2026-10-19', content: 0, inquiries: 0 })
    expect(points[6]).toEqual({ date: '2026-10-25', content: 1, inquiries: 0 })
  })
  it('separates content and inquiries and excludes dates outside the window', () => {
    const points = activitySeries([record('2026-10-25T10:00:00Z', 'article'), record('2026-10-25T10:00:00Z', 'lead'), record('2026-10-25T11:00:00Z', 'message'), record('2026-10-18T10:00:00Z'), record('2026-10-26T10:00:00Z'), record('invalid')], 7, '2026-10-25T15:00:00Z')
    expect(points[6]).toEqual({ date: '2026-10-25', content: 1, inquiries: 2 })
    expect(points.reduce((sum,p)=>sum+p.content+p.inquiries,0)).toBe(3)
  })
  it('uses Casablanca calendar boundaries', () => {
    const points = activitySeries([record('2026-10-24T23:30:00Z')], 7, '2026-10-25T15:00:00Z')
    expect(points[6].content).toBe(1)
    expect(points[5].content).toBe(0)
  })
})
