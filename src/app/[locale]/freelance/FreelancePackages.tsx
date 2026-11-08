import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import PackageCta from './PackageCta'

export interface FreelancePackage {
  id: string
  title: string
  description: string
  includes: string[]
  /** Formatted "starting from" price; null = quote on request. */
  price: string | null
}

/**
 * Published packages with their starting price, each with a way to start from it.
 * Renders nothing until one is published.
 */
export default function FreelancePackages({
  title,
  lead,
  leadQuote,
  fromLabel,
  quoteLabel,
  includesLabel,
  ctaLabel,
  items,
}: {
  title: string
  /** Intro when at least one package shows a price. */
  lead: string
  /** Intro when every package is on request: there are no "starting prices" to speak of. */
  leadQuote: string
  /** "Starting from" */
  fromLabel: string
  /** "Quote on request" */
  quoteLabel: string
  /** Accessible name of each "what's included" list. */
  includesLabel: string
  /** "Start with this package" */
  ctaLabel: string
  items: FreelancePackage[]
}) {
  if (items.length === 0) return null
  const anyPrice = items.some((item) => item.price)
  return (
    <section aria-labelledby="packages-title" className="border-t border-border py-20 md:py-28">
      <div className="container-main">
        <div className="grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-14">
          <h2 id="packages-title" className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
            {anyPrice ? lead : leadQuote}
          </p>
        </div>

        <ul className={cn('mt-12 grid gap-5', items.length > 1 && 'md:grid-cols-2', items.length > 2 && 'lg:grid-cols-3')}>
          {items.map((item) => (
            <li key={item.id} className="bezel flex">
              <div className="bezel-core flex w-full flex-col p-6 sm:p-7">
                <h3 className="text-xl font-bold tracking-tight text-foreground text-balance">{item.title}</h3>
                {item.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{item.description}</p>
                )}
                {item.includes.length > 0 && (
                  <ul aria-label={includesLabel} className="mt-5 space-y-2.5 text-sm text-foreground">
                    {item.includes.map((line, index) => (
                      <li key={index} className="flex gap-2.5">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-text" strokeWidth={2.25} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-7">
                  {item.price ? (
                    <p>
                      <span className="block text-xs font-medium text-muted-foreground">{fromLabel}</span>
                      <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{item.price}</span>
                    </p>
                  ) : (
                    <p className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-xs font-medium text-foreground ring-1 ring-border">
                      {quoteLabel}
                    </p>
                  )}
                  <PackageCta title={item.title} label={ctaLabel} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
