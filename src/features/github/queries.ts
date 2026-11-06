import 'server-only'
import { unstable_cache } from 'next/cache'
import { GITHUB_USERNAME, toContributionCalendar, toGithubProfile, type GithubSummary } from './map'

// Public GitHub numbers for the /about page, fetched on the server (no CSP
// change, nothing exposed to the browser). Each source is cached for 6 hours
// in the Next data cache, so the unauthenticated GitHub rate limit (60/h) is
// never a concern. Failures are not cached: they throw out of the cached
// function and the next request retries.

const REVALIDATE_SECONDS = 6 * 60 * 60
const TIMEOUT_MS = 4000

async function fetchJson(url: string, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${new URL(url).host} responded ${response.status}`)
  return response.json()
}

const getProfile = unstable_cache(
  async () => {
    const profile = toGithubProfile(
      await fetchJson(`https://api.github.com/users/${GITHUB_USERNAME}`, {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `${GITHUB_USERNAME}-portfolio`,
      }),
    )
    if (!profile) throw new Error('unexpected profile payload')
    return profile
  },
  ['github-profile', GITHUB_USERNAME],
  { revalidate: REVALIDATE_SECONDS },
)

const getContributions = unstable_cache(
  async () => {
    const calendar = toContributionCalendar(
      await fetchJson(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`),
    )
    if (!calendar) throw new Error('unexpected contributions payload')
    return calendar
  },
  ['github-contributions', GITHUB_USERNAME],
  { revalidate: REVALIDATE_SECONDS },
)

async function settle<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`github: loading ${label} failed:`, error instanceof Error ? error.message : error)
    return null
  }
}

/** Profile counts + contribution calendar. Never throws; missing parts are null. */
export async function getGithubSummary(): Promise<GithubSummary> {
  const [profile, contributions] = await Promise.all([
    settle('profile', getProfile),
    settle('contributions', getContributions),
  ])
  return { profile, contributions }
}
