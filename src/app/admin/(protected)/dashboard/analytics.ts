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

/** Calendar-day buckets in the portfolio owner's timezone, including today. */
export function activitySeries(records: DashboardRecord[], days: number, now: string): ActivityPoint[] {
  const dateKey = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date))
  const today = dateKey(now)
  const end = new Date(`${today}T12:00:00Z`)
  const points = Array.from({ length: days }, (_, i) => {
    const day = new Date(end)
    day.setUTCDate(day.getUTCDate() - days + 1 + i)
    return { date: day.toISOString().slice(0, 10), content: 0, inquiries: 0 }
  })
  const lookup = new Map(points.map(p => [p.date, p]))
  for (const record of records) {
    if (!Number.isFinite(Date.parse(record.createdAt)) || Date.parse(record.createdAt) > Date.parse(now)) continue
    const point = lookup.get(dateKey(record.createdAt))
    if (point) point[record.kind === 'project' || record.kind === 'article' ? 'content' : 'inquiries']++
  }
  return points
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
