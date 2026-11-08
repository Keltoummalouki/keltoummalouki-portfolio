import { ArrowUp, ClipboardCheck, GitBranch, MessagesSquare, Rocket, type LucideIcon } from 'lucide-react'
import { pillOutline } from '@/components/sections/showcase/classes'
import { trackClick } from '@/lib/analytics/events'
import styles from './freelance.module.css'

const ICONS: Record<string, LucideIcon> = {
  brief: MessagesSquare,
  scope: ClipboardCheck,
  build: GitBranch,
  launch: Rocket,
}

/**
 * "How I work": what happens after the request. A vertical rail on small screens
 * and a row from `md`, whose line fills as it scrolls into view.
 */
export default function FreelanceProcess({
  title,
  lead,
  steps,
  cta,
}: {
  title: string
  lead: string
  steps: { id: string; title: string; text: string }[]
  /** Back up to the form. */
  cta: string
}) {
  return (
    <section aria-labelledby="process-title" className="border-t border-border py-20 md:py-28">
      <div className="container-main">
        <div className="grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-14">
          <h2 id="process-title" className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">{lead}</p>
        </div>

        <ol className={styles.rail}>
          {steps.map((step, index) => {
            const Icon = ICONS[step.id] ?? MessagesSquare
            return (
              <li key={step.id} className={styles.railStep}>
                {index < steps.length - 1 && (
                  <>
                    <span aria-hidden="true" className={styles.railLineDown} />
                    <span aria-hidden="true" className={styles.railLineAcross} />
                  </>
                )}
                <span aria-hidden="true" className={styles.railWell}>
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span aria-hidden="true" className={styles.railNumber}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-lg font-semibold leading-snug text-foreground text-balance">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{step.text}</p>
              </li>
            )
          })}
        </ol>

        <a href="#request" className={`${pillOutline} mt-12`} {...trackClick('contact-cta', { from: 'freelance-process' })}>
          {cta}
          <ArrowUp aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  )
}
