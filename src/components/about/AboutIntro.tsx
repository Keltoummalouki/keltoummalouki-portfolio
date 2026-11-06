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
}: AboutIntroProps) {
  return (
    <section aria-labelledby="about-title" className="mt-8 md:mt-10">
      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[auto_1fr] md:gap-12">
        <div className="relative w-fit">
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/15 to-violet-500/15 blur-2xl"
          />
          {/* Optimized + preloaded (LCP). Hosts outside images.remotePatterns render unoptimized. */}
          <Image
            src={photoUrl}
            alt={photoAlt}
            width={224}
            height={224}
            priority
            sizes="(min-width: 768px) 224px, (min-width: 640px) 176px, 144px"
            unoptimized={!isOptimizableImageSrc(photoUrl)}
            className="relative size-36 rounded-3xl border border-border bg-card object-cover shadow-lg sm:size-44 md:size-56"
          />
        </div>

        <div className="min-w-0 text-start">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm font-medium text-primary-text">
            <UserRound aria-hidden="true" className="size-4" />
            {eyebrow}
          </p>

          <h1
            id="about-title"
            className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance"
          >
            {title}
          </h1>

          <p className="mt-5 text-lg font-semibold leading-relaxed text-foreground md:text-xl text-pretty">
            {definition}
          </p>

          {bio && (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground text-pretty">{bio}</p>
          )}

          <ul className="mt-6 flex flex-wrap items-center gap-3">
            <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" size={14} className="text-primary" />
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
      </div>
    </section>
  )
}
