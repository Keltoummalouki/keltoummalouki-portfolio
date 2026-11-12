import {
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  Handshake,
  Languages,
  Mail,
  MapPin,
  type LucideIcon,
} from 'lucide-react'
import type { AboutFactId, AboutFactRow } from '@/features/seo/about-faq'
import { cn } from '@/lib/utils'
import ProfileSection, { iconTileClass } from './ProfileSection'

const FACT_ICONS: Record<AboutFactId, LucideIcon> = {
  role: BriefcaseBusiness,
  location: MapPin,
  current: Building2,
  education: GraduationCap,
  languages: Languages,
  openTo: Handshake,
  email: Mail,
}

/**
 * A spec sheet: hairlines between the facts (the gaps show the list's border
 * colour), an odd last fact spanning the row. The icon sits inside its <dt> (a
 * <dl> group may hold only <dt> and <dd>) and is placed in the gutter from there.
 */
export default function AboutFacts({ title, number, facts }: { title: string; number?: string; facts: AboutFactRow[] }) {
  return (
    <ProfileSection id="at-a-glance" number={number} title={title}>
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
        {facts.map((fact) => {
          const Icon = FACT_ICONS[fact.id]
          return (
            <div
              key={fact.id}
              className="relative bg-card py-4 pe-4 ps-17 sm:[&:last-child:nth-child(odd)]:col-span-2 md:py-5 md:pe-5"
            >
              <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground rtl:tracking-normal">
                <span aria-hidden="true" className={cn(iconTileClass, 'absolute start-4 top-4 size-9 md:top-5')}>
                  <Icon className="size-4.5" />
                </span>
                {fact.label}
              </dt>
              <dd className="mt-1 wrap-break-word text-[0.9375rem] font-semibold leading-snug text-foreground">
                {fact.href ? (
                  <a
                    href={fact.href}
                    className="rounded-sm underline-offset-4 hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {fact.value}
                  </a>
                ) : (
                  fact.value
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </ProfileSection>
  )
}
