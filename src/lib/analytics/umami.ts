// Umami analytics settings (cookie-less, no personal data). Dependency-free on
// purpose: next.config.ts imports it so the CSP only allows the tracker's
// origins when analytics is configured.

/** Umami Cloud serves the tracker here; it sends events to UMAMI_CLOUD_COLLECT. */
export const UMAMI_CLOUD_SCRIPT = 'https://cloud.umami.is/script.js'
const UMAMI_CLOUD_COLLECT = 'https://gateway.umami.is'

export interface UmamiConfig {
  websiteId: string
  scriptUrl: string
  /** Allowed in CSP script-src. */
  scriptOrigin: string
  /** Where the tracker sends page views and events: allowed in CSP connect-src. */
  collectOrigin: string
}

/**
 * Analytics settings from the environment, or null while analytics is off:
 * no website ID, or a script URL that is not https.
 */
export function readUmamiConfig(env: Record<string, string | undefined>): UmamiConfig | null {
  const websiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim()
  if (!websiteId) return null

  let url: URL
  try {
    url = new URL(env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || UMAMI_CLOUD_SCRIPT)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  // A self-hosted Umami serves the script and collects events on its own origin.
  const cloud = url.origin === new URL(UMAMI_CLOUD_SCRIPT).origin
  return {
    websiteId,
    scriptUrl: url.href,
    scriptOrigin: url.origin,
    collectOrigin: cloud ? UMAMI_CLOUD_COLLECT : url.origin,
  }
}

/** Hostnames the tracker may report from (`data-domains`): the site's, with and without www. */
export function trackedHostnames(siteUrl: string): string {
  const hostname = new URL(siteUrl).hostname
  const bare = hostname.replace(/^www\./, '')
  return bare === hostname ? hostname : `${hostname},${bare}`
}
