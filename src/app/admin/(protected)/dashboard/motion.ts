'use client'

import { useEffect, useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { bindMagnetic, bindTilt, playDataMotion } from '@/lib/motion/studio-motion'

// The dashboard's choreography (helpers and Lenis smooth scrolling come from
// lib/motion/studio-motion, set up by the admin shell):
//   [data-intro] [data-stage] .d3-kpi  hidden by CSS until this hook takes over, then played in
//   [data-reveal]                      revealed when scrolled into view
//   [data-tilt] [data-magnetic]        pointer effects (fine pointers only)
// Nothing runs under prefers-reduced-motion: the CSS shows the final state.

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function useDashboardMotion(rootRef: RefObject<HTMLElement | null>, volumesScroll: { current: number }) {
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    gsap.registerPlugin(ScrollTrigger)
    const q = gsap.utils.selector(root)
    const cleanups: (() => void)[] = []
    let introDone = false
    // Lifts the CSS pre-hide; GSAP sets the hidden start states in this same
    // synchronous pass, before the browser paints.
    root.dataset.motion = 'on'

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'expo.out' }, onComplete: () => void (introDone = true) })
        .from(q('.d3-word > span'), { yPercent: 115, rotate: 6, duration: 1.2, stagger: 0.07 })
        .from(q('[data-intro]'), { y: 18, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.15)
        .from(
          q('.d3-kpi'),
          {
            y: 64, rotationX: -32, autoAlpha: 0, transformPerspective: 1000, transformOrigin: '50% 100%', duration: 1.3, stagger: 0.09,
            onStart: () => void cleanups.push(playDataMotion(q('.d3-kpis')[0], 200)),
          },
          0.25,
        )
        .from(
          q('[data-stage]'),
          {
            y: 56, scale: 0.97, autoAlpha: 0, duration: 1.3, stagger: 0.1,
            onStart: () => q('[data-stage]').forEach(el => void cleanups.push(playDataMotion(el, 250))),
          },
          0.4,
        )

      q('[data-reveal]').forEach(el => {
        gsap.from(el, {
          y: 80, rotationX: 9, autoAlpha: 0, transformPerspective: 1300, transformOrigin: '50% 0%', duration: 1.25, ease: 'expo.out',
          // clamp(): the footer sits so low that its start line would lie past
          // the end of the page, so it would never reveal.
          scrollTrigger: { trigger: el, start: 'clamp(top 92%)', once: true, onEnter: () => void cleanups.push(playDataMotion(el, 150)) },
        })
      })

      // Scroll-linked motion: the volumes turn as they pass, the greeting drifts away.
      const volumes = q('.d3-volumes')[0]
      if (volumes) {
        ScrollTrigger.create({ trigger: volumes, start: 'top bottom', end: 'bottom top', onUpdate: self => void (volumesScroll.current = self.progress) })
      }
      const hero = q('.d3-hero-text')[0]
      if (hero) {
        gsap.to(hero, { yPercent: -22, autoAlpha: 0.25, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top+=64', end: 'bottom top', scrub: true } })
      }

      cleanups.push(bindTilt(q('[data-tilt]') as HTMLElement[], () => introDone))
      cleanups.push(bindMagnetic(q('[data-magnetic]') as HTMLElement[]))
    }, root)

    // Folding the sidebar reflows the page without a window resize.
    let refresh = 0
    const resize = new ResizeObserver(() => {
      window.clearTimeout(refresh)
      refresh = window.setTimeout(() => ScrollTrigger.refresh(), 200)
    })
    resize.observe(root)

    return () => {
      window.clearTimeout(refresh)
      resize.disconnect()
      cleanups.forEach(fn => fn())
      ctx.revert()
      delete root.dataset.motion
    }
  }, [rootRef, volumesScroll])
}
