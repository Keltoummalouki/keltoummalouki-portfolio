import { z } from 'zod'

// Pure, client-safe mapping for the /about "Building in public" card. Raw API
// payloads are validated here so a changed or failed response degrades to
// `null` (the card falls back to a profile link) instead of breaking the page.

export const GITHUB_USERNAME = 'keltoummalouki'

export interface GithubProfile {
  login: string
  name: string
  url: string
  publicRepos: number
  followers: number
  following: number
}

export type ContributionLevel = 0 | 1 | 2 | 3 | 4

export interface ContributionDay {
  /** `YYYY-MM-DD` */
  date: string
  count: number
  level: ContributionLevel
}

export interface ContributionCalendar {
  /** Contributions over the returned period (the last 12 months). */
  total: number
  /** Columns of 7 days, Sunday first. Leading days of the first week are null. */
  weeks: (ContributionDay | null)[][]
}

export interface GithubSummary {
  profile: GithubProfile | null
  contributions: ContributionCalendar | null
}

const count = z.number().int().nonnegative()

const profileSchema = z.object({
  // GitHub logins: alphanumerics and single hyphens, 39 chars max.
  login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
  name: z.string().nullish(),
  public_repos: count,
  followers: count,
  following: count,
})

/** `GET https://api.github.com/users/:login` -> profile, or null when malformed. */
export function toGithubProfile(payload: unknown): GithubProfile | null {
  const parsed = profileSchema.safeParse(payload)
  if (!parsed.success) return null
  const { login, name, public_repos, followers, following } = parsed.data
  return {
    login,
    name: name?.trim() || login,
    // Built from the validated login rather than trusting a URL from the payload.
    url: `https://github.com/${login}`,
    publicRepos: public_repos,
    followers,
    following,
  }
}

const calendarSchema = z.object({
  total: z.record(z.string(), count).optional(),
  contributions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      count,
      level: z.number().int().min(0).max(4),
    }),
  ),
})

/**
 * Contributions payload (`github-contributions-api.jogruber.de/v4/:login?y=last`)
 * -> weekly columns for the heatmap, or null when malformed or empty.
 */
export function toContributionCalendar(payload: unknown): ContributionCalendar | null {
  const parsed = calendarSchema.safeParse(payload)
  if (!parsed.success || parsed.data.contributions.length === 0) return null

  const days: ContributionDay[] = [...parsed.data.contributions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({ date: day.date, count: day.count, level: day.level as ContributionLevel }))

  // Pad the first column so every row lines up with its weekday (0 = Sunday).
  const firstWeekday = new Date(`${days[0].date}T00:00:00Z`).getUTCDay()
  const cells: (ContributionDay | null)[] = [...Array<null>(firstWeekday).fill(null), ...days]
  const weeks: (ContributionDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const summed = days.reduce((sum, day) => sum + day.count, 0)
  return { total: parsed.data.total?.lastYear ?? summed, weeks }
}
