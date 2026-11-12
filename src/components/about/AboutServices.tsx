import { Code2, MonitorSmartphone, Server, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProfileSection, { cardClass } from './ProfileSection'

export type AboutServiceKey = 'fullStack' | 'backend' | 'frontend'

const SERVICE_ICONS: Record<AboutServiceKey, LucideIcon> = {
  fullStack: Code2,
  backend: Server,
  frontend: MonitorSmartphone,
}

/** A bento: the main service spans the row in the solid accent, the other two share the next. */
export default function AboutServices({
  title,
  number,
  lead,
  items,
}: {
  title: string
  number?: string
  lead: string
  items: { key: AboutServiceKey; title: string; description: string }[]
}) {
  return (
    <ProfileSection id="what-i-do" number={number} title={title} lead={lead}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item, index) => {
          const Icon = SERVICE_ICONS[item.key]
          const main = index === 0
          return (
            <li key={item.key} className={cn(cardClass, 'relative p-6 md:p-7', main && 'sm:col-span-2')}>
              <span aria-hidden="true" className="absolute end-6 top-6 font-mono text-xs tabular-nums text-muted-foreground md:end-7 md:top-7">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-11 items-center justify-center rounded-2xl',
                  main ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary-text',
                )}
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className={cn('mt-2 text-sm leading-relaxed text-muted-foreground text-pretty', main && 'sm:max-w-2xl sm:text-[0.9375rem]')}>
                {item.description}
              </p>
            </li>
          )
        })}
      </ul>
    </ProfileSection>
  )
}
