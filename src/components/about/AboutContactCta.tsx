import { ArrowRight, Mail, Send } from 'lucide-react'
import { VoxelGlyph } from '@/components/three/voxel-icon/glyphs'
import SocialIcon from '@/components/ui/SocialIcon'
import { Link } from '@/i18n/navigation'
import { trackClick } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { anchorOffset, ctaBase } from './ProfileSection'

// The last chapter, on the solid accent: white text on #2A6AFF is 4.56:1. Buttons
// invert (white with accent text) or go outline, and focus rings turn white.
const onAccent = 'focus-visible:ring-primary-foreground focus-visible:ring-offset-primary'
const accentPrimary = cn(ctaBase, onAccent, 'bg-primary-foreground text-primary hover:bg-primary-foreground/90')
const accentSecondary = cn(
  ctaBase,
  onAccent,
  'border border-primary-foreground/40 text-primary-foreground hover:border-primary-foreground hover:bg-primary-foreground/10',
)

export default function AboutContactCta({
  title,
  number,
  text,
  email,
  linkedinUrl,
  githubUrl,
  labels,
}: {
  title: string
  number?: string
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
      className={cn(anchorOffset, 'relative overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground md:p-12')}
    >
      {/* Decorative, flat: the paper plane in the same colour, a shade lighter. */}
      <Send
        aria-hidden="true"
        strokeWidth={1.25}
        className="pointer-events-none absolute -bottom-12 -end-8 size-56 text-primary-foreground/10 rtl:-scale-x-100 md:size-72"
      />
      <div className="relative">
        <div aria-hidden="true" className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15">
            <VoxelGlyph name="send" className="size-4.5" />
          </span>
          {number && <span className="font-mono text-xs font-medium tabular-nums">{number}</span>}
        </div>
        <h2 id="contact-title" className="mt-5 max-w-xl text-3xl font-bold tracking-tight text-balance md:text-4xl rtl:tracking-normal">
          {title}
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed wrap-break-word text-pretty">{text}</p>
        <ul className="mt-8 flex flex-wrap gap-3">
          <li>
            <a href={`mailto:${email}`} className={accentPrimary} {...trackClick('contact-link', { channel: 'email', from: 'about-contact' })}>
              <Mail aria-hidden="true" className="size-4" />
              {labels.email}
            </a>
          </li>
          <li>
            <Link href="/freelance" className={cn(accentSecondary, 'group')} {...trackClick('contact-cta', { from: 'about-contact' })}>
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
                className={accentSecondary}
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
                className={accentSecondary}
                {...trackClick('contact-link', { channel: 'github', from: 'about-contact' })}
              >
                <SocialIcon platform="github" className="size-4" />
                {labels.github}
              </a>
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
