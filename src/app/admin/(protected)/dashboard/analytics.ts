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
