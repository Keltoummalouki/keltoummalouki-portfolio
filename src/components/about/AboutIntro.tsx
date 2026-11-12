import { ArrowRight, Download, Mail, MapPin, UserRound } from 'lucide-react'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import type { ProfileAvailability } from '@/features/seo/profile-summary'
import { trackClick } from '@/lib/analytics/events'
import { isOptimizableImageSrc } from '@/lib/images'
import { cn } from '@/lib/utils'
import { ctaPrimary, ctaSecondary } from './ProfileSection'

const AVAILABILITY_DOT: Record<ProfileAvailability, string> = {
  available: 'bg-green-500',
  limited: 'bg-amber-500',
  unavailable: 'bg-muted-foreground',
}

/** The photo's ring says the same as the availability chip (which says it in words). */
const AVAILABILITY_RING: Record<ProfileAvailability, string> = {
  available: 'ring-green-500',
  limited: 'ring-amber-500',
  unavailable: 'ring-border',
}

export interface AboutIntroProps {
  eyebrow: string
  title: string
  /** Third-person definitional paragraph ("Keltoum Malouki is a …"). */
  definition: string
  bio: string
  photoUrl: string
  photoAlt: string
  location: string
  availability: ProfileAvailability
  availabilityLabel: string
  cvUrl: string
  email: string
  labels: { actions: string; downloadCv: string; workWithMe: string; email: string }
  className?: string
}

export default function AboutIntro({
  eyebrow,
  title,
  definition,
  bio,
  photoUrl,
  photoAlt,
  location,
  availability,
  availabilityLabel,
  cvUrl,
  email,
  labels,
  className,
}: AboutIntroProps) {
  return (
    <section aria-labelledby="about-title" className={cn('min-w-0', className)}>
      <div className="flex items-center gap-5 sm:gap-7">
        <div className={cn('shrink-0 rounded-[1.9rem] p-1 ring-2', AVAILABILITY_RING[availability])}>
          {/* Optimized + preloaded (LCP). Hosts outside images.remotePatterns render unoptimized. */}
          <Image
            src={photoUrl}
            alt={photoAlt}
            width={224}
            height={224}
            priority
            sizes="(min-width: 1024px) 144px, (min-width: 640px) 128px, 88px"
            unoptimized={!isOptimizableImageSrc(photoUrl)}
            className="size-22 rounded-[1.6rem] border border-border bg-card object-cover sm:size-32 lg:size-36"
          />
        </div>

        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-1 text-sm font-medium text-primary-text">
            <UserRound aria-hidden="true" className="size-4" />
            {eyebrow}
          </p>

          <h1
            id="about-title"
            className="mt-3 text-[1.875rem] font-bold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl lg:text-[3.25rem] rtl:leading-[1.3] rtl:tracking-normal"
          >
            {title}
          </h1>
        </div>
      </div>

      <div className="mt-7 max-w-3xl md:mt-8">
        <p className="text-lg font-medium leading-relaxed text-foreground md:text-xl text-pretty">{definition}</p>

        {bio && <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground text-pretty">{bio}</p>}

        <ul className="mt-6 flex flex-wrap items-center gap-2.5">
          <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" size={14} className="text-primary-text" />
            {location}
          </li>
          <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
            <span aria-hidden="true" className={cn('size-2 rounded-full', AVAILABILITY_DOT[availability])} />
            {availabilityLabel}
          </li>
        </ul>

        <nav aria-label={labels.actions} className="mt-8">
          <ul className="flex flex-wrap gap-3">
            <li>
              <a
                href={cvUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className={ctaPrimary}
                {...trackClick('cv-download', { from: 'about' })}
              >
                <Download aria-hidden="true" className="size-4" />
                {labels.downloadCv}
              </a>
            </li>
            <li>
              <Link href="/freelance" className={cn(ctaSecondary, 'group')} {...trackClick('contact-cta', { from: 'about' })}>
                {labels.workWithMe}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                />
              </Link>
            </li>
            <li>
              <a href={`mailto:${email}`} className={ctaSecondary} {...trackClick('contact-link', { channel: 'email', from: 'about' })}>
                <Mail aria-hidden="true" className="size-4" />
                {labels.email}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  )
}
