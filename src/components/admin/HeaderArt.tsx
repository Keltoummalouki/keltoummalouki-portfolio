'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '@/lib/motion/reduced-motion'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * The page's icon as a large solid tile on the right of the header: it flips
 * in (GSAP elastic), floats, and tilts in 3D towards the pointer anywhere over
 * the header. Thin orbit rings turn behind it (CSS). Decorative.
 */
export default function HeaderArt({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = root.current
    const tile = el?.querySelector<HTMLElement>('.admin-header-tile')
    const header = el?.closest<HTMLElement>('.admin-page-header')
    if (!el || !tile || !header || prefersReducedMotion()) return
    let ready = false
    const ctx = gsap.context(() => {
      gsap.set(tile, { transformPerspective: 700 })
      gsap.from(tile, { scale: 0.45, rotationY: -70, rotationX: 25, autoAlpha: 0, duration: 1.5, delay: 0.25, ease: 'elastic.out(1, 0.6)', onComplete: () => void (ready = true) })
      gsap.to(tile, { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.4 })
      const rx = gsap.quickTo(tile, 'rotationX', { duration: 0.8, ease: 'power3.out' })
      const ry = gsap.quickTo(tile, 'rotationY', { duration: 0.8, ease: 'power3.out' })
      const move = (e: PointerEvent) => {
        if (!ready || e.pointerType !== 'mouse') return
        const box = header.getBoundingClientRect()
        rx(-((e.clientY - box.top) / box.height - 0.5) * 26)
        ry(((e.clientX - box.left) / box.width - 0.5) * 34)
      }
      const leave = () => {
        if (!ready) return
        rx(0)
        ry(0)
      }
      header.addEventListener('pointermove', move)
      header.addEventListener('pointerleave', leave)
      return () => {
        header.removeEventListener('pointermove', move)
        header.removeEventListener('pointerleave', leave)
      }
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="admin-header-art" aria-hidden="true">
      <div className="admin-header-rings">
        <span />
        <span />
        <span />
      </div>
      <div className="admin-header-tile">{children}</div>
    </div>
  )
}
