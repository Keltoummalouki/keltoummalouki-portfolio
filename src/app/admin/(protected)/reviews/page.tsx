import { OverviewMetrics } from '@/components/admin/Workspace'
import { Check, MessageSquareQuote, ShieldAlert, X } from 'lucide-react'
import StarRating from '@/components/reviews/StarRating'
import { EmptyState, FilterTabs, PageHeader, StatusBadge, DeleteButton } from '@/components/admin/ui'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { deleteReviewAction, updateReviewStatusAction } from '@/features/reviews/actions'
import { getReviewStatusCounts, listReviews, type AdminReview } from '@/features/reviews/queries'
import { REVIEW_STATUSES, reviewStatusSchema, type ReviewStatus } from '@/features/reviews/schema'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** One-click moderation buttons (Server Actions; no client JS needed). */
function StatusButton({
  review,
  status,
  filter,
  label,
  icon,
  variant = 'outline',
}: {
  review: AdminReview
  status: ReviewStatus
  filter?: ReviewStatus
  label: string
  icon: React.ReactNode
  variant?: 'default' | 'outline' | 'secondary'
}) {
  if (review.status === status) return null
  return (
    <form action={updateReviewStatusAction}>
      <input type="hidden" name="id" value={review.id} />
      <input type="hidden" name="status" value={status} />
      {filter && <input type="hidden" name="filter" value={filter} />}
      <FormStatusButton variant={variant} size="sm">
        {icon}
        {label}
      </FormStatusButton>
    </form>
  )
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const parsed = reviewStatusSchema.safeParse(status)
  const activeStatus = parsed.success ? parsed.data : undefined

  // The list throws if the reviews migration hasn't been applied yet; show a
  // clear notice instead of crashing the dashboard.
  let reviews: AdminReview[] = []
  let loadError: string | null = null
  try {
    reviews = await listReviews(activeStatus)
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'unknown error'
  }
  const counts = await getReviewStatusCounts()
  const total = REVIEW_STATUSES.reduce((sum, s) => sum + counts[s], 0)

  const tabs = [
    { key: 'all', label: 'All', count: total, href: '/admin/reviews', active: !activeStatus },
    ...REVIEW_STATUSES.map((s) => ({
      key: s,
      label: s,
      count: counts[s],
      href: `/admin/reviews?status=${s}`,
      active: s === activeStatus,
    })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Visitor reviews from the home page. Pending reviews stay hidden until you approve them."
      />
      <OverviewMetrics items={[{label:'All reviews',value:total,hint:'Feedback from your audience',href:'/admin/reviews'},{label:'Pending',value:counts.pending,hint:'Waiting for moderation',href:'/admin/reviews?status=pending'},{label:'Approved',value:counts.approved,hint:'Visible on your portfolio',href:'/admin/reviews?status=approved'},{label:'Rejected',value:counts.rejected,hint:'Hidden from visitors',href:'/admin/reviews?status=rejected'}]} />

      <FilterTabs tabs={tabs} ariaLabel="Filter reviews by status" />

      {loadError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Reviews could not be loaded ({loadError}). If this is a new environment, apply
          <code className="mx-1 rounded bg-background/60 px-1">supabase/migrations/20261004120000_reviews_and_faq.sql</code>
          first.
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title={activeStatus ? `No ${activeStatus} reviews` : 'No reviews yet'}
          description={
            activeStatus ? 'Try a different status filter.' : 'Reviews submitted on the home page will appear here.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{review.author_name}</span>
                    <StatusBadge status={review.status} />
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase text-muted-foreground">
                      {review.locale}
                    </span>
                  </div>
                  <StarRating value={review.rating} label={`${review.rating} out of 5`} />
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={review.created_at}>
                  {formatDate(review.created_at)}
                </time>
              </div>

              <p dir="auto" className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {review.comment}
              </p>
              {review.spam_reason && (
                <p className="mt-2 text-xs text-muted-foreground">Auto-flagged: {review.spam_reason}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <StatusButton
                  review={review}
                  status="approved"
                  filter={activeStatus}
                  label="Approve"
                  variant="default"
                  icon={<Check size={14} />}
                />
                <StatusButton review={review} status="rejected" filter={activeStatus} label="Reject" icon={<X size={14} />} />
                <StatusButton review={review} status="spam" filter={activeStatus} label="Spam" icon={<ShieldAlert size={14} />} />
                <form action={deleteReviewAction} className="ms-auto">
                  <input type="hidden" name="id" value={review.id} />
                  {activeStatus && <input type="hidden" name="filter" value={activeStatus} />}
                  <DeleteButton />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
