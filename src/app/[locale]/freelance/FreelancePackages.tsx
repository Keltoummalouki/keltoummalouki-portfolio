import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FreelancePackage {
  id: string
  title: string
  description: string
  includes: string[]
  /** Formatted "starting from" price; null = quote on request. */
  price: string | null
}

/** Published packages with their starting price. Renders nothing until one is published. */
export default function FreelancePackages({
  title,
  lead,
  fromLabel,
  quoteLabel,
  includesLabel,
  items,
}: {
  title: string
  lead: string
  /** "Starting from" */
  fromLabel: string
  /** "Quote on request" */
  quoteLabel: string
  /** Accessible name of each "what's included" list. */
  includesLabel: string
  items: FreelancePackage[]
}) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="packages-title" className="mb-10">
      <h2 id="packages-title" className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{lead}</p>

      <ul
        className={cn('mt-6 grid gap-4', items.length > 1 && 'sm:grid-cols-2', items.length > 2 && 'lg:grid-cols-3')}
      >
        {items.map((item) => (
          <li key={item.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground text-balance">{item.title}</h3>
            <p className="mt-3">
              {item.price ? (
                <>
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground rtl:tracking-normal">
                    {fromLabel}
                  </span>
                  <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{item.price}</span>
                </>
              ) : (
                <span className="font-semibold text-primary">{quoteLabel}</span>
              )}
            </p>
            {item.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{item.description}</p>
            )}
            {item.includes.length > 0 && (
              <ul aria-label={includesLabel} className="mt-5 space-y-2 border-t border-border pt-5 text-sm text-foreground">
                {item.includes.map((line, index) => (
                  <li key={index} className="flex gap-2">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
