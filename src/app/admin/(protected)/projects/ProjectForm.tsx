'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { AdminSelectField, CheckboxField, DatePickerField } from '@/components/admin/AdminFormControls'
import MarkdownEditor from '@/components/admin/MarkdownEditor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PROJECT_CASE_STUDY_MAX,
  PROJECT_LOCALES,
  PROJECT_STATUSES,
  type ProjectFormState,
  type ProjectLocale,
  type ProjectSkillOption,
  type ProjectStatus,
} from '@/features/content/projects.schema'
import SkillPicker from './SkillPicker'

export interface ProjectFormDefaults {
  slug: string
  status: ProjectStatus
  featured: boolean
  sortOrder: number
  skillIds: string[]
  repoUrl: string
  demoUrl: string
  coverImageUrl: string
  startedAt: string
  translations: Record<ProjectLocale, { title: string; description: string; bodyMarkdown: string }>
}

interface ProjectFormProps {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>
  submitLabel: string
  technicalSkills: ProjectSkillOption[]
  defaultValues?: ProjectFormDefaults
}

const EMPTY: ProjectFormDefaults = {
  slug: '',
  status: 'draft',
  featured: false,
  sortOrder: 0,
  skillIds: [],
  repoUrl: '',
  demoUrl: '',
  coverImageUrl: '',
  startedAt: '',
  translations: {
    fr: { title: '', description: '', bodyMarkdown: '' },
    en: { title: '', description: '', bodyMarkdown: '' },
    ar: { title: '', description: '', bodyMarkdown: '' },
  },
}

const LOCALE_LABELS: Record<ProjectLocale, string> = { fr: 'Français', en: 'English', ar: 'العربية' }

const field =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-[invalid=true]:border-destructive'
const labelClass = 'text-sm font-medium text-foreground'

export default function ProjectForm({ action, submitLabel, technicalSkills, defaultValues }: ProjectFormProps) {
  const dv = defaultValues ?? EMPTY
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(action, {})
  const [activeLocale, setActiveLocale] = useState<ProjectLocale>('fr')
  const [titles, setTitles] = useState<Record<ProjectLocale, string>>({
    fr: dv.translations.fr.title,
    en: dv.translations.en.title,
    ar: dv.translations.ar.title,
  })
  // Case studies are controlled (MarkdownEditor toolbar edits the value).
  const [bodies, setBodies] = useState<Record<ProjectLocale, string>>({
    fr: dv.translations.fr.bodyMarkdown,
    en: dv.translations.en.bodyMarkdown,
    ar: dv.translations.ar.bodyMarkdown,
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

      {/* General fields */}
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-foreground">Details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="slug" className={labelClass}>Slug</label>
            <input id="slug" name="slug" defaultValue={dv.slug} required
              aria-invalid={err('slug') ? true : undefined} className={field} />
            {err('slug') && <p className="text-xs text-destructive">{err('slug')}</p>}
          </div>

          <div className="space-y-1.5">
            <AdminSelectField
              id="status"
              label="Status"
              name="status"
              options={PROJECT_STATUSES.map((status) => ({ value: status, label: status }))}
              defaultValue={dv.status}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sortOrder" className={labelClass}>Sort order</label>
            <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={dv.sortOrder}
              aria-invalid={err('sortOrder') ? true : undefined} className={field} />
            {err('sortOrder') && <p className="text-xs text-destructive">{err('sortOrder')}</p>}
          </div>

          <DatePickerField id="startedAt" label="Started at" name="startedAt" defaultValue={dv.startedAt} />

          <CheckboxField
            id="featured"
            name="featured"
            label="Featured"
            defaultChecked={dv.featured}
            className="sm:col-span-2"
          />

          <div className="sm:col-span-2">
            <SkillPicker options={technicalSkills} defaultSelectedIds={dv.skillIds} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="repoUrl" className={labelClass}>Repository URL</label>
            <input id="repoUrl" name="repoUrl" type="url" defaultValue={dv.repoUrl}
              aria-invalid={err('repoUrl') ? true : undefined} className={field} />
            {err('repoUrl') && <p className="text-xs text-destructive">{err('repoUrl')}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="demoUrl" className={labelClass}>Live demo URL</label>
            <input id="demoUrl" name="demoUrl" type="url" defaultValue={dv.demoUrl}
              aria-invalid={err('demoUrl') ? true : undefined} className={field} />
            {err('demoUrl') && <p className="text-xs text-destructive">{err('demoUrl')}</p>}
          </div>

          {/* Cover image is upload-only; the existing saved value is preserved
              via a hidden field and kept unless a new file is uploaded. */}
          <input type="hidden" name="coverImageUrl" value={dv.coverImageUrl} />

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="coverImageFile" className={labelClass}>Upload cover image</label>
            {dv.coverImageUrl && (
              <p className="text-xs text-muted-foreground">
                A cover image is already saved. Uploading a new file replaces it.
              </p>
            )}
            <input id="coverImageFile" name="coverImageFile" type="file" accept="image/jpeg,image/png,image/webp" className={field} />
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or WebP up to 5 MB.
            </p>
            {err('coverImageUrl') && <p className="text-xs text-destructive">{err('coverImageUrl')}</p>}
          </div>
        </div>
      </fieldset>

      {/* Translations */}
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-foreground">Translations</legend>

        <div role="tablist" aria-label="Translation language" className="flex gap-1">
          {PROJECT_LOCALES.map((loc) => {
            const complete = titles[loc].trim().length > 0
            const hasError = Object.keys(state.errors ?? {}).some((key) =>
              key.startsWith(`translations.${loc}.`),
            )
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
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full',
                    hasError ? 'bg-destructive' : complete ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                />
                <span className="sr-only">
                  {hasError ? '(has errors)' : complete ? '(complete)' : '(empty)'}
                </span>
              </button>
            )
          })}
        </div>

        {PROJECT_LOCALES.map((loc) => (
          <div key={loc} hidden={loc !== activeLocale} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={`${loc}.title`} className={labelClass}>
                Title {loc === 'fr' && <span className="text-destructive">*</span>}
              </label>
              <input
                id={`${loc}.title`}
                name={`${loc}.title`}
                defaultValue={dv.translations[loc].title}
                dir={loc === 'ar' ? 'rtl' : 'ltr'}
                aria-invalid={err(`translations.${loc}.title`) ? true : undefined}
                onChange={(e) => setTitles((t) => ({ ...t, [loc]: e.target.value }))}
                className={field}
              />
              {err(`translations.${loc}.title`) && (
                <p className="text-xs text-destructive">{err(`translations.${loc}.title`)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${loc}.description`} className={labelClass}>Description</label>
              <textarea
                id={`${loc}.description`}
                name={`${loc}.description`}
                defaultValue={dv.translations[loc].description}
                dir={loc === 'ar' ? 'rtl' : 'ltr'}
                rows={4}
                aria-invalid={err(`translations.${loc}.description`) ? true : undefined}
                className={field}
              />
              {err(`translations.${loc}.description`) && (
                <p className="text-xs text-destructive">{err(`translations.${loc}.description`)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${loc}.bodyMarkdown`} className={labelClass}>Case study (Markdown)</label>
              <p className="text-xs text-muted-foreground">
                Shown on the public page /{loc}/projects/{'<slug>'}. Start sections with ## headings
                (the project title is the page&apos;s only H1). Leave empty to show an overview built
                from the description and tech stack.
              </p>
              <MarkdownEditor
                id={`${loc}.bodyMarkdown`}
                name={`${loc}.bodyMarkdown`}
                value={bodies[loc]}
                onChange={(value) => setBodies((current) => ({ ...current, [loc]: value }))}
                dir={loc === 'ar' ? 'rtl' : 'ltr'}
                rows={16}
                ariaInvalid={err(`translations.${loc}.bodyMarkdown`) ? true : undefined}
              />
              <p
                className={cn(
                  'text-xs',
                  bodies[loc].length > PROJECT_CASE_STUDY_MAX ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {bodies[loc].length.toLocaleString('en-US')} / {PROJECT_CASE_STUDY_MAX.toLocaleString('en-US')} characters
              </p>
              {err(`translations.${loc}.bodyMarkdown`) && (
                <p className="text-xs text-destructive">{err(`translations.${loc}.bodyMarkdown`)}</p>
              )}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="admin-form-footer">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/projects">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
