import { ExternalLink, Github } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import {
  GITHUB_USERNAME,
  type ContributionCalendar,
  type ContributionLevel,
  type GithubSummary,
} from '@/features/github'
import { cn } from '@/lib/utils'
import ProfileSection, { cardClass } from './ProfileSection'

const STAT_KEYS = ['contributions', 'repositories', 'followers', 'following'] as const

const LEVEL_FILL: Record<ContributionLevel, string> = {
  0: 'fill-foreground/[0.07]',
  1: 'fill-primary/35',
  2: 'fill-primary/60',
  3: 'fill-primary/85',
  4: 'fill-violet-500',
}

/**
 * Public GitHub activity ("Building in public"): profile counts and the
 * contribution heatmap of the last 12 months. `pending` is the Suspense
 * fallback: the same layout with placeholders, so nothing shifts on arrival.
 */
export default async function AboutGithub({
  locale,
  summary,
  pending = false,
}: {
  locale: string
  /** null while streaming (`pending`) or when nothing could be loaded. */
  summary: GithubSummary | null
  pending?: boolean
}) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'github' }),
    getFormatter({ locale }),
  ])

  const profile = summary?.profile ?? null
  const calendar = summary?.contributions ?? null
  const profileUrl = profile?.url ?? `https://github.com/${GITHUB_USERNAME}`
  const values: Record<(typeof STAT_KEYS)[number], number | undefined> = {
    contributions: calendar?.total,
    repositories: profile?.publicRepos,
    followers: profile?.followers,
    following: profile?.following,
  }
  const stats = STAT_KEYS.filter((key) => pending || values[key] !== undefined)
  const unavailable = !pending && stats.length === 0

  return (
    <ProfileSection id="github" title={t('heading')} lead={t('subtitle')}>
      <article aria-busy={pending || undefined} className={cn(cardClass, '@container p-5 md:p-6')}>
        <header className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Github aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-foreground">{profile?.name ?? 'GitHub'}</h3>
            <p className="truncate text-sm text-muted-foreground" dir="ltr">
              @{profile?.login ?? GITHUB_USERNAME}
            </p>
          </div>
        </header>

        {unavailable ? (
          <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            {t('unavailable')}
          </p>
        ) : (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-3 @lg:grid-cols-4">
              {stats.map((key) => {
                const value = values[key]
                return (
                  <div key={key} className="flex flex-col-reverse rounded-xl border border-border bg-background/60 p-4">
                    <dt className="text-sm text-muted-foreground">{t(`stats.${key}`)}</dt>
                    <dd className="text-2xl font-bold tabular-nums text-foreground">
                      {value === undefined ? (
                        <span aria-hidden="true" className="my-1 block h-6 w-14 animate-pulse rounded bg-foreground/10" />
                      ) : (
                        format.number(value)
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>

            {pending ? (
              <div aria-hidden="true" className="mt-5 aspect-[634/82] animate-pulse rounded-lg bg-foreground/[0.06]" />
            ) : (
              calendar && (
                <figure className="mt-5">
                  <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t('heatmapTitle')}</span>
                    <HeatmapLegend less={t('less')} more={t('more')} />
                  </figcaption>
                  <Heatmap
                    calendar={calendar}
                    label={t('heatmapLabel', { count: calendar.total, total: format.number(calendar.total) })}
                  />
                </figure>
              )
            )}
          </>
        )}

        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('viewProfile')}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </article>
    </ProfileSection>
  )
}

const CELL = 10
const STEP = 12

function Heatmap({ calendar, label }: { calendar: ContributionCalendar; label: string }) {
  const width = calendar.weeks.length * STEP - (STEP - CELL)
  const height = 7 * STEP - (STEP - CELL)
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
      {calendar.weeks.map((week, x) => (
        <g key={x}>
          {week.map((day, y) =>
            day ? (
              <rect key={day.date} x={x * STEP} y={y * STEP} width={CELL} height={CELL} rx={2} className={LEVEL_FILL[day.level]} />
            ) : null,
          )}
        </g>
      ))}
    </svg>
  )
}

function HeatmapLegend({ less, more }: { less: string; more: string }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1.5">
      {less}
      <svg viewBox={`0 0 ${5 * STEP - 2} ${CELL}`} className="h-2.5 w-auto">
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <rect key={level} x={level * STEP} y={0} width={CELL} height={CELL} rx={2} className={LEVEL_FILL[level]} />
        ))}
      </svg>
      {more}
    </span>
  )
}
