'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTranslations } from 'next-intl'
import ContactForm, { type ContactReport } from '@/components/contact/ContactForm'
import DirectContact from '@/components/contact/DirectContact'
import PlaneStage, { type PlaneStageHandle } from '@/components/three/paper-plane/PlaneStage'
import type { PublicSocialLink } from '@/features/cms/queries'
import { EMPTY_CONTACT, letterSceneState } from '@/features/inbox/contact-form'
import { scrollToElement } from '@/lib/motion/smooth-scroll'
import styles from './ContactSection.module.css'

const INITIAL_REPORT: ContactReport = { values: EMPTY_CONTACT, phase: 'editing' }
/** Where the letter sits above the form instead of beside it. */
const STACKED_QUERY = '(max-width: 1023px)'
/** Clears the floating header when scrolling the letter back into view. */
const SCROLL_OFFSET = 96

// The last section of the home page: a short form beside a 3D letter that writes
// itself as the form is filled in, folds into a paper plane when the message is
// sent and flies off (components/three/paper-plane). The form is the real
// interface; the letter only mirrors it. Spec: design-system/pages/home-contact.md.
export default function ContactSection({
  index,
  socialLinks = [],
  bookingUrl = '',
}: {
  /** Display number in the section sequence ("05"). */
  index: string
  socialLinks?: PublicSocialLink[]
  /** Call-booking link from the dashboard; no "Book a call" line without one. */
  bookingUrl?: string
}) {
  const t = useTranslations('contact')
  const sectionRef = useRef<HTMLElement>(null)
  const stageBoxRef = useRef<HTMLDivElement>(null)
  const stage = useRef<PlaneStageHandle>(null)
  const [report, setReport] = useState(INITIAL_REPORT)
  // A new key restarts the form after a message went through, without touching the 3D.
  const [attempt, setAttempt] = useState(0)
  const letter = useMemo(() => letterSceneState(report.values, report.phase), [report])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const section = sectionRef.current
      if (!section) return
      // Batched per element: on a phone the form sits a screen below the heading.
      gsap.set(section.querySelectorAll('[data-contact-reveal]'), { y: 28, opacity: 0 })
      ScrollTrigger.batch(section.querySelectorAll('[data-contact-reveal]'), {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 0.75, stagger: 0.1, ease: 'power3.out', overwrite: true }),
      })
      gsap.fromTo(
        section.querySelector('[data-contact-rule]'),
        { scaleX: 0 },
        { scaleX: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 25%', scrub: true } },
      )
    })
    return () => media.revert()
  }, [])

  // On a phone the letter sits above the form: bring it back into view to watch it fly.
  const onSent = useCallback(() => {
    const box = stageBoxRef.current
    if (!box || !window.matchMedia(STACKED_QUERY).matches) return
    if (box.getBoundingClientRect().top < SCROLL_OFFSET - 8) scrollToElement(box, SCROLL_OFFSET)
  }, [])

  const onActivity = useCallback(() => stage.current?.nudge(), [])
  const onRestart = useCallback(() => setAttempt((count) => count + 1), [])

  return (
    <section id="contact" ref={sectionRef} aria-labelledby="contact-title" className={styles.section}>
      <div className="container-main">
        <header className={styles.header} data-contact-reveal>
          <div>
            <p className={styles.eyebrow}>
              <span />
              {index} / {t('eyebrow')}
            </p>
            <h2 id="contact-title" className={styles.heading}>
              {t('title')}
            </h2>
          </div>
          <p className={styles.intro}>{t('subtitle')}</p>
        </header>
        <div className={styles.rule}>
          <div data-contact-rule />
        </div>

        <div className={styles.layout}>
          <div ref={stageBoxRef} className={styles.stage} data-contact-reveal>
            <PlaneStage ref={stage} state={letter} />
          </div>
          <div className={styles.form} data-contact-reveal>
            <ContactForm
              key={attempt}
              onReport={setReport}
              onActivity={onActivity}
              onRestart={onRestart}
              onSent={onSent}
            />
          </div>
          <div className={styles.direct} data-contact-reveal>
            <DirectContact socialLinks={socialLinks} bookingUrl={bookingUrl} />
          </div>
        </div>
      </div>
    </section>
  )
}
