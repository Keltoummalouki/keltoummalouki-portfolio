import Image from 'next/image'
import { Caveat } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import { CalendarDays, Code2, FolderOpen, Github, Layers, type LucideIcon } from 'lucide-react'
import { isOptimizableImageSrc } from '@/lib/images'
import { cn } from '@/lib/utils'
import { statValue, type PortfolioStatKey } from '@/features/stats/portfolio'
import { composeProfileSummary, type ProfileFacts } from '@/features/seo/profile-summary'

// Server component on purpose: the definitional paragraph and stats must be in
// the initial HTML (no client-side animation gating their
// visibility), so search engines and AI crawlers read exactly what visitors see.
// The portrait transfer progressively enhances this markup on the client.

/** Handwritten annotations (decorative, xl+ only): fetched on demand, never preloaded. */
const hand = Caveat({ subsets: ['latin'], weight: '500', display: 'swap', preload: false })

const STATS: { key: PortfolioStatKey; icon: LucideIcon }[] = [
  { key: 'projects', icon: FolderOpen },
  { key: 'experience', icon: CalendarDays },
  { key: 'technologies', icon: Layers },
  { key: 'commits', icon: Github },
]

/** Trait chips, each with its own accent dot. */
const TRAITS = [
  { key: 'creative', dot: 'bg-violet-400' },
  { key: 'problemSolver', dot: 'bg-sky-400' },
  { key: 'teamPlayer', dot: 'bg-amber-400' },
  { key: 'dedicated', dot: 'bg-rose-400' },
] as const

export default async function ProfileSummarySection({
  locale,
  facts,
  avatarUrl,
}: {
  locale: string
  facts: ProfileFacts
  avatarUrl: string
}) {
  const [t, about] = await Promise.all([
    getTranslations({ locale, namespace: 'home.profile' }),
    getTranslations({ locale, namespace: 'about' }),
  ])
  const summary = composeProfileSummary(facts, (key, values) => t(key, values), locale)

  return (
    <section id="profile" aria-labelledby="profile-title" className="relative overflow-hidden bg-background py-20 md:py-28">
      {/* Backdrop: one glow behind the portrait + a faint dot field. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -start-40 top-1/4 size-[36rem] rounded-full bg-[radial-gradient(closest-side,var(--glow-color),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-size-[22px_22px] opacity-40 [mask-image:radial-gradient(60%_60%_at_25%_45%,black,transparent)]" />
      </div>

      <div className="relative container-main">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 xl:gap-20">
          <Portrait
            src={avatarUrl}
            note={t('note')}
            className="order-first"
          />

          <div className="min-w-0">
            {/* Text + (xl) a narrow column of handwritten notes beside it. */}
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_10.5rem] xl:gap-10">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-text rtl:tracking-normal">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                  {t('eyebrow')}
                </p>

                {/* `font-serif!`: the theme's heading font is injected unlayered (DesignSettingsStyle) and would win otherwise. */}
                <h2
                  id="profile-title"
                  className="mt-6 text-4xl font-medium leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl ltr:font-serif! ltr:font-normal"
                >
                  {t('tagline.lead')}{' '}
                  <span className="block bg-linear-to-r from-primary via-indigo-600 to-violet-600 bg-clip-text pb-1 text-transparent rtl:bg-linear-to-l dark:from-sky-300 dark:via-primary-text dark:to-violet-400">
                    {t('tagline.accent')}
                  </span>
                </h2>

                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
                  {summary.paragraph}
                </p>

                <ul aria-label={t('traitsLabel')} className="mt-7 flex flex-wrap gap-2.5">
                  {TRAITS.map((trait) => (
                    <li
                      key={trait.key}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-sm font-medium text-foreground backdrop-blur"
                    >
                      <span aria-hidden="true" className={cn('size-1.5 rounded-full', trait.dot)} />
                      {about(`qualities.${trait.key}`)}
                    </li>
                  ))}
                </ul>
              </div>

              <Annotations role={facts.role} note={t('notes.cleanCode')} />
            </div>

            <dl
              aria-label={t('statsLabel')}
              className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-xl shadow-primary/5 sm:grid-cols-4"
            >
              {STATS.map(({ key, icon: Icon }) => (
                <div key={key} className="flex flex-col-reverse items-center gap-1 bg-card px-3 py-5 text-center md:py-6">
                  <dt className="text-xs font-medium text-muted-foreground md:text-sm">{about(`stats.${key}`)}</dt>
                  <dd className="flex flex-col items-center gap-3">
                    <Icon aria-hidden="true" className="size-5 text-primary-text" strokeWidth={1.75} />
                    <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground md:text-3xl">
                      {statValue(key)}+
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Portrait in a studio arch, circled by an orbit line, with a code badge and a floating note. */
function Portrait({ src, note, className }: { src: string; note: string; className?: string }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[19rem] sm:max-w-sm lg:max-w-none', className)}>
      {/* Orbit ring behind the arch. */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-[14%] top-[34%] h-[52%] -rotate-12 rounded-[50%] border border-primary/30 shadow-[0_0_40px_-12px_var(--glow-color)]"
      />

      {/* The arch fades out at the bottom so the cropped portrait melts into the page. */}
      <div data-portrait-destination className="relative aspect-[4/5] overflow-hidden rounded-t-full bg-[var(--portrait-backdrop)] [mask-image:linear-gradient(to_bottom,black_72%,transparent)]">
        <Image
          src={src}
          // Decorative here: the hero already shows (and names) the same portrait.
          alt=""
          fill
          sizes="(min-width: 1280px) 440px, (min-width: 1024px) 38vw, (min-width: 640px) 384px, 304px"
          unoptimized={!isOptimizableImageSrc(src)}
          className="object-cover"
        />
      </div>

      <span
        aria-hidden="true"
        data-portrait-detail className="absolute -end-3 top-[46%] flex size-14 items-center justify-center rounded-full border border-border bg-card/80 text-primary-text shadow-lg shadow-primary/20 backdrop-blur-xl sm:-end-5"
      >
        <Code2 className="size-6" strokeWidth={1.75} />
      </span>

      <p data-portrait-detail className="absolute -start-2 top-8 max-w-[12.5rem] rounded-2xl border border-border bg-card/80 p-4 text-sm leading-snug text-foreground shadow-xl shadow-black/10 backdrop-blur-xl sm:-start-8">
        <span aria-hidden="true" className="mb-2 block size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
        {note}
      </p>
    </div>
  )
}

/** Handwritten role note with an arrow + a tilted "tablet" with code (xl+, decorative). */
function Annotations({ role, note }: { role: string; note: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none hidden select-none pt-6 xl:block">
      <div className={cn(hand.className, 'flex items-start gap-1 text-[1.35rem] leading-none text-primary-text/85')}>
        <svg viewBox="0 0 48 32" fill="none" className="mt-3 h-7 w-11 shrink-0 rtl:-scale-x-100">
          <path d="M2 28 C 10 12, 24 6, 44 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M38 3 L 44 8 L 37 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="-rotate-6 lowercase">{role}</span>
      </div>

      <div className="float ms-6 mt-8 w-32 rotate-6 rounded-[1.25rem] border border-border bg-secondary p-1.5 shadow-2xl shadow-primary/25">
        <div className="aspect-[3/4] rounded-[0.9rem] bg-background p-3">
          <div className="flex gap-1">
            <span className="size-1.5 rounded-full bg-rose-400/80" />
            <span className="size-1.5 rounded-full bg-amber-400/80" />
            <span className="size-1.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="mt-3 space-y-1.5">
            {CODE_LINES.map((line, i) => (
              <span key={i} className={cn('block h-1 rounded-full', line)} />
            ))}
          </div>
        </div>
      </div>

      <p className={cn(hand.className, 'mt-5 -rotate-6 text-end text-lg leading-tight text-muted-foreground')}>{note}</p>
    </div>
  )
}

const CODE_LINES = [
  'w-3/5 bg-violet-400/70',
  'ms-2 w-4/5 bg-primary/70',
  'ms-2 w-2/5 bg-sky-300/60',
  'ms-4 w-3/5 bg-emerald-400/60',
  'ms-4 w-1/2 bg-primary/50',
  'ms-2 w-2/3 bg-amber-300/60',
  'w-1/3 bg-violet-400/60',
  'w-3/4 bg-foreground/15',
  'ms-2 w-1/2 bg-foreground/10',
]
