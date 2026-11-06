'use client'

import { useEffect } from 'react'
import { TRACK_ATTRIBUTE, readTrackedClick } from '@/lib/analytics/events'

/**
 * Sends clicks on elements marked with trackClick() to Umami. It only listens
 * (capture phase, so stopPropagation elsewhere can't hide a click) and never
 * cancels the click: links keep their client-side navigation and smooth scroll.
 */
export default function ClickTracking() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest(`[${TRACK_ATTRIBUTE}]`) : null
      const click = element && readTrackedClick(element)
      if (click) window.umami?.track(click.event, click.data)
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  return null
}
