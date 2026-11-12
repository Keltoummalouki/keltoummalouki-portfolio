import type { AboutFaqItem } from '@/features/seo/about-faq'
import { cn } from '@/lib/utils'
import ProfileSection, { anchorOffset, cardClass } from './ProfileSection'

/**
 * Always-visible Q&As (no accordion): the FAQPage JSON-LD is built from the
 * same items, and structured data must match content users can see. Numbered in
 * a gutter, so the questions scan like a list.
 */
export default function AboutFaq({
  title,
  number,
  lead,
  items,
}: {
  title: string
  number?: string
  lead: string
  items: AboutFaqItem[]
}) {
  if (items.length === 0) return null
  return (
    <ProfileSection id="faq" number={number} title={title} lead={lead}>
      <div className={cn(cardClass, 'divide-y divide-border')}>
        {items.map((item, index) => (
          <div
            key={item.id}
            id={`faq-${item.id}`}
            className={cn(anchorOffset, 'grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 p-5 md:grid-cols-[2.75rem_minmax(0,1fr)] md:p-7')}
          >
            <span aria-hidden="true" className="pt-1 font-mono text-xs font-medium tabular-nums text-primary-text">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground text-balance">{item.question}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground text-pretty">{item.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  )
}
