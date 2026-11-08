'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { animate, stagger, utils, type JSAnimation } from 'animejs'
import { formatCount } from '@/lib/format-count'
import { prefersReducedMotion } from './reduced-motion'
import { setLenisInstance } from './smooth-scroll'

// Motion shared by every admin ("studio") page. Who does what:
// - Lenis: smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync.
// - GSAP: page choreography, scroll reveals, pointer tilt, magnetic buttons.
// - anime.js: data moments inside a card (count-ups, gauges, bars, list staggers).
// Callers skip all of it under prefers-reduced-motion; the CSS shows the final state.
//
// Markup contract for playDataMotion:
//   [data-count="n"]                   counts up to n (its only child is the formatted number)
//   [data-arc="len"][data-arc-offset]  gauge arc drawn on a pathLength="1" path
//   [data-bar="x|y"]                   bar grown from 0
//   [data-clip]                        revealed left to right
//   [data-row]                         list row, staggered in

/** Plays the data animations inside `scope`; returns a cleanup that restores final values. */
export function playDataMotion(scope: Element | undefined | null, delay = 0): () => void {
  if (!scope) return () => undefined
  const animations: JSAnimation[] = []
  const restore: (() => void)[] = []

  scope.querySelectorAll<HTMLElement>('[data-count]').forEach(el => {
    const end = Number(el.dataset.count)
    const text = el.firstChild
    if (!Number.isFinite(end) || !text || text.nodeType !== Node.TEXT_NODE) return
    // Edit React's own text node in place, so a later re-render still updates it.
    const write = (value: number) => {
      text.nodeValue = formatCount(Math.round(value))
    }
    const state = { value: 0 }
    write(0)
    animations.push(animate(state, { value: end, duration: 1500, delay, ease: 'outExpo', onUpdate: () => write(state.value) }))
    restore.push(() => write(end))
  })

  scope.querySelectorAll<SVGPathElement>('[data-arc]').forEach(el => {
    const length = Number(el.dataset.arc)
    const offset = Number(el.dataset.arcOffset ?? 0)
    const state = { t: 0 }
    const write = () => {
      el.style.strokeDasharray = `${length * state.t} 1`
      el.style.strokeDashoffset = String(-offset * state.t)
    }
    write()
    animations.push(animate(state, { t: 1, duration: 1700, delay: delay + 150, ease: 'inOutCubic', onUpdate: write }))
    restore.push(() => {
      el.style.strokeDasharray = ''
      el.style.strokeDashoffset = ''
    })
  })

  for (const axis of ['x', 'y'] as const) {
    const bars = scope.querySelectorAll<HTMLElement>(`[data-bar="${axis}"]`)
    if (!bars.length) continue
    const prop = axis === 'x' ? 'scaleX' : 'scaleY'
    utils.set(bars, { [prop]: 0 })
    animations.push(animate(bars, { [prop]: 1, duration: 1100, delay: stagger(55, { start: delay + 120 }), ease: 'outExpo' }))
  }

  scope.querySelectorAll<HTMLElement | SVGElement>('[data-clip]').forEach(el => {
    const state = { t: 0 }
    const write = () => {
      el.style.clipPath = `inset(-2px ${(1 - state.t) * 100}% -2px 0)`
    }
    write()
    animations.push(animate(state, { t: 1, duration: 1300, delay: delay + 100, ease: 'inOutQuart', onUpdate: write, onComplete: () => (el.style.clipPath = '') }))
    restore.push(() => {
      el.style.clipPath = ''
    })
  })

  const rows = scope.querySelectorAll<HTMLElement>('[data-row]')
  if (rows.length) {
    utils.set(rows, { opacity: 0, translateY: 14 })
    animations.push(animate(rows, { opacity: 1, translateY: 0, duration: 700, delay: stagger(45, { start: delay + 120 }), ease: 'outExpo' }))
  }

  return () => {
    animations.forEach(animation => animation.revert())
    restore.forEach(fn => fn())
  }
}

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * 3D tilt towards the pointer, plus --gx/--gy for a glare highlight. Call
 * inside a gsap.context() so the tweens are reverted with it. `ready` lets an
 * intro finish first (both animate the same transform).
 */
export function bindTilt(elements: HTMLElement[], ready: () => boolean = () => true, strength = 1): () => void {
  if (!finePointer()) return () => undefined
  const cleanups = elements.map(el => {
    gsap.set(el, { transformPerspective: 900 })
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      if (!ready()) return
      const box = el.getBoundingClientRect()
      const px = (e.clientX - box.left) / box.width - 0.5
      const py = (e.clientY - box.top) / box.height - 0.5
      rx(-py * 7 * strength)
      ry(px * 9 * strength)
      el.style.setProperty('--gx', `${(px + 0.5) * 100}%`)
      el.style.setProperty('--gy', `${(py + 0.5) * 100}%`)
    }
    const leave = () => {
      rx(0)
      ry(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  })
  return () => cleanups.forEach(fn => fn())
}

/** Buttons that lean towards the pointer. Call inside a gsap.context(). */
export function bindMagnetic(elements: HTMLElement[]): () => void {
  if (!finePointer()) return () => undefined
  const cleanups = elements.map(el => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect()
      x(((e.clientX - box.left) / box.width - 0.5) * 12)
      y(((e.clientY - box.top) / box.height - 0.5) * 10)
    }
    const leave = () => {
      x(0)
      y(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  })
  return () => cleanups.forEach(fn => fn())
}

/**
 * Lenis smooth scrolling for the whole admin, mounted once by the shell (it
 * survives client-side navigation). Same setup as the public site's
 * SmoothScroll: autoToggle pauses it while Radix overlays lock the page, and
 * scrollable panels keep native scrolling.
 */
export function useStudioSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    gsap.registerPlugin(ScrollTrigger)
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1, autoToggle: true, allowNestedScroll: true, stopInertiaOnNavigate: true })
    setLenisInstance(lenis)
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
      setLenisInstance(null)
    }
  }, [])
}
