import Image from 'next/image'
import { Caveat } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  CalendarDays,
  Code2,
  FolderOpen,
  Github,
  Layers,
  Puzzle,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { isOptimizableImageSrc } from '@/lib/images'
import { cn } from '@/lib/utils'
import { statValue, type PortfolioStatKey } from '@/features/stats/portfolio'
import type { ProfileFacts } from '@/features/seo/profile-summary'

// Server component on purpose: the bio and stats must be in the initial HTML
// (no client-side animation gating their visibility), so search engines and AI
// crawlers read exactly what visitors see. The portrait transfer progressively
// enhances this markup on the client.

/** Handwritten annotations (decorative, xl+ only): fetched on demand, never preloaded. */
const hand = Caveat({ subsets: ['latin'], weight: '500', display: 'swap', preload: false })

const STATS: { key: PortfolioStatKey; icon: LucideIcon }[] = [
  { key: 'projects', icon: FolderOpen },
  { key: 'experience', icon: CalendarDays },
  { key: 'technologies', icon: Layers },
  { key: 'commits', icon: Github },
]

type Trait = { key: string; icon: LucideIcon; move: string }

/**
 * Trait chips: an icon in a tinted well, and each icon has its own small move
 * when its chip is hovered. Whole class strings, so Tailwind can find them.
 */
const TRAITS = [
  { key: 'creative', icon: Sparkles, move: 'group-hover:rotate-12 group-hover:scale-110' },
  { key: 'problemSolver', icon: Puzzle, move: 'group-hover:-rotate-12' },
  { key: 'teamPlayer', icon: Users, move: 'group-hover:-translate-y-0.5' },
  { key: 'dedicated', icon: Target, move: 'group-hover:scale-110' },
] as const satisfies readonly Trait[]

export default async function ProfileSummarySection({
  locale,
  facts,
  bio,
  avatarUrl,
}: {
  locale: string
  facts: ProfileFacts
  /** The dashboard bio (About › Headline & bio), already resolved for this locale. */
  bio?: string
  avatarUrl: string
}) {
  const [t, about] = await Promise.all([
    getTranslations({ locale, namespace: 'home.profile' }),
    getTranslations({ locale, namespace: 'about' }),
  ])
  // The admin form pre-fills an empty bio with this same message
  // (ABOUT_FALLBACK.bio), so the site shows what the dashboard shows.
  const intro = bio?.trim() || about('description')

  return (
    <section id="profile" aria-labelledby="profile-title" className="relative overflow-hidden bg-background py-20 md:py-28">
      <div className="relative container-main">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 xl:gap-20">
          <Portrait
            src={avatarUrl}
            name={facts.name}
            note={t('note')}
            className="order-first"
          />

          <div className="min-w-0">
            {/* Text + (xl) a narrow column of handwritten notes beside it. */}
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_10.5rem] xl:gap-10">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-text rtl:tracking-normal">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                  {t('eyebrow')}
                </p>

                {/* `font-serif!`: the theme's heading font is injected unlayered (DesignSettingsStyle) and would win otherwise. */}
                <h2
                  id="profile-title"
                  className="mt-6 text-4xl font-medium leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl ltr:font-serif! ltr:font-normal"
                >
                  {t('tagline.lead')}{' '}
                  <span className="block pb-1 text-primary">
                    {t('tagline.accent')}
                  </span>
                </h2>

                {/* Line breaks typed in the dashboard are kept, as on /about. */}
                <p className="mt-6 max-w-xl whitespace-pre-line text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
                  {intro}
                </p>

                <Link
                  href="/about"
                  className="group mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
                >
                  {t('more')}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 ease-fluid group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </Link>
              </div>

              <Annotations role={facts.role} note={t('notes.cleanCode')} />
            </div>

            {/* Below the notes column, so the four chips share one row on wide screens.
                The narrow two-column range (lg) gets an even 2×2 instead of wrapping 3+1. */}
            <ul aria-label={t('traitsLabel')} className="mt-6 flex flex-wrap gap-2.5 lg:grid lg:grid-cols-2 xl:flex">
              {TRAITS.map(({ key, icon: Icon, move }) => (
                <li
                  key={key}
                  className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-card/70 py-1 ps-1 pe-4 text-sm font-medium text-foreground backdrop-blur transition-colors duration-200 hover:border-primary/50"
                >
                  <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text">
                    <Icon className={cn('size-3.5 transition-transform duration-300 ease-fluid', move)} strokeWidth={2} />
                  </span>
                  {about(`qualities.${key}`)}
                </li>
              ))}
            </ul>

            <dl
              aria-label={t('statsLabel')}
              className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4"
            >
              {STATS.map(({ key, icon: Icon }) => (
                // justify-end (top, in a reversed column): a label wrapping to two lines must not lift its number above the others.
                <div key={key} className="flex flex-col-reverse items-center justify-end gap-1 bg-card px-3 py-5 text-center md:py-6">
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
function Portrait({ src, name, note, className }: { src: string; name: string; note: string; className?: string }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[19rem] sm:max-w-sm lg:max-w-none', className)}>
      {/* Orbit ring behind the arch. */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-[14%] top-[34%] h-[52%] -rotate-12 rounded-[50%] border border-primary/30"
      />

      <div data-portrait-destination className="relative aspect-[4/5] overflow-hidden rounded-t-full bg-[var(--portrait-backdrop)]">
        <Image
          src={src}
          // `alt` names the photo for crawlers (Bing flags empty ones), while
          // aria-hidden keeps screen readers from repeating the hero portrait.
          alt={name}
          aria-hidden="true"
          fill
          sizes="(min-width: 1280px) 440px, (min-width: 1024px) 38vw, (min-width: 640px) 384px, 304px"
          unoptimized={!isOptimizableImageSrc(src)}
          className="object-cover"
        />
      </div>

      <span
        aria-hidden="true"
        data-portrait-detail className="absolute -end-3 top-[46%] flex size-14 items-center justify-center rounded-full border border-border bg-card/80 text-primary-text backdrop-blur-xl sm:-end-5"
      >
        <Code2 className="size-6" strokeWidth={1.75} />
      </span>

      <p data-portrait-detail className="absolute -start-2 top-8 max-w-[12.5rem] rounded-2xl border border-border bg-card/80 p-4 text-sm leading-snug text-foreground shadow-xl shadow-black/10 backdrop-blur-xl sm:-start-8">
        <span aria-hidden="true" className="mb-2 block size-1.5 rounded-full bg-primary" />
        {note}
      </p>
    </div>
  )
}

/** Handwritten role note with an arrow, a small code window, and a handwritten motto (xl+, decorative). */
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

      <CodeWindow />

      <p className={cn(hand.className, 'mt-5 -rotate-6 text-end text-lg leading-tight text-muted-foreground')}>{note}</p>
    </div>
  )
}

const TONE = {
  keyword: 'text-primary-text',
  name: 'text-foreground',
  call: 'text-primary-text',
  plain: 'text-muted-foreground',
} as const

/** The tagline as code: an idea, designed, built and shipped, becomes a product. */
const CODE: (readonly [text: string, tone: keyof typeof TONE])[][] = [
  [['const', 'keyword'], [' ', 'plain'], ['product', 'name'], [' = ', 'plain'], ['idea', 'name']],
  [['  .', 'plain'], ['design', 'call'], ['()', 'plain']],
  [['  .', 'plain'], ['build', 'call'], ['()', 'plain']],
  [['  .', 'plain'], ['ship', 'call'], ['()', 'plain']],
]

/**
 * A tilted editor window with a blinking caret; hovering it straightens it up.
 * Code reads left to right on every locale, so the card is `dir="ltr"` and uses
 * physical margins: `next dev` compiles logical ones to `:lang(ar)` rules, which
 * follow the page language and ignore `dir` (production CSS keeps them logical).
 */
function CodeWindow() {
  return (
    <div className="float mt-8 ms-2">
      <div
        dir="ltr"
        className="pointer-events-auto w-40 rotate-3 overflow-hidden rounded-xl border border-border bg-card/90 shadow-2xl shadow-black/20 backdrop-blur-xl transition-[rotate,translate] duration-500 ease-fluid hover:-translate-y-1 hover:rotate-0"
      >
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          <span className="ml-auto font-mono text-[9px] text-muted-foreground">idea.ts</span>
        </div>
        <div className="px-3 py-2.5 text-left font-mono text-[10px] leading-[1.8]">
          {CODE.map((tokens, line) => (
            <div key={line} className="flex items-center whitespace-pre">
              <span className="mr-2.5 w-2 shrink-0 text-right text-muted-foreground/50">{line + 1}</span>
              {tokens.map(([text, tone], i) => (
                <span key={i} className={TONE[tone]}>
                  {text}
                </span>
              ))}
              {line === CODE.length - 1 && (
                <span className="ml-0.5 h-[1.15em] w-[0.5em] bg-primary/75 motion-safe:animate-caret-blink" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
