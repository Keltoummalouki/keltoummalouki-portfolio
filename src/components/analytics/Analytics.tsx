import Script from 'next/script'
import { SITE_URL } from '@/features/seo/site'
import { readUmamiConfig, trackedHostnames } from '@/lib/analytics/umami'
import ClickTracking from './ClickTracking'

/**
 * Privacy-friendly analytics (Umami: no cookies, no personal data): page views,
 * including client-side navigations, plus the clicks marked with trackClick().
 * Renders nothing until NEXT_PUBLIC_UMAMI_WEBSITE_ID is set. Only the production
 * hostname reports, so local dev and preview deployments are never counted, and
 * Do Not Track is honored.
 */
export default function Analytics() {
  const config = readUmamiConfig(process.env)
  if (!config) return null

  return (
    <>
      <Script
        src={config.scriptUrl}
        data-website-id={config.websiteId}
        data-domains={trackedHostnames(SITE_URL)}
        data-do-not-track="true"
        strategy="afterInteractive"
      />
      <ClickTracking />
    </>
  )
}
