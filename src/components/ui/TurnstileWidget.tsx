'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Renders a Cloudflare Turnstile widget ONLY when NEXT_PUBLIC_TURNSTILE_SITE_KEY
// is configured. When the key is absent (e.g. local dev) it renders nothing and
// the contact form works without a captcha — the server verifier bypasses too.
// The Cloudflare script (~600 KB with its challenge assets) is only fetched once
// the widget scrolls near the viewport, so it never weighs on the initial load.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  ready: (callback: () => void) => void
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export default function TurnstileWidget({
  onToken,
  className,
}: {
  onToken: (token: string | null) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  useEffect(() => { onTokenRef.current = onToken }, [onToken])

  useEffect(() => {
    if (!SITE_KEY) return
    const container = ref.current
    if (!container) return
    let disposed = false
    let widgetId: string | undefined
    let script: HTMLScriptElement | null = null
    let observer: IntersectionObserver | undefined

    const cleanup = () => {
      disposed = true
      observer?.disconnect()
      script?.removeEventListener('load', ready)
      if (widgetId !== undefined) window.turnstile?.remove(widgetId)
    }

    const render = () => {
      if (disposed || !window.turnstile || widgetId !== undefined) return
      widgetId = window.turnstile.render(container, {
        sitekey: SITE_KEY,
        // Follow the site theme (class on <html>), not the OS setting that
        // Turnstile's 'auto' reads, so it never renders a white box on dark.
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        callback: (token: string) => { if (!disposed) onTokenRef.current(token) },
        'expired-callback': () => { if (!disposed) onTokenRef.current(null) },
        'error-callback': () => { if (!disposed) onTokenRef.current(null) },
      })
    }
    const ready = () => window.turnstile?.ready(render)

    if (window.turnstile) {
      ready()
      return cleanup
    }

    const load = () => {
      script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
      if (!script) {
        script = document.createElement('script')
        script.src = SCRIPT_SRC
        script.async = true
        script.defer = true
        script.addEventListener('load', ready)
        document.head.appendChild(script)
      } else {
        script.addEventListener('load', ready)
      }
    }

    if (!('IntersectionObserver' in window)) {
      load()
      return cleanup
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer?.disconnect()
        load()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(container)
    return cleanup
  }, [])

  if (!SITE_KEY) return null
  // Reserve the widget's height (65px) so it doesn't shift the form when it renders.
  return <div ref={ref} className={cn('flex min-h-[65px] justify-center', className)} />
}
