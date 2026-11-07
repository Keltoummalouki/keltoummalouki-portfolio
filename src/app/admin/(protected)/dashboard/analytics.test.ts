import { describe, expect, it } from 'vitest'
import { activityScale, activitySeries, type DashboardRecord } from './analytics'
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
    // 2025 on purpose: Morocco's late-2026 offset depends on the tzdata version bundled with Node.
    const points = activitySeries([record('2025-10-24T23:30:00Z')], 7, '2025-10-25T15:00:00Z')
    expect(points[6].content).toBe(1)
    expect(points[5].content).toBe(0)
  })
})
describe('activity chart scale', () => {
  it('keeps a 0–4 axis for quiet periods', () => {
    expect(activityScale(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
    expect(activityScale(3)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
  })
  it('labels every gridline with its exact value', () => {
    // A peak of 5 used to draw gridlines at 1.25, 2.5… labelled 1, 3, 4.
    expect(activityScale(5)).toEqual({ max: 5, ticks: [0, 1, 2, 3, 4, 5] })
    expect(activityScale(6)).toEqual({ max: 6, ticks: [0, 2, 4, 6] })
    expect(activityScale(11)).toEqual({ max: 15, ticks: [0, 5, 10, 15] })
    expect(activityScale(130)).toEqual({ max: 150, ticks: [0, 50, 100, 150] })
  })
  it('always fits the peak with at most six whole-number ticks', () => {
    for (let peak = 0; peak <= 2000; peak++) {
      const { max, ticks } = activityScale(peak)
      expect(max).toBeGreaterThanOrEqual(peak)
      expect(ticks.length).toBeLessThanOrEqual(6)
      expect(ticks.at(-1)).toBe(max)
      expect(ticks.every(Number.isInteger)).toBe(true)
    }
  })
  it('falls back to the quiet axis for a non-finite peak', () => {
    expect(activityScale(-Infinity)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
  })
})
