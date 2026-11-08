'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'
import { bindTilt, playDataMotion } from '@/lib/motion/studio-motion'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Entrance choreography for a standard admin page, mounted by PageHeader so it
 * runs when the real page (not the loading skeleton) appears: the page's
 * sections rise in one after another and the stat cards flip up in 3D (GSAP),
 * numbers count up and table/list rows stagger in (anime.js), and stat cards
 * then tilt towards the pointer. It runs in a layout effect, before paint, so
 * nothing flashes; under reduced motion it does nothing.
 */
export default function PageMotion() {
  const anchor = useRef<HTMLSpanElement>(null)

  useIsomorphicLayoutEffect(() => {
    const page = anchor.current?.closest<HTMLElement>('.admin-page-content > *')
    if (!page || prefersReducedMotion()) return
    const cleanups: (() => void)[] = []
    let ready = false
    // Lifts the CSS pre-hide (studio.css); GSAP sets the start states in this same pass.
    page.dataset.motion = 'on'

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.admin-overview > *', page)
      gsap
        .timeline({ defaults: { ease: 'expo.out' }, onComplete: () => void (ready = true) })
        .from(Array.from(page.children), { y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.07 })
        .from(cards, { y: 36, rotationX: -26, transformPerspective: 900, transformOrigin: '50% 100%', duration: 1.1, stagger: 0.08 }, 0.12)
      cleanups.push(bindTilt(cards, () => ready, 0.8))
    }, page)

    page.querySelectorAll('.admin-table-shell tbody tr, .admin-inbox-list > li').forEach(row => row.setAttribute('data-row', ''))
    cleanups.push(playDataMotion(page, 180))

    return () => {
      cleanups.forEach(fn => fn())
      ctx.revert()
      delete page.dataset.motion
    }
  }, [])

  return <span ref={anchor} hidden />
}
