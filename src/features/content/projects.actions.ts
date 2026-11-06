'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { revalidatePublicSite } from '@/lib/revalidate-public'
import { redirect } from 'next/navigation'
import type { PostgrestError } from '@supabase/supabase-js'
import { requireAdmin } from '@/features/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { uploadImageFromForm } from '@/features/cms/media'
import {
  PROJECT_LOCALES,
  newSkillNameSchema,
  projectFormInput,
  projectFormSchema,
  type CreateSkillResult,
  type ProjectFormState,
  type ProjectFormValues,
} from './projects.schema'

function fieldErrorState(error: z.ZodError): ProjectFormState {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !(key in errors)) errors[key] = issue.message
  }
  return { ok: false, message: 'Please fix the highlighted fields.', errors }
}

function friendlyDbMessage(error: PostgrestError | null): string {
  if (error?.code === '23505') return 'A project with this slug already exists.'
  return 'Could not save the project. Please try again.'
}

type TranslationRow = {
  project_id: string
  locale: string
  title: string
  description: string | null
  body_markdown: string | null
}

function translationRow(
  projectId: string,
  locale: string,
  tr: ProjectFormValues['translations'][keyof ProjectFormValues['translations']],
): TranslationRow {
  return {
    project_id: projectId,
    locale,
    title: tr.title,
    description: tr.description,
    body_markdown: tr.bodyMarkdown,
  }
}

function translationRows(projectId: string, translations: ProjectFormValues['translations']) {
  const rows: TranslationRow[] = []
  for (const locale of PROJECT_LOCALES) {
    const tr = translations[locale]
    if (tr.title) rows.push(translationRow(projectId, locale, tr))
  }
  return rows
}

function revalidateProjects() {
  // Public pages are cached: purge them so the home page, /projects and the
  // case studies show the change now.
  revalidatePublicSite()
  revalidatePath('/admin/projects')
}

/**
 * Replace the project's linked technical skills. Delete-then-insert keeps the
 * join table in sync with the picker selection and stores the chosen order as
 * sort_order. Returns a PostgrestError on failure (caller decides how to react).
 */
async function syncProjectSkills(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  projectId: string,
  skillIds: string[],
): Promise<PostgrestError | null> {
  const { error: delError } = await supabase
    .from('project_skills')
    .delete()
    .eq('project_id', projectId)
  if (delError) return delError

  if (skillIds.length === 0) return null

  const rows = skillIds.map((skillId, index) => ({
    project_id: projectId,
    skill_id: skillId,
    sort_order: index,
  }))
  const { error: insError } = await supabase.from('project_skills').insert(rows)
  return insError
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireAdmin()

  const parsed = projectFormSchema.safeParse(projectFormInput(formData))
  if (!parsed.success) return fieldErrorState(parsed.error)
  const v = parsed.data

  const supabase = await createServerSupabaseClient()
  let coverImageUrl = v.coverImageUrl
  try {
    coverImageUrl = (await uploadImageFromForm(supabase, formData, 'coverImageFile', 'project')) ?? coverImageUrl
  } catch {
    return { ok: false, message: 'Could not upload the cover image. Use JPG, PNG, or WebP up to 5 MB.' }
  }

  const { data: created, error } = await supabase
    .from('projects')
    .insert({
      slug: v.slug,
      status: v.status,
      featured: v.featured,
      sort_order: v.sortOrder,
      repo_url: v.repoUrl,
      demo_url: v.demoUrl,
      cover_image_url: coverImageUrl,
      started_at: v.startedAt,
    })
    .select('id')
    .single()
  if (error || !created) return { ok: false, message: friendlyDbMessage(error) }

  const rows = translationRows(created.id, v.translations)
  if (rows.length > 0) {
    const { error: trError } = await supabase.from('project_translations').insert(rows)
    if (trError) {
      // Don't leave a project with no translations behind.
      await supabase.from('projects').delete().eq('id', created.id)
      return { ok: false, message: friendlyDbMessage(trError) }
    }
  }

  const skillError = await syncProjectSkills(supabase, created.id, v.skillIds)
  if (skillError) {
    await supabase.from('projects').delete().eq('id', created.id)
    return { ok: false, message: friendlyDbMessage(skillError) }
  }

  revalidateProjects()
  redirect('/admin/projects')
}

export async function updateProjectAction(
  id: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireAdmin()

  const parsed = projectFormSchema.safeParse(projectFormInput(formData))
  if (!parsed.success) return fieldErrorState(parsed.error)
  const v = parsed.data

  const supabase = await createServerSupabaseClient()
  let coverImageUrl = v.coverImageUrl
  try {
    coverImageUrl = (await uploadImageFromForm(supabase, formData, 'coverImageFile', 'project')) ?? coverImageUrl
  } catch {
    return { ok: false, message: 'Could not upload the cover image. Use JPG, PNG, or WebP up to 5 MB.' }
  }

  // tech_stack is intentionally not written here: new projects use linked
  // skills, while any legacy tech_stack value is preserved for fallback.
  const { error } = await supabase
    .from('projects')
    .update({
      slug: v.slug,
      status: v.status,
      featured: v.featured,
      sort_order: v.sortOrder,
      repo_url: v.repoUrl,
      demo_url: v.demoUrl,
      cover_image_url: coverImageUrl,
      started_at: v.startedAt,
    })
    .eq('id', id)
  if (error) return { ok: false, message: friendlyDbMessage(error) }

  const skillError = await syncProjectSkills(supabase, id, v.skillIds)
  if (skillError) return { ok: false, message: friendlyDbMessage(skillError) }

  // Sync translations: upsert locales with a title, remove locales left blank.
  for (const locale of PROJECT_LOCALES) {
    const tr = v.translations[locale]
    if (tr.title) {
      const { error: upError } = await supabase
        .from('project_translations')
        .upsert(translationRow(id, locale, tr), { onConflict: 'project_id,locale' })
      if (upError) return { ok: false, message: friendlyDbMessage(upError) }
    } else {
      const { error: delError } = await supabase
        .from('project_translations')
        .delete()
        .eq('project_id', id)
        .eq('locale', locale)
      if (delError) return { ok: false, message: friendlyDbMessage(delError) }
    }
  }

  revalidateProjects()
  redirect('/admin/projects')
}

/**
 * Inline creation of a *technical* skill from the project form. The new skill is
 * inserted as skill_type = 'technical' and status = 'published' so it shows up in
 * the public skills section and at /admin/skills, then returned to the caller so
 * the picker can select it immediately. Soft skills can never be created here.
 */
export async function createTechnicalSkillAction(name: string): Promise<CreateSkillResult> {
  await requireAdmin()

  const parsed = newSkillNameSchema.safeParse(name)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid skill name.' }
  }

  const supabase = await createServerSupabaseClient()

  // Reuse an existing technical skill with the same name (case-insensitive) so
  // the picker never creates duplicates, which would otherwise collide elsewhere.
  const { data: existingRows } = await supabase
    .from('skills')
    .select('id, name, icon, image_url')
    .eq('skill_type', 'technical')
  const match = (existingRows ?? []).find(
    (skill) => skill.name.trim().toLowerCase() === parsed.data.toLowerCase(),
  )
  if (match) {
    return {
      ok: true,
      skill: { id: match.id, name: match.name, icon: match.icon, imageUrl: match.image_url },
    }
  }

  const { data, error } = await supabase
    .from('skills')
    .insert({ name: parsed.data, skill_type: 'technical', status: 'published' })
    .select('id, name, icon, image_url')
    .single()
  if (error || !data) {
    return { ok: false, error: 'Could not create the skill. Please try again.' }
  }

  // Surface the new skill on the public skills section and the skills dashboard.
  revalidatePath('/admin/skills')
  revalidatePublicSite()

  return {
    ok: true,
    skill: { id: data.id, name: data.name, icon: data.icon, imageUrl: data.image_url },
  }
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  if (!id) redirect('/admin/projects')

  const supabase = await createServerSupabaseClient()
  // ON DELETE CASCADE removes the project_translations rows.
  await supabase.from('projects').delete().eq('id', id)

  revalidateProjects()
  redirect('/admin/projects')
}
