import { getReviewPage } from '@/features/reviews/queries'
import { parseReviewFilters } from '@/features/reviews/browse'

// Reviews must stay fresh even when the home page is served from ISR/CDN cache.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const filters = parseReviewFilters(new URL(request.url).searchParams)
  if (!filters) return Response.json({ error: 'Invalid review filters' }, { status: 400, headers })
  try {
    const result = await getReviewPage({ ...filters, throwOnError: true })
    return Response.json(result, { headers })
  } catch {
    return Response.json({ error: 'Unable to load reviews' }, { status: 503, headers })
  }
}
