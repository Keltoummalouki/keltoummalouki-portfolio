import { ChevronDown, MessageCircleQuestion } from 'lucide-react'
import type { PublicFaqItem } from '@/features/cms/faq'
import { Link } from '@/i18n/navigation'
import { trackClick } from '@/lib/analytics/events'

/**
 * Popular client questions as native disclosures (first one open): no client
 * JS, keyboard and screen-reader support built in, and every answer is in the
 * HTML that the FAQPage JSON-LD is built from.
 */
export default function FreelanceFaq({
  title,
  lead,
  more,
  moreCta,
  items,
}: {
  title: string
  lead: string
  /** "Another question?" */
  more: string
  /** "Write to me": links to the contact form on the home page. */
  moreCta: string
  items: PublicFaqItem[]
}) {
  if (items.length === 0) return null
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mt-10 scroll-mt-24 rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <h2 id="faq-title" className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{lead}</p>

      <div className="mt-6 divide-y divide-border border-y border-border">
        {items.map((item, index) => (
          <details key={item.id} open={index === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-medium text-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                aria-hidden="true"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors duration-200 group-open:bg-primary/15 group-open:text-primary"
              >
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
              </span>
            </summary>
            <p className="pb-4 pe-12 text-sm leading-relaxed text-muted-foreground text-pretty">{item.answer}</p>
          </details>
        ))}
      </div>

      <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <MessageCircleQuestion aria-hidden="true" className="size-4 text-primary" />
        {more}
        <Link
          href={{ pathname: '/', hash: 'contact' }}
          className="rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...trackClick('contact-cta', { from: 'faq' })}
        >
          {moreCta}
        </Link>
      </p>
    </section>
  )
}
