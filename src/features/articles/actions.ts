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
  ARTICLE_LOCALES,
  articleFormSchema,
  type ArticleFormState,
  type ArticleFormValues,
} from './schema'

function rawForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? '')
  const translation = (loc: string) => ({
    slug: text(`${loc}.slug`),
    title: text(`${loc}.title`),
    excerpt: text(`${loc}.excerpt`),
    bodyMarkdown: text(`${loc}.body`),
    seoTitle: text(`${loc}.seoTitle`),
    seoDescription: text(`${loc}.seoDescription`),
  })
  return {
    status: text('status'),
    featured: formData.get('featured') === 'on',
    coverImageUrl: text('coverImageUrl'),
    authorName: text('authorName'),
    publishedAt: text('publishedAt'),
    translations: {
      fr: translation('fr'),
      en: translation('en'),
      ar: translation('ar'),
    },
  }
}

function fieldErrorState(error: z.ZodError): ArticleFormState {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !(key in errors)) errors[key] = issue.message
  }
  return { ok: false, message: 'Please fix the highlighted fields.', errors }
}

function friendlyDbMessage(error: PostgrestError | null): string {
  if (error?.code === '23505') return 'That slug is already in use. Choose another.'
  return 'Could not save the article. Please try again.'
}

function translationRows(articleId: string, translations: ArticleFormValues['translations']) {
  const rows: {
    article_id: string
    locale: string
    slug: string
    title: string
    excerpt: string | null
    body_markdown: string | null
    seo_title: string | null
    seo_description: string | null
  }[] = []
  for (const locale of ARTICLE_LOCALES) {
    const tr = translations[locale]
    if (tr.title) {
      rows.push({
        article_id: articleId,
        locale,
        slug: tr.slug,
        title: tr.title,
        excerpt: tr.excerpt,
        body_markdown: tr.bodyMarkdown,
        seo_title: tr.seoTitle,
        seo_description: tr.seoDescription,
      })
    }
  }
  return rows
}

function resolvePublishedAt(values: ArticleFormValues): string | null {
  if (values.status === 'published') {
    return values.publishedAt ?? new Date().toISOString()
  }
  return values.publishedAt
}

function revalidateBlog() {
  // Public pages are cached: purge them so the change (blog, RSS, home) shows now.
  revalidatePublicSite()
  revalidatePath('/admin/blog')
}

export async function createArticleAction(
  _prev: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  await requireAdmin()

  const parsed = articleFormSchema.safeParse(rawForm(formData))
  if (!parsed.success) return fieldErrorState(parsed.error)
  const v = parsed.data

  const supabase = await createServerSupabaseClient()
  let coverImageUrl = v.coverImageUrl
  try {
    coverImageUrl = (await uploadImageFromForm(supabase, formData, 'coverImageFile', 'blog')) ?? coverImageUrl
  } catch {
    return { ok: false, message: 'Could not upload the cover image. Use JPG, PNG, or WebP up to 5 MB.' }
  }

  const { data: created, error } = await supabase
    .from('articles')
    .insert({
      slug: v.translations.fr.slug, // base slug = French slug
      status: v.status,
      featured: v.featured,
      cover_image_url: coverImageUrl,
      author_name: v.authorName,
      published_at: resolvePublishedAt(v),
    })
    .select('id')
    .single()
  if (error || !created) return { ok: false, message: friendlyDbMessage(error) }

  const rows = translationRows(created.id, v.translations)
  if (rows.length > 0) {
    const { error: trError } = await supabase.from('article_translations').insert(rows)
    if (trError) {
      await supabase.from('articles').delete().eq('id', created.id)
      return { ok: false, message: friendlyDbMessage(trError) }
    }
  }

  revalidateBlog()
  redirect('/admin/blog')
}

export async function updateArticleAction(
  id: string,
  _prev: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  await requireAdmin()

  const parsed = articleFormSchema.safeParse(rawForm(formData))
  if (!parsed.success) return fieldErrorState(parsed.error)
  const v = parsed.data

  const supabase = await createServerSupabaseClient()
  let coverImageUrl = v.coverImageUrl
  try {
    coverImageUrl = (await uploadImageFromForm(supabase, formData, 'coverImageFile', 'blog')) ?? coverImageUrl
  } catch {
    return { ok: false, message: 'Could not upload the cover image. Use JPG, PNG, or WebP up to 5 MB.' }
  }

  const { error } = await supabase
    .from('articles')
    .update({
      slug: v.translations.fr.slug,
      status: v.status,
      featured: v.featured,
      cover_image_url: coverImageUrl,
      author_name: v.authorName,
      published_at: resolvePublishedAt(v),
    })
    .eq('id', id)
  if (error) return { ok: false, message: friendlyDbMessage(error) }

  for (const locale of ARTICLE_LOCALES) {
    const tr = v.translations[locale]
    if (tr.title) {
      const { error: upError } = await supabase.from('article_translations').upsert(
        {
          article_id: id,
          locale,
          slug: tr.slug,
          title: tr.title,
          excerpt: tr.excerpt,
          body_markdown: tr.bodyMarkdown,
          seo_title: tr.seoTitle,
          seo_description: tr.seoDescription,
        },
        { onConflict: 'article_id,locale' },
      )
      if (upError) return { ok: false, message: friendlyDbMessage(upError) }
    } else {
      const { error: delError } = await supabase
        .from('article_translations')
        .delete()
        .eq('article_id', id)
        .eq('locale', locale)
      if (delError) return { ok: false, message: friendlyDbMessage(delError) }
    }
  }

  revalidateBlog()
  redirect('/admin/blog')
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  if (!id) redirect('/admin/blog')

  const supabase = await createServerSupabaseClient()
  await supabase.from('articles').delete().eq('id', id) // cascade removes translations

  revalidateBlog()
  redirect('/admin/blog')
}
