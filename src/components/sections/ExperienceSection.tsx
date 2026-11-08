'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Briefcase } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import SkillIcon from '@/components/ui/SkillIcon'
import type { PublicExperience } from '@/features/cms/queries'
import { isOptimizableImageSrc } from '@/lib/images'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

const experienceItems = [
  {
    id: 'dabadoc',
    icon: Briefcase,
    technologies: ['Ruby on Rails', 'Angular', 'CoffeeScript', 'MongoDB', 'Docker', 'Git/GitHub'],
  },
  {
    id: 'caisseManager',
    icon: Briefcase,
    technologies: ['Next.js', 'React.js', 'TailwindCSS', 'GSAP', 'Framer Motion', 'Shadcn UI', 'Git/GitHub'],
  },
]

// A card's trip through the viewport, as a share of the scroll that carries its
// centre from the bottom edge to the top edge: it comes in until ARRIVE, rests
// flat and full size until LEAVE (so it can be read with crisp text), then goes.
const ARRIVE = 0.42
const LEAVE = 0.58

// A card's far poses. Together they read as a wheel turning under the page: the
// card is closest and largest at the middle of the screen and rolls away from
// the reader at both edges. Phones get a smaller swing.
const POSES = {
  wide: {
    enter: { rotateX: -26, rotateY: 7, scale: 0.8 },
    exit: { rotateX: 22, rotateY: -5, scale: 0.84 },
  },
  narrow: {
    enter: { rotateX: -16, rotateY: 0, scale: 0.9 },
    exit: { rotateX: 14, rotateY: 0, scale: 0.92 },
  },
}

/** How far each `data-card-layer` floats above the card while it turns (px). */
const LAYER_DEPTHS = [48, 30, 14, 36]

/** Ties one timeline item's card to the scroll position. */
function animateCard(item: HTMLElement, wide: boolean) {
  // The item itself never moves: the scroll position is measured against it.
  const trip = gsap.timeline({
    scrollTrigger: { trigger: item, start: 'center bottom', end: 'center top', scrub: true },
  })
  const travel = (
    selector: string,
    enter: gsap.TweenVars,
    rest: gsap.TweenVars,
    exit: gsap.TweenVars,
    ease = { in: 'sine.inOut', out: 'sine.inOut' },
  ) => {
    const targets = item.querySelectorAll(selector)
    trip
      .fromTo(targets, enter, { ...rest, duration: ARRIVE, ease: ease.in }, 0)
      .to(targets, { ...exit, duration: 1 - LEAVE, ease: ease.out }, LEAVE)
  }

  const poses = wide ? POSES.wide : POSES.narrow
  // Turning near the rail keeps the card attached to its dot as it shrinks.
  gsap.set(item.querySelector('[data-card]'), { transformPerspective: 1100, transformOrigin: '12% 50%' })
  travel('[data-card]', poses.enter, { rotateX: 0, rotateY: 0, scale: 1 }, poses.exit)
  travel('[data-card-dot]', { scale: 0.7 }, { scale: 1 }, { scale: 0.75 })
  // Clears early, so a card waiting further down the screen stays legible.
  travel('[data-card-fade]', { opacity: 0.35 }, { opacity: 1 }, { opacity: 0.4 }, { in: 'power2.out', out: 'power2.in' })

  if (wide) {
    // Real depth: the content floats above the surface while the card turns and
    // settles onto it at rest, and a plate behind the card shows at its edge.
    const depth = (i: number) => LAYER_DEPTHS[i] ?? 0
    travel('[data-card-layer]', { z: depth }, { z: 0 }, { z: (i: number) => depth(i) * 0.8 })
    gsap.set(item.querySelector('[data-card-plate]'), { opacity: 1 })
    travel('[data-card-plate]', { z: -56 }, { z: -1 }, { z: -44 })
  }
}

export default function ExperienceSection({ items: cmsItems }: { items?: PublicExperience[] }) {
  const t = useTranslations('experience')
  const sectionRef = useRef<HTMLElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = gsap.matchMedia()
    media.add({
      // `screen`: a printed page or PDF gets the cards flat.
      motion: 'screen and (prefers-reduced-motion: no-preference)',
      wide: '(min-width: 768px)',
    }, ({ conditions }) => {
      const section = sectionRef.current
      if (!conditions?.motion || !section) return

      gsap.fromTo(section.querySelector('.timeline-line'), { scaleY: 0 }, {
        scaleY: 1,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: timelineRef.current, start: 'top 80%' },
      })
      section.querySelectorAll<HTMLElement>('.timeline-item').forEach((item) => animateCard(item, !!conditions.wide))
    })

    return () => media.revert()
  }, [])

  const items = cmsItems?.length
    ? cmsItems.map((item) => ({
        id: item.id,
        icon: Briefcase,
        title: item.role,
        date: item.date,
        company: item.company,
        description: item.description,
        imageUrl: item.imageUrl,
        technologies: item.technologies,
      }))
    : experienceItems.map((item) => ({
        ...item,
        title: t(`items.${item.id}.title`),
        date: t(`items.${item.id}.date`),
        company: t(`items.${item.id}.company`),
        description: t(`items.${item.id}.description`),
        imageUrl: '',
      }))

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-background"
      aria-labelledby="experience-title"
    >
      <div className="absolute inset-0 grid-pattern opacity-20 pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative container-main">
        <SectionHeader id="experience-title" eyebrow={t('subtitle')} title={t('title')} />

        <div ref={timelineRef} className="relative max-w-3xl mx-auto">
          <div className="timeline-line absolute left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border origin-top" />

          <div className="space-y-10 md:space-y-12">
            {items.map((item) => {
              const Icon = item.icon

              return (
                <motion.div
                  key={item.id}
                  className="timeline-item relative pl-12 md:pl-20"
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div data-card-dot className="absolute left-0 md:left-4 top-1 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-background bg-primary text-primary-foreground">
                    <Icon size={15} />
                  </div>

                  {/* Fades on its own element: opacity on the card would flatten its 3D layers. */}
                  <div data-card-fade>
                    <div data-card className="group relative p-5 md:p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors duration-300 transform-3d">
                      <span data-card-plate aria-hidden="true" className="absolute -inset-px rounded-2xl border border-primary/25 bg-primary/10 pointer-events-none opacity-0" />

                      <div data-card-layer className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
                          {item.title}
                          {/* Keeps headings unique when two roles share a title. */}
                          {item.company && <span className="sr-only">, {item.company}</span>}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {item.date}
                        </span>
                      </div>

                      <p data-card-layer className="text-sm text-primary font-medium mb-3">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.company}
                            aria-hidden="true"
                            width={32}
                            height={32}
                            unoptimized={!isOptimizableImageSrc(item.imageUrl)}
                            className="me-2 inline-block size-8 rounded-lg border border-border object-cover align-middle"
                          />
                        )}
                        {item.company}
                      </p>

                      <p data-card-layer className="text-muted-foreground mb-4 leading-relaxed">
                        {item.description}
                      </p>

                      <div data-card-layer className="flex flex-wrap gap-2">
                        {item.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-secondary text-muted-foreground"
                          >
                            <SkillIcon name={tech} icon={tech} className="text-primary" size={13} />
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
