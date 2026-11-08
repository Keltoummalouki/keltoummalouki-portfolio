import { getApprovedReviews } from '@/features/reviews/queries'

// Reviews must stay fresh even when the home page is served from ISR/CDN cache.
export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const reviews = await getApprovedReviews({ throwOnError: true })
    return Response.json({ reviews }, { headers })
  } catch {
    return Response.json({ error: 'Unable to load reviews' }, { status: 503, headers })
  }
}
