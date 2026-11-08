'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AdminSelectField, CheckboxField, DatePickerField } from '@/components/admin/AdminFormControls'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import MarkdownEditor from '@/components/admin/MarkdownEditor'
import {
  ARTICLE_LOCALES,
  ARTICLE_STATUSES,
  DEFAULT_AUTHOR_NAME,
  type ArticleFormState,
  type ArticleLocale,
  type ArticleStatus,
} from '@/features/articles/schema'

interface TranslationDefaults {
  slug: string
  title: string
  excerpt: string
  body: string
  seoTitle: string
  seoDescription: string
}

export interface ArticleFormDefaults {
  status: ArticleStatus
  featured: boolean
  coverImageUrl: string
  authorName: string
  publishedAt: string
  translations: Record<ArticleLocale, TranslationDefaults>
}

interface ArticleFormProps {
  action: (state: ArticleFormState, formData: FormData) => Promise<ArticleFormState>
  submitLabel: string
  defaultValues?: ArticleFormDefaults
}

const emptyTranslation: TranslationDefaults = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  seoTitle: '',
  seoDescription: '',
}

const EMPTY: ArticleFormDefaults = {
  status: 'draft',
  featured: false,
  coverImageUrl: '',
  authorName: DEFAULT_AUTHOR_NAME,
  publishedAt: '',
  translations: { fr: emptyTranslation, en: emptyTranslation, ar: emptyTranslation },
}

const LOCALE_LABELS: Record<ArticleLocale, string> = { fr: 'Français', en: 'English', ar: 'العربية' }

const field =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-[invalid=true]:border-destructive'
const labelClass = 'text-sm font-medium text-foreground'

/**
 * Author chooser: defaults to the site owner, with a "Custom author…" option for
 * the occasional guest byline. A single hidden `authorName` carries the resolved
 * value to the Server Action, so the rest of the form is unchanged.
 */
function AuthorField({ defaultAuthor }: { defaultAuthor: string }) {
  const startsCustom = defaultAuthor !== '' && defaultAuthor !== DEFAULT_AUTHOR_NAME
  const [mode, setMode] = useState<'default' | 'custom'>(startsCustom ? 'custom' : 'default')
  const [custom, setCustom] = useState(startsCustom ? defaultAuthor : '')
  const resolved = mode === 'default' ? DEFAULT_AUTHOR_NAME : custom

  return (
    <div className="space-y-1.5">
      <AdminSelectField
        id="authorMode"
        value={mode}
        label="Author"
        options={[
          { value: 'default', label: DEFAULT_AUTHOR_NAME, description: 'Use me as the author' },
          { value: 'custom', label: 'Custom author…', description: 'Guest or collaborator byline' },
        ]}
        onValueChange={(next) => setMode(next as 'default' | 'custom')}
      />
      {mode === 'custom' && (
        <input
          aria-label="Custom author name"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Author name"
          className={field}
        />
      )}
      <input type="hidden" name="authorName" value={resolved} />
    </div>
  )
}

export default function ArticleForm({ action, submitLabel, defaultValues }: ArticleFormProps) {
  const dv = defaultValues ?? EMPTY
  const [state, formAction, pending] = useActionState<ArticleFormState, FormData>(action, {})
  const [activeLocale, setActiveLocale] = useState<ArticleLocale>('fr')
  const [titles, setTitles] = useState<Record<ArticleLocale, string>>({
    fr: dv.translations.fr.title,
    en: dv.translations.en.title,
    ar: dv.translations.ar.title,
  })
  const [bodies, setBodies] = useState<Record<ArticleLocale, string>>({
    fr: dv.translations.fr.body,
    en: dv.translations.en.body,
    ar: dv.translations.ar.body,
  })

  const err = (key: string) => state.errors?.[key]

  return (
    <form action={formAction} className="admin-editor-form space-y-6" noValidate>
      {state.message && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-foreground">Article</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <AdminSelectField
              id="status"
              label="Status"
              name="status"
              options={ARTICLE_STATUSES.map((status) => ({ value: status, label: status }))}
              defaultValue={dv.status}
            />
          </div>

          <DatePickerField id="publishedAt" label="Published date" name="publishedAt" defaultValue={dv.publishedAt} />

          <AuthorField defaultAuthor={dv.authorName} />

          <CheckboxField id="featured" name="featured" label="Featured" defaultChecked={dv.featured} />

          {/* The saved cover URL is preserved silently; uploading a new file replaces it. */}
          <input type="hidden" name="coverImageUrl" defaultValue={dv.coverImageUrl} />

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="coverImageFile" className={labelClass}>Cover image</label>
            {dv.coverImageUrl && (
              <div className="flex items-center gap-3">
                <Image
                  src={dv.coverImageUrl}
                  alt="Current cover"
                  width={160}
                  height={90}
                  className="h-16 w-28 rounded-md border border-border object-cover"
                />
                <span className="text-xs text-muted-foreground">Current cover — upload a new file to replace it.</span>
              </div>
            )}
            <input id="coverImageFile" name="coverImageFile" type="file" accept="image/jpeg,image/png,image/webp" className={field} />
            <p className="text-xs text-muted-foreground">
              Upload a cover image (JPG, PNG, or WebP up to 5 MB). Leave empty to keep the current image.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-foreground">Translations</legend>

        <div role="tablist" aria-label="Translation language" className="flex gap-1">
          {ARTICLE_LOCALES.map((loc) => {
            const complete = titles[loc].trim().length > 0
            const active = loc === activeLocale
            return (
              <button
                key={loc}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveLocale(loc)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
                )}
              >
                {LOCALE_LABELS[loc]}
                <span aria-hidden className={cn('size-2 rounded-full', complete ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                <span className="sr-only">{complete ? '(complete)' : '(empty)'}</span>
              </button>
            )
          })}
        </div>

        {ARTICLE_LOCALES.map((loc) => {
          const rtl = loc === 'ar'
          return (
            <div key={loc} hidden={loc !== activeLocale} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`${loc}.title`} className={labelClass}>
                    Title {loc === 'fr' && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    id={`${loc}.title`}
                    name={`${loc}.title`}
                    defaultValue={dv.translations[loc].title}
                    dir={rtl ? 'rtl' : 'ltr'}
                    aria-invalid={err(`translations.${loc}.title`) ? true : undefined}
                    onChange={(e) => setTitles((t) => ({ ...t, [loc]: e.target.value }))}
                    className={field}
                  />
                  {err(`translations.${loc}.title`) && (
                    <p className="text-xs text-destructive">{err(`translations.${loc}.title`)}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={`${loc}.slug`} className={labelClass}>
                    Slug {loc === 'fr' && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    id={`${loc}.slug`}
                    name={`${loc}.slug`}
                    defaultValue={dv.translations[loc].slug}
                    placeholder="my-article"
                    aria-invalid={err(`translations.${loc}.slug`) ? true : undefined}
                    className={field}
                  />
                  {err(`translations.${loc}.slug`) && (
                    <p className="text-xs text-destructive">{err(`translations.${loc}.slug`)}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${loc}.excerpt`} className={labelClass}>Excerpt</label>
                <textarea id={`${loc}.excerpt`} name={`${loc}.excerpt`} defaultValue={dv.translations[loc].excerpt}
                  dir={rtl ? 'rtl' : 'ltr'} rows={2} className={field} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${loc}.body`} className={labelClass}>
                  Body (Markdown) {loc === 'fr' && <span className="text-destructive">*</span>}
                </label>
                <MarkdownEditor
                  id={`${loc}.body`}
                  name={`${loc}.body`}
                  value={bodies[loc]}
                  onChange={(v) => setBodies((b) => ({ ...b, [loc]: v }))}
                  dir={rtl ? 'rtl' : 'ltr'}
                  ariaInvalid={err(`translations.${loc}.bodyMarkdown`) ? true : undefined}
                />
                {err(`translations.${loc}.bodyMarkdown`) && (
                  <p className="text-xs text-destructive">{err(`translations.${loc}.bodyMarkdown`)}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`${loc}.seoTitle`} className={labelClass}>SEO title</label>
                  <input id={`${loc}.seoTitle`} name={`${loc}.seoTitle`} defaultValue={dv.translations[loc].seoTitle}
                    dir={rtl ? 'rtl' : 'ltr'} className={field} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${loc}.seoDescription`} className={labelClass}>SEO description</label>
                  <input id={`${loc}.seoDescription`} name={`${loc}.seoDescription`} defaultValue={dv.translations[loc].seoDescription}
                    dir={rtl ? 'rtl' : 'ltr'} className={field} />
                </div>
              </div>
            </div>
          )
        })}
      </fieldset>

      <div className="admin-form-footer">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/blog">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
