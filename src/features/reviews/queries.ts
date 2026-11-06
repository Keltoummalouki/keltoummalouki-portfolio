import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { PUBLIC_REVIEW_COLUMNS, toPublicReview, type PublicReviewRow } from './map'
import { REVIEW_STATUSES, type PublicReview, type ReviewStatus } from './schema'

// Columns are always listed explicitly: visitors (anon) and admins only hold
// column-level SELECT on reviews, so `select('*')` would be rejected.

/** Newest-first cap for the public testimonials (browsed one at a time client-side). */
const PUBLIC_REVIEW_LIMIT = 200

/**
 * Approved reviews for the public site. Filters on status explicitly (on top of
 * RLS) so an admin browsing the site never sees pending reviews, and never
 * throws: the page renders without reviews if the table is missing/unreachable.
 */
export async function getApprovedReviews(): Promise<PublicReview[]> {
  try {
    const supabase = createPublicSupabaseClient()
    const { data, error } = await supabase
      .from('reviews')
      .select(PUBLIC_REVIEW_COLUMNS)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(PUBLIC_REVIEW_LIMIT)
    // PostgREST errors are plain objects, not Error instances: wrap so the log shows the message.
    if (error) throw new Error(error.message)
    return ((data ?? []) as PublicReviewRow[]).map(toPublicReview)
  } catch (error) {
    console.error('reviews: loading approved reviews failed:', error instanceof Error ? error.message : error)
    return []
  }
}

const ADMIN_REVIEW_COLUMNS =
  'id, author_name, rating, comment, locale, status, spam_reason, approved_at, created_at, updated_at' as const

export interface AdminReview {
  id: string
  author_name: string
  rating: number
  comment: string
  locale: string
  status: ReviewStatus
  spam_reason: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

/** Admin moderation list (admin RLS context). */
export async function listReviews(status?: ReviewStatus): Promise<AdminReview[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase.from('reviews').select(ADMIN_REVIEW_COLUMNS).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AdminReview[]
}

/**
 * Per-status counts for the admin nav badge and filter tabs. Never throws, so
 * the dashboard keeps working before the reviews migration is applied.
 */
export async function getReviewStatusCounts(): Promise<Record<ReviewStatus, number>> {
  const counts = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0])) as Record<ReviewStatus, number>
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.from('reviews').select('status')
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const status = row.status as ReviewStatus
      if (status in counts) counts[status] += 1
    }
  } catch (error) {
    console.error('reviews: counting statuses failed:', error instanceof Error ? error.message : error)
  }
  return counts
}
