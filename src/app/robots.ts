import type { MetadataRoute } from 'next'
import { SITE_URL, absoluteUrl, isIndexable } from '@/features/seo/site'

// /robots.txt. Production: everything public is crawlable (admin, API and
// Cloudflare's /cdn-cgi/ are not). AI answer engines and search-assistant
// crawlers are welcomed explicitly, so a future blanket rule can't silently
// hide the site from AI search. Preview/development deployments block all
// crawling.

// /cdn-cgi/ is Cloudflare's own endpoint, not site content. Its email
// obfuscation rewrites mailto: links to /cdn-cgi/l/email-protection, which
// returns 4xx to crawlers; Cloudflare recommends disallowing the whole path.
const DISALLOW = ['/admin', '/api', '/cdn-cgi/']

/** Search-answer and AI crawlers allowed explicitly (same rules as everyone). */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
]

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  }
}
