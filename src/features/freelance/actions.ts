'use server'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { requireAdmin } from '@/features/auth/session'
import { notifyNewSubmission } from '@/features/submissions/notify'
import { reservePublicSubmission } from '@/features/submissions/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifyTurnstileToken } from '@/features/inbox/turnstile'
import { leadFormSchema, leadStatusSchema, type LeadSubmitState } from './schema'

function rawForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? '')
  return {
    name: text('name'),
    email: text('email'),
    company: text('company'),
    projectType: text('projectType'),
    budget: text('budget'),
    timeline: text('timeline'),
    contactPreference: text('contactPreference'),
    details: text('details'),
  }
}

function fieldErrorState(error: z.ZodError): LeadSubmitState {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !(key in errors)) errors[key] = issue.message
  }
  return { ok: false, error: 'invalid', errors }
}

/**
 * Public freelance inquiry. Validates with Zod, optionally verifies Turnstile,
 * reserves an IP-based submission slot, and inserts with the server-only
 * service role. No `.select()` / RETURNING — leads are never browser-readable.
 * Once the response is sent, the owner gets an alert unless the lead was
 * flagged as spam.
 */
export async function submitFreelanceLeadAction(
  _prev: LeadSubmitState,
  formData: FormData,
): Promise<LeadSubmitState> {
  const parsed = leadFormSchema.safeParse(rawForm(formData))
  if (!parsed.success) return fieldErrorState(parsed.error)

  const isHuman = await verifyTurnstileToken(String(formData.get('turnstileToken') ?? ''))
  if (!isHuman) return { ok: false, error: 'captcha' }

  const submissionGate = await reservePublicSubmission('freelance_lead')
  if (!submissionGate.ok) return { ok: false, error: submissionGate.error }

  const v = parsed.data
  // Generated here rather than read back, so the alert can link to the lead.
  const id = randomUUID()
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from('freelance_leads').insert({
      id,
      name: v.name,
      email: v.email,
      company: v.company,
      project_type: v.projectType,
      budget_range: v.budget,
      timeline: v.timeline,
      contact_preference: v.contactPreference,
      details: v.details,
      status: submissionGate.shouldMarkSpam ? 'spam' : 'new',
      ip_hash: submissionGate.ipHash,
      spam_reason: submissionGate.shouldMarkSpam ? 'ip_submission_threshold' : null,
    })
    if (error) {
      console.error('freelance_leads insert failed:', error.message)
      return { ok: false, error: 'server' }
    }
  } catch (error) {
    console.error(
      'freelance_leads insert failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return { ok: false, error: 'server' }
  }

  if (!submissionGate.shouldMarkSpam) {
    after(() => notifyNewSubmission({ kind: 'freelance_lead', id, ...v }))
  }

  return { ok: true }
}

/** Admin: move a lead along the pipeline. */
export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  const statusParse = leadStatusSchema.safeParse(formData.get('status'))
  if (!id || !statusParse.success) redirect('/admin/leads')

  const supabase = await createServerSupabaseClient()
  await supabase.from('freelance_leads').update({ status: statusParse.data }).eq('id', id)

  revalidatePath('/admin/leads')
  revalidatePath(`/admin/leads/${id}`)
  redirect(`/admin/leads/${id}`)
}
