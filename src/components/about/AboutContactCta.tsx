import { ArrowRight, Mail } from 'lucide-react'
import SocialIcon from '@/components/ui/SocialIcon'
import { Link } from '@/i18n/navigation'
import { trackClick } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { ctaPrimary, ctaSecondary } from './ProfileSection'

export default function AboutContactCta({
  title,
  text,
  email,
  linkedinUrl,
  githubUrl,
  labels,
}: {
  title: string
  text: string
  email: string
  linkedinUrl: string
  githubUrl: string
  labels: { email: string; freelance: string; linkedin: string; github: string }
}) {
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 text-center md:p-10"
    >
      <h2 id="contact-title" className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground text-pretty">{text}</p>
      <ul className="mt-8 flex flex-wrap justify-center gap-3">
        <li>
          <a href={`mailto:${email}`} className={ctaPrimary} {...trackClick('contact-link', { channel: 'email', from: 'about-contact' })}>
            <Mail aria-hidden="true" className="size-4" />
            {labels.email}
          </a>
        </li>
        <li>
          <Link href="/freelance" className={cn(ctaSecondary, 'group')} {...trackClick('contact-cta', { from: 'about-contact' })}>
            {labels.freelance}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            />
          </Link>
        </li>
        {linkedinUrl && (
          <li>
            <a
              href={linkedinUrl}
              target="_blank"
              rel="me noopener noreferrer"
              className={ctaSecondary}
              {...trackClick('contact-link', { channel: 'linkedin', from: 'about-contact' })}
            >
              <SocialIcon platform="linkedin" className="size-4" />
              {labels.linkedin}
            </a>
          </li>
        )}
        {githubUrl && (
          <li>
            <a
              href={githubUrl}
              target="_blank"
              rel="me noopener noreferrer"
              className={ctaSecondary}
              {...trackClick('contact-link', { channel: 'github', from: 'about-contact' })}
            >
              <SocialIcon platform="github" className="size-4" />
              {labels.github}
            </a>
          </li>
        )}
      </ul>
    </section>
  )
}
