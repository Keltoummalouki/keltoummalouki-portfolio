import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { PUBLIC_REVIEW_COLUMNS, toPublicReview, type PublicReviewRow } from './map'
import { REVIEW_STATUSES, type ReviewStatus } from './schema'
import { REVIEW_PAGE_SIZE, type ReviewPage, type ReviewSort } from './browse'
import { summarizeReviews } from './map'

export async function getReviewPage({ page = 1, rating = 0, sort = 'newest', throwOnError = false }: {
  page?: number; rating?: number; sort?: ReviewSort; throwOnError?: boolean
} = {}): Promise<ReviewPage> {
  try {
    const db = createPublicSupabaseClient()
    // Counts cover the entire approved collection, not just the current page.
    const counts = await Promise.all([1, 2, 3, 4, 5].map(async (star) => {
      const { count, error } = await db.from('reviews').select('id', { count: 'exact', head: true })
        .eq('status', 'approved').eq('rating', star)
      if (error) throw new Error(error.message)
      return count ?? 0
    }))
    const count = counts.reduce((a, b) => a + b, 0)
    const total = rating ? counts[rating - 1] : count
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE)))
    let query = db.from('reviews').select(PUBLIC_REVIEW_COLUMNS).eq('status', 'approved')
    if (rating) query = query.eq('rating', rating)
    if (sort !== 'newest') query = query.order('rating', { ascending: sort === 'lowest' })
    const { data, error } = await query.order('approved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((currentPage - 1) * REVIEW_PAGE_SIZE, currentPage * REVIEW_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    return {
      reviews: ((data ?? []) as PublicReviewRow[]).map(toPublicReview), total,
      page: currentPage, pageSize: REVIEW_PAGE_SIZE,
      summary: { count, average: count ? Math.round(counts.reduce((sum, n, i) => sum + n * (i + 1), 0) / count * 10) / 10 : 0,
        distribution: { 1: counts[0], 2: counts[1], 3: counts[2], 4: counts[3], 5: counts[4] } },
    }
  } catch (error) {
    console.error('reviews: browsing failed:', error instanceof Error ? error.message : error)
    if (throwOnError) throw error
    return { reviews: [], summary: summarizeReviews([]), total: 0, page: 1, pageSize: REVIEW_PAGE_SIZE }
  }
}

// Columns are always listed explicitly: visitors (anon) and admins only hold
// column-level SELECT on reviews, so `select('*')` would be rejected.

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
