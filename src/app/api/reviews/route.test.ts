import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/reviews/queries', () => ({ getApprovedReviews: vi.fn() }))
import { getApprovedReviews } from '@/features/reviews/queries'
import { GET } from './route'

describe('public reviews endpoint', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns fresh reviews with caching disabled', async () => {
    const reviews = [{ id: 'review', name: 'Visitor', rating: 5, comment: 'Great work!', locale: 'en', date: '2026-11-08' }]
    vi.mocked(getApprovedReviews).mockResolvedValue(reviews)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ reviews })
    expect(getApprovedReviews).toHaveBeenCalledWith({ throwOnError: true })
  })

  it('distinguishes an outage from a genuinely empty review list', async () => {
    vi.mocked(getApprovedReviews).mockRejectedValue(new Error('Database unavailable'))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Unable to load reviews' })
  })
})
