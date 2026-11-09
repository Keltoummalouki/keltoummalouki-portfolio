import type { PublicReview } from './schema'
import type { ReviewSummary } from './map'

export const REVIEW_PAGE_SIZE = 6
export type ReviewSort = 'newest' | 'highest' | 'lowest'
export interface ReviewPage {
  reviews: PublicReview[]
  summary: ReviewSummary
  total: number
  page: number
  pageSize: number
}
export function parseReviewFilters(params: URLSearchParams) {
  const page = Number(params.get('page') ?? 1)
  const rating = Number(params.get('rating') ?? 0)
  const sort = params.get('sort') ?? 'newest'
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
    !Number.isInteger(rating) || rating < 0 || rating > 5 ||
    !['newest', 'highest', 'lowest'].includes(sort)) return null
  return { page, rating, sort: sort as ReviewSort }
}
