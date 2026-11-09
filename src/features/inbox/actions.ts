'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { requireAdmin } from '@/features/auth/session'
import { notifyNewSubmission } from '@/features/submissions/notify'
import { reservePublicSubmission } from '@/features/submissions/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { contactMessageSchema, messageStatusSchema, type ContactFormState } from './schema'
import { verifyTurnstileToken } from './turnstile'

const CONTACT_FIELDS = ['name', 'email', 'message'] as const

/**
 * Public contact submission, the home page form's action (`useActionState`).
 * Works without JavaScript too: the form posts its fields here. Validates with
 * Zod, optionally verifies Turnstile, reserves an IP-based submission slot, and
 * inserts with the server-only service role. The browser never reads stored
 * messages, and errors are returned as coarse, non-leaking codes. Once the
 * response is sent, the owner gets an alert unless the message was flagged as
 * spam.
 */
export async function submitContactFormAction(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const text = (key: string) => String(formData.get(key) ?? '')
  const parsed = contactMessageSchema.safeParse({
    name: text('name'),
    email: text('email'),
    message: text('message'),
    topic: text('topic') || undefined,
  })
  if (!parsed.success) {
    const refused = new Set(parsed.error.issues.map((issue) => issue.path[0]))
    const errors = Object.fromEntries(CONTACT_FIELDS.filter((field) => refused.has(field)).map((field) => [field, true]))
    return { ok: false, error: 'invalid', errors }
  }

  const isHuman = await verifyTurnstileToken(text('turnstileToken') || text('cf-turnstile-response'))
  if (!isHuman) return { ok: false, error: 'captcha' }

  const submissionGate = await reservePublicSubmission('contact_message')
  if (!submissionGate.ok) return { ok: false, error: submissionGate.error }

  // Generated here rather than read back, so the alert can link to the message.
  const id = randomUUID()
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from('contact_messages').insert({
      id,
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: submissionGate.shouldMarkSpam ? 'spam' : 'new',
      ip_hash: submissionGate.ipHash,
      spam_reason: submissionGate.shouldMarkSpam ? 'ip_submission_threshold' : null,
    })
    if (error) {
      // Log server-side without the message body; never surface raw errors.
      console.error('contact_messages insert failed:', error.message)
      return { ok: false, error: 'server' }
    }
  } catch (error) {
    console.error(
      'contact_messages insert failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return { ok: false, error: 'server' }
  }

  if (!submissionGate.shouldMarkSpam) {
    after(() => notifyNewSubmission({ kind: 'contact_message', id, ...parsed.data }))
  }

  return { ok: true }
}

/** Admin: change a message's workflow status. */
export async function updateMessageStatusAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  const statusParse = messageStatusSchema.safeParse(formData.get('status'))
  if (!id || !statusParse.success) redirect('/admin/inbox')

  const supabase = await createServerSupabaseClient()
  await supabase.from('contact_messages').update({ status: statusParse.data }).eq('id', id)

  revalidatePath('/admin/inbox')
  revalidatePath(`/admin/inbox/${id}`)
  redirect(`/admin/inbox/${id}`)
}
