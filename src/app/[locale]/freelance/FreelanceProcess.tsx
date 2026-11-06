/**
 * "How I work": numbered steps joined by a line, a vertical timeline on small
 * screens and a row from `md`. Logical start/end offsets mirror it in RTL.
 *
 * One connector per layout, each with plain (non-responsive) offsets: the dev
 * CSS pipeline drops logical insets inside media queries (`md:start-*`).
 */
export default function FreelanceProcess({
  title,
  lead,
  steps,
}: {
  title: string
  lead: string
  steps: { id: string; title: string; text: string }[]
}) {
  return (
    <section aria-labelledby="process-title" className="mb-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 id="process-title" className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{lead}</p>

      <ol className="mt-8 grid gap-6 md:grid-cols-4 md:gap-4">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex gap-4 md:flex-col md:gap-3">
            {index < steps.length - 1 && (
              <>
                <span aria-hidden="true" className="absolute start-4.5 top-11 -bottom-4 w-px bg-border md:hidden" />
                <span aria-hidden="true" className="absolute start-11 -end-2 top-4.5 hidden h-px bg-border md:block" />
              </>
            )}
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary tabular-nums ring-1 ring-primary/30"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-balance">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
