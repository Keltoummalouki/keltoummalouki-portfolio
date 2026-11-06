// Click and conversion events, sent to Umami (no-ops while analytics is off,
// blocked, or the visitor opted out). Clicks are declared with trackClick()
// attributes, so they also work in Server Components; conversions call
// trackEvent() once a form has been sent.
//
// Our own `data-track` attributes, not Umami's `data-umami-event`: Umami
// cancels same-tab link clicks to send the event first, which would turn
// every tracked Next.js <Link> into a full page reload.

export type AnalyticsEvent =
  | 'project-case-study'
  | 'project-demo'
  | 'project-code'
  | 'cv-download'
  | 'contact-cta'
  | 'contact-link'
  | 'booking-click'
  | 'contact-form-sent'
  | 'lead-form-sent'

/** Event properties: where it happened (`from`), which project or contact channel. */
export type AnalyticsData = Record<string, string>

/** Which project a link opens and where it sits, recorded with its clicks. */
export type ProjectClick = { project: string; from: string }

export const TRACK_ATTRIBUTE = 'data-track'
const DATA_PREFIX = `${TRACK_ATTRIBUTE}-`

type TrackAttributes = Record<`data-track${string}`, string>

/** Spread on a link or button to record its clicks: `<a {...trackClick('contact-link', { channel: 'email' })}>`. */
export function trackClick(event: AnalyticsEvent, data: AnalyticsData = {}): TrackAttributes {
  const attributes: TrackAttributes = { [TRACK_ATTRIBUTE]: event }
  for (const [key, value] of Object.entries(data)) attributes[`${DATA_PREFIX}${key}`] = value
  return attributes
}

/** Event name and properties of an element marked with trackClick(), or null. */
export function readTrackedClick(element: Pick<Element, 'getAttribute' | 'getAttributeNames'>): {
  event: string
  data: AnalyticsData
} | null {
  const event = element.getAttribute(TRACK_ATTRIBUTE)
  if (!event) return null
  const data: AnalyticsData = {}
  for (const name of element.getAttributeNames()) {
    if (name.startsWith(DATA_PREFIX)) data[name.slice(DATA_PREFIX.length)] = element.getAttribute(name) ?? ''
  }
  return { event, data }
}

/** Records an event from code, e.g. after a form is sent. */
export function trackEvent(event: AnalyticsEvent, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return
  window.umami?.track(event, data)
}

declare global {
  interface Window {
    /** Umami's tracker API, present once its script has loaded. */
    umami?: { track: (event: string, data?: AnalyticsData) => void }
  }
}
