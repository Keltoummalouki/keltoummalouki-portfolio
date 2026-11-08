'use client'

import { use, useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import styles from './ProjectWindow.module.css'

/** Size the demo is laid out at (its desktop design), then scaled into the frame. */
export const LIVE_VIEWPORT_WIDTH = 1440
export const LIVE_VIEWPORT_HEIGHT = 900
/** Lets a demo's own preloader finish before it replaces the cover. */
const LIVE_REVEAL_DELAY_MS = 800

/**
 * Whether a demo should be running, and whether it is ready to replace the cover.
 * Desktop only, and not under reduced motion or Save-Data. `wanted` is the
 * caller's own condition (the frame is near the viewport, the panel has settled).
 */
export function useLiveFrame(url: string, wanted: boolean) {
  const [capable, setCapable] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)

  // This site's own CSP can still refuse the frame (e.g. a server running an
  // older next.config). The browser then fires `load` on its placeholder page
  // anyway, so watch for the violation and keep the cover instead.
  useEffect(() => {
    const origin = new URL(url).origin
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.effectiveDirective === 'frame-src' && event.blockedURI.startsWith(origin)) setBlocked(true)
    }
    document.addEventListener('securitypolicyviolation', onViolation)
    return () => document.removeEventListener('securitypolicyviolation', onViolation)
  }, [url])

  useEffect(() => {
    const wide = matchMedia('(min-width: 900px)')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    const update = () => setCapable(wide.matches && !reduce.matches && !saveData)
    update()
    wide.addEventListener('change', update)
    reduce.addEventListener('change', update)
    return () => {
      wide.removeEventListener('change', update)
      reduce.removeEventListener('change', update)
    }
  }, [])

  const mounted = capable && wanted && !blocked
  useEffect(() => {
    if (mounted) return
    setLoaded(false)
    setReady(false)
  }, [mounted])
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => setReady(true), LIVE_REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [loaded])

  return { mounted, ready, onLoad: () => setLoaded(true) }
}

/** The demo's iframe. Never interactive: its wrapper is `inert`, so the page keeps scrolling over it. */
export function LiveFrame({ url, title, onLoad, style }: {
  url: string
  title: string
  onLoad: () => void
  style?: CSSProperties
}) {
  return (
    <iframe
      src={url}
      title={title}
      tabIndex={-1}
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={onLoad}
      style={style}
    />
  )
}

/** Shows the demo once `framable` (streamed by the server, see getFramableDemos) says it may be framed. */
export function FramableLivePreview({ framable, url, title }: { framable: Promise<string[]>; url: string; title: string }) {
  return use(framable).includes(url) ? <LivePreview url={url} title={title} /> : null
}

/**
 * The live demo inside a project window, scaled to fit. It loads once the window
 * nears the viewport and fades in over the cover.
 */
export default function LivePreview({ url, title }: { url: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [scale, setScale] = useState(0)
  const { mounted, ready, onLoad } = useLiveFrame(url, near && scale > 0)

  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) setNear(true) }, { rootMargin: '300px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale((entry?.contentRect.width ?? 0) / LIVE_VIEWPORT_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} inert className={cn(styles.live, ready && styles.liveReady)}>
      {mounted && <LiveFrame url={url} title={title} onLoad={onLoad} style={{ transform: `scale(${scale})` }} />}
    </div>
  )
}
