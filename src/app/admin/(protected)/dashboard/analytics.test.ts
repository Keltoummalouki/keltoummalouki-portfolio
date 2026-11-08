import { describe, expect, it } from 'vitest'
import { activityScale, activitySeries, calendarDayLabel, createdWithin, dashboardStats, greeting, smoothPath, weekTrend, weeklyCounts, type DashboardRecord } from './analytics'
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
// 2025 dates on purpose (see the Casablanca test above): the expectations hold
// whether the zone sits at UTC+0 or UTC+1 on those days.
const NOW = '2025-10-25T15:00:00Z'
describe('weekly counts', () => {
  it('buckets the requested kinds by week, newest week last', () => {
    const counts = weeklyCounts([record('2025-10-25T10:00:00Z'), record('2025-10-19T10:00:00Z'), record('2025-10-18T10:00:00Z'), record('2025-10-25T10:00:00Z', 'lead')], ['project'], 2, NOW)
    expect(counts).toEqual([1, 2])
  })
  it('ignores records outside the window, in the future or with invalid dates', () => {
    expect(weeklyCounts([record('2025-10-11T10:00:00Z'), record('2025-10-26T10:00:00Z'), record('invalid')], ['project'], 2, NOW)).toEqual([0, 0])
  })
  it('counts several kinds together', () => {
    expect(weeklyCounts([record('2025-10-25T10:00:00Z', 'message'), record('2025-10-24T10:00:00Z', 'lead')], ['message', 'lead'], 1, NOW)).toEqual([2])
  })
})
describe('recent totals and trends', () => {
  it('counts records created in the last days, today included', () => {
    const records = [record('2025-10-25T10:00:00Z'), record('2025-10-19T10:00:00Z'), record('2025-10-18T10:00:00Z')]
    expect(createdWithin(records, 7, NOW)).toBe(2)
    expect(createdWithin(records, 8, NOW)).toBe(3)
  })
  it('compares this week with the previous one', () => {
    const records = [record('2025-10-25T10:00:00Z'), record('2025-10-24T10:00:00Z', 'lead'), record('2025-10-23T10:00:00Z', 'article'), record('2025-10-15T10:00:00Z', 'message'), record('2025-10-14T10:00:00Z')]
    expect(weekTrend(records, NOW)).toEqual({ current: 3, previous: 2, change: 50 })
  })
  it('has no percentage when the previous week was empty', () => {
    expect(weekTrend([record('2025-10-25T10:00:00Z')], NOW)).toEqual({ current: 1, previous: 0, change: null })
  })
})
describe('greeting', () => {
  it('follows the time of day in Casablanca', () => {
    expect(greeting('2025-10-25T09:00:00Z')).toBe('Good morning')
    expect(greeting('2025-10-25T14:00:00Z')).toBe('Good afternoon')
    expect(greeting('2025-10-25T20:00:00Z')).toBe('Good evening')
    expect(greeting('2025-10-25T02:00:00Z')).toBe('Good evening')
  })
})
describe('smooth chart path', () => {
  const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  it('handles empty, single and two-point series', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([[0, 2]])).toBe('M0,2')
    expect(smoothPath([[0, 2], [1, 4]])).toBe('M0,2L1,4')
  })
  it('draws one cubic segment per interval and ends on the last point', () => {
    const path = smoothPath([[0, 4], [1, 1], [2, 3], [3, 0]])
    expect(path.startsWith('M0,4')).toBe(true)
    expect(path.match(/C/g)).toHaveLength(3)
    expect(path.endsWith(',3,0')).toBe(true)
  })
  it('keeps a flat series perfectly flat', () => {
    const ys = numbers(smoothPath([[0, 3], [1, 3], [2, 3], [3, 3]])).filter((_, i) => i % 2 === 1)
    expect(new Set(ys)).toEqual(new Set([3]))
  })
  it('never overshoots the data range, so zero days stay on the axis', () => {
    const series = [[4, 4, 0, 4, 4, 1, 4], [0, 3, 3, 0, 2, 4, 4, 0], [4, 0, 4, 0, 4], [2, 2, 2, 0, 4, 4]]
    for (const values of series) {
      const ys = numbers(smoothPath(values.map((v, i) => [i, v] as const))).filter((_, i) => i % 2 === 1)
      expect(Math.max(...ys)).toBeLessThanOrEqual(Math.max(...values))
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(Math.min(...values))
    }
  })
})
describe('server-side dashboard stats', () => {
  it('computes every Casablanca-dependent value in one place', () => {
    const stats = dashboardStats([record('2025-10-25T10:00:00Z'), record('2025-10-20T10:00:00Z', 'article'), { ...record('invalid', 'lead'), id: '2' }], NOW)
    expect(Object.keys(stats.activity)).toEqual(['7', '30', '90'])
    expect(stats.activity[90]).toHaveLength(90)
    expect(stats.weekly.project).toHaveLength(8)
    expect(stats.weekly.project.at(-1)).toBe(1)
    expect(stats.lastMonth).toEqual({ project: 1, article: 1, message: 0, lead: 0 })
    expect(stats.labels['project-1']).toEqual({ day: '25 Oct', month: 'Oct 2025' })
    expect(stats.labels['lead-2']).toEqual({ day: '', month: '' })
    expect(stats.today).toBe('Saturday 25 October')
    expect(stats.greeting).toBe('Good afternoon')
    expect(stats.trend).toEqual({ current: 2, previous: 0, change: null })
  })
  it('labels calendar days the same way on every machine', () => {
    expect(calendarDayLabel('2025-10-25')).toBe('25 Oct')
    expect(calendarDayLabel('2026-01-01')).toBe('1 Jan')
  })
})
