import { ArrowUp, ChevronDown, MessageCircleQuestion } from 'lucide-react'
import { pillOutline } from '@/components/sections/showcase/classes'
import type { PublicFaqItem } from '@/features/cms/faq'
import { Link } from '@/i18n/navigation'
import { trackClick } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import styles from './freelance.module.css'

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
  cta,
  items,
}: {
  title: string
  lead: string
  /** "Another question?" */
  more: string
  /** "Write to me": links to the contact form on the home page. */
  moreCta: string
  /** Back up to the request form. */
  cta: string
  items: PublicFaqItem[]
}) {
  if (items.length === 0) return null
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-24 border-t border-border py-20 md:py-28"
    >
      <div className="container-main grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <div className="lg:sticky lg:top-28">
          <h2 id="faq-title" className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">{lead}</p>

          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <MessageCircleQuestion aria-hidden="true" className="size-4 text-primary-text" />
            {more}
            <Link
              href={{ pathname: '/', hash: 'contact' }}
              className="inline-flex min-h-11 items-center rounded-sm font-semibold text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...trackClick('contact-cta', { from: 'faq' })}
            >
              {moreCta}
            </Link>
          </p>

          <a href="#request" className={`${pillOutline} mt-3`} {...trackClick('contact-cta', { from: 'freelance-faq' })}>
            {cta}
            <ArrowUp aria-hidden="true" className="size-4" />
          </a>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {items.map((item, index) => (
            <details key={item.id} open={index === 0} className={cn(styles.faqItem, 'group')}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-medium text-foreground transition-colors duration-200 hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors duration-200 group-open:bg-primary/15 group-open:text-primary-text"
                >
                  <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
                </span>
              </summary>
              <p className="pb-5 pe-12 text-sm leading-relaxed text-muted-foreground text-pretty">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
