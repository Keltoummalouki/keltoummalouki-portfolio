import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/features/reviews/queries', () => ({ getReviewPage: vi.fn() }))
import { getReviewPage } from '@/features/reviews/queries'
import { GET } from './route'
const request = (query = '') => new Request(`https://example.com/api/reviews${query}`)
describe('public review browsing', () => {
  beforeEach(() => vi.resetAllMocks())
  it('passes validated pagination, filtering and sort to the query', async () => {
    const result = {reviews:[],total:120,page:20,pageSize:6,summary:{count:120,average:5,distribution:{1:0,2:0,3:0,4:0,5:120}}}
    vi.mocked(getReviewPage).mockResolvedValue(result)
    const response = await GET(request('?page=20&rating=5&sort=highest'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual(result)
    expect(getReviewPage).toHaveBeenCalledWith({page:20,rating:5,sort:'highest',throwOnError:true})
  })
  it.each(['?page=-1','?page=1.5','?page=Infinity','?rating=6','?sort=unknown'])('rejects invalid parameters %s', async query => {
    expect((await GET(request(query))).status).toBe(400)
    expect(getReviewPage).not.toHaveBeenCalled()
  })
  it('reports an outage instead of an empty collection', async () => {
    vi.mocked(getReviewPage).mockRejectedValue(new Error('offline'))
    expect((await GET(request())).status).toBe(503)
  })
})
