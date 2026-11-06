'use server'

import { revalidatePath } from 'next/cache'
import { revalidatePublicSite } from '@/lib/revalidate-public'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/features/auth/session'
import { verifyTurnstileToken } from '@/features/inbox/turnstile'
import { reservePublicSubmission } from '@/features/submissions/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  reviewFormSchema,
  reviewStatusSchema,
  type ReviewFieldError,
  type ReviewSubmitState,
} from './schema'

const FIELDS = ['name', 'rating', 'comment'] as const

function revalidatePublicHome() {
  revalidatePublicSite()
}

/**
 * Public review submission. Same flow as contact messages and freelance leads:
 * Zod -> Turnstile -> IP rate limit -> service-role insert. Reviews are stored
 * as `pending` (or `spam` past the IP threshold) and only shown once an admin
 * approves them. No RETURNING: the browser never reads unapproved rows.
 */
export async function submitReviewAction(
  _prev: ReviewSubmitState,
  formData: FormData,
): Promise<ReviewSubmitState> {
  const text = (key: string) => String(formData.get(key) ?? '')
  const parsed = reviewFormSchema.safeParse({
    name: text('name'),
    rating: text('rating'),
    comment: text('comment'),
    locale: text('locale'),
  })
  if (!parsed.success) {
    const errors: ReviewSubmitState['errors'] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (typeof field === 'string' && (FIELDS as readonly string[]).includes(field)) {
        const key = field as (typeof FIELDS)[number]
        errors[key] ??= issue.message as ReviewFieldError
      }
    }
    return { ok: false, error: 'invalid', errors }
  }

  const isHuman = await verifyTurnstileToken(text('turnstileToken'))
  if (!isHuman) return { ok: false, error: 'captcha' }

  const gate = await reservePublicSubmission('review')
  if (!gate.ok) return { ok: false, error: gate.error }

  const v = parsed.data
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from('reviews').insert({
      author_name: v.name,
      rating: v.rating,
      comment: v.comment,
      locale: v.locale,
      status: gate.shouldMarkSpam ? 'spam' : 'pending',
      ip_hash: gate.ipHash,
      spam_reason: gate.shouldMarkSpam ? 'ip_submission_threshold' : null,
    })
    if (error) {
      console.error('reviews insert failed:', error.message)
      return { ok: false, error: 'server' }
    }
  } catch (error) {
    console.error('reviews insert failed:', error instanceof Error ? error.message : 'unknown error')
    return { ok: false, error: 'server' }
  }

  return { ok: true }
}

function adminRedirect(formData: FormData): never {
  const status = reviewStatusSchema.safeParse(formData.get('filter'))
  redirect(status.success ? `/admin/reviews?status=${status.data}` : '/admin/reviews')
}

/** Admin: approve / reject / mark as spam. */
export async function updateReviewStatusAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  const status = reviewStatusSchema.safeParse(formData.get('status'))
  if (!id || !status.success) adminRedirect(formData)

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('reviews').update({ status: status.data }).eq('id', id)
  if (error) console.error('reviews status update failed:', error.message)

  revalidatePath('/admin/reviews')
  revalidatePublicHome()
  adminRedirect(formData)
}

/** Admin: permanently delete a review. */
export async function deleteReviewAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  if (id) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) console.error('reviews delete failed:', error.message)
  }

  revalidatePath('/admin/reviews')
  revalidatePublicHome()
  adminRedirect(formData)
}
