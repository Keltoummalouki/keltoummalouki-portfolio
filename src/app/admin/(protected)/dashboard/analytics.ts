export type RecordKind = 'project' | 'article' | 'message' | 'lead'
export interface DashboardRecord {
  id: string
  kind: RecordKind
  title: string
  detail: string
  status: string
  createdAt: string
  href: string
}
export interface ActivityPoint { date: string; content: number; inquiries: number }

/** Every dashboard "day" is a calendar day in the portfolio owner's timezone. */
const TIME_ZONE = 'Africa/Casablanca'
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' })
const longDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' })
const shortDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, month: 'short', year: 'numeric' })
const calendarDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })

export const ALL_KINDS: readonly RecordKind[] = ['project', 'article', 'message', 'lead']
export const isContent = (kind: RecordKind) => kind === 'project' || kind === 'article'

export { formatCount } from '@/lib/format-count'

/**
 * The last `days` calendar days (today included) and a lookup from a record's
 * creation date to its day index; invalid and future dates fall outside (-1).
 */
function calendarWindow(days: number, now: string) {
  const end = new Date(`${dayFormat.format(new Date(now))}T12:00:00Z`)
  const dates = Array.from({ length: days }, (_, i) => {
    const day = new Date(end)
    day.setUTCDate(day.getUTCDate() - days + 1 + i)
    return day.toISOString().slice(0, 10)
  })
  const lookup = new Map(dates.map((date, i) => [date, i]))
  const nowMs = Date.parse(now)
  const indexOf = (createdAt: string) => {
    const ms = Date.parse(createdAt)
    if (!Number.isFinite(ms) || ms > nowMs) return -1
    return lookup.get(dayFormat.format(new Date(ms))) ?? -1
  }
  return { dates, indexOf }
}

/** Calendar-day buckets in the portfolio owner's timezone, including today. */
export function activitySeries(records: DashboardRecord[], days: number, now: string): ActivityPoint[] {
  const { dates, indexOf } = calendarWindow(days, now)
  const points = dates.map(date => ({ date, content: 0, inquiries: 0 }))
  for (const record of records) {
    const i = indexOf(record.createdAt)
    if (i >= 0) points[i][isContent(record.kind) ? 'content' : 'inquiries']++
  }
  return points
}

/**
 * Records of the given kinds created per 7-day bucket, oldest first; the last
 * bucket ends today. Feeds the sparklines on the dashboard's total cards.
 */
export function weeklyCounts(records: DashboardRecord[], kinds: readonly RecordKind[], weeks: number, now: string): number[] {
  const { indexOf } = calendarWindow(weeks * 7, now)
  const counts = Array<number>(weeks).fill(0)
  for (const record of records) {
    if (!kinds.includes(record.kind)) continue
    const i = indexOf(record.createdAt)
    if (i >= 0) counts[Math.floor(i / 7)]++
  }
  return counts
}

/** How many of the records were created in the last `days` calendar days, today included. */
export function createdWithin(records: DashboardRecord[], days: number, now: string): number {
  const { indexOf } = calendarWindow(days, now)
  return records.reduce((sum, record) => sum + (indexOf(record.createdAt) >= 0 ? 1 : 0), 0)
}

export interface WeekTrend { current: number; previous: number; change: number | null }

/**
 * New records in the last 7 days against the 7 days before. `change` is a
 * whole percentage, or null when the previous week had nothing to compare to.
 */
export function weekTrend(records: DashboardRecord[], now: string): WeekTrend {
  const [previous, current] = weeklyCounts(records, ALL_KINDS, 2, now)
  return { current, previous, change: previous ? Math.round(((current - previous) / previous) * 100) : null }
}

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening'

/** Time-of-day greeting in the owner's timezone. */
export function greeting(now: string): Greeting {
  const hour = Number(hourFormat.format(new Date(now)))
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Y axis for the activity chart: whole-number ticks from 0 in steps of 1, 2 or
 * 5 (×10ⁿ), at most five intervals and never less than 0–4, so every label sits
 * exactly on its gridline (rounding fractional ticks used to mislabel them).
 */
export function activityScale(peak: number): { max: number; ticks: number[] } {
  const top = Math.max(4, Math.ceil(Number.isFinite(peak) ? peak : 0))
  let step = 1
  for (let i = 1; Math.ceil(top / step) > 5; i++) step = [1, 2, 5][i % 3] * 10 ** Math.floor(i / 3)
  const max = Math.ceil(top / step) * step
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) }
}

export const ACTIVITY_RANGES = [7, 30, 90] as const
export type ActivityRange = (typeof ACTIVITY_RANGES)[number]

export interface DashboardStats {
  /** e.g. "Saturday 7 November". */
  today: string
  greeting: Greeting
  /** Daily buckets for each range of the activity chart. */
  activity: Record<ActivityRange, ActivityPoint[]>
  trend: WeekTrend
  /** Records created per week over the last 8 weeks, by type (sparklines). */
  weekly: Record<RecordKind, number[]>
  /** Records created in the last 30 days, by type. */
  lastMonth: Record<RecordKind, number>
  /** Creation day ("7 Nov") and month ("Nov 2026") of each record, by recordKey(). */
  labels: Record<string, { day: string; month: string }>
}

export const recordKey = (record: Pick<DashboardRecord, 'kind' | 'id'>) => `${record.kind}-${record.id}`

/** "7 Nov" for a YYYY-MM-DD date that already is a Casablanca calendar day; identical on every machine. */
export const calendarDayLabel = (date: string) => calendarDayFormat.format(new Date(`${date}T12:00:00Z`))

/**
 * Everything on the dashboard that depends on the Casablanca calendar,
 * computed once on the server and passed to the client. Browsers can ship
 * other time-zone data than Node (Morocco's offset rules keep changing), so
 * formatting these on both sides can disagree near midnight and break
 * hydration.
 */
export function dashboardStats(records: DashboardRecord[], now: string): DashboardStats {
  const byKind = <T>(value: (kind: RecordKind) => T) => Object.fromEntries(ALL_KINDS.map(kind => [kind, value(kind)])) as Record<RecordKind, T>
  const labels: DashboardStats['labels'] = {}
  for (const record of records) {
    const ms = Date.parse(record.createdAt)
    labels[recordKey(record)] = Number.isFinite(ms) ? { day: shortDayFormat.format(ms), month: monthFormat.format(ms) } : { day: '', month: '' }
  }
  return {
    today: longDayFormat.format(new Date(now)),
    greeting: greeting(now),
    activity: Object.fromEntries(ACTIVITY_RANGES.map(days => [days, activitySeries(records, days, now)])) as Record<ActivityRange, ActivityPoint[]>,
    trend: weekTrend(records, now),
    weekly: byKind(kind => weeklyCounts(records, [kind], 8, now)),
    lastMonth: byKind(kind => createdWithin(records.filter(record => record.kind === kind), 30, now)),
    labels,
  }
}

type Point = readonly [x: number, y: number]
const coord = (n: number) => String(Math.round(n * 1000) / 1000)

/**
 * SVG path through the points (x ascending) with monotone cubic interpolation,
 * the same curve as d3's curveMonotoneX: smooth, but it never overshoots, so a
 * quiet day never dips below the chart's axis.
 */
export function smoothPath(points: readonly Point[]): string {
  const n = points.length
  if (n === 0) return ''
  const start = `M${coord(points[0][0])},${coord(points[0][1])}`
  if (n === 1) return start
  if (n === 2) return `${start}L${coord(points[1][0])},${coord(points[1][1])}`

  const sign = (v: number) => (v < 0 ? -1 : 1)
  const tangents = Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const h0 = points[i][0] - points[i - 1][0]
    const h1 = points[i + 1][0] - points[i][0]
    const s0 = (points[i][1] - points[i - 1][1]) / h0
    const s1 = (points[i + 1][1] - points[i][1]) / h1
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    tangents[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  const endTangent = (a: number, b: number, inner: number) => {
    const h = points[b][0] - points[a][0]
    return h ? ((3 * (points[b][1] - points[a][1])) / h - inner) / 2 : inner
  }
  tangents[0] = endTangent(0, 1, tangents[1])
  tangents[n - 1] = endTangent(n - 2, n - 1, tangents[n - 2])

  let d = start
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = points[i]
    const [xb, yb] = points[i + 1]
    const third = (xb - xa) / 3
    d += `C${coord(xa + third)},${coord(ya + tangents[i] * third)},${coord(xb - third)},${coord(yb - tangents[i + 1] * third)},${coord(xb)},${coord(yb)}`
  }
  return d
}
