import { CollectionOverview } from '@/components/admin/Workspace'
import { Briefcase, CalendarDays, ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react'
import { deleteExperienceAction, saveExperienceAction } from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import { AdminCard, EmptyState, ErrorNotice, FileField, PageHeader, StatusBadge, TextArea, fieldClass, labelClass } from '@/components/admin/CmsAdmin'
import { AdminSelectField, CheckboxField, DatePickerField } from '@/components/admin/AdminFormControls'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { Button } from '@/components/ui/button'
import SkillIcon from '@/components/ui/SkillIcon'
import { LOCALES, type Locale } from '@/lib/validation/locale'

type AdminCmsData = Awaited<ReturnType<typeof getAdminCmsData>>
type ExperienceRow = AdminCmsData['experiences'][number]

interface TechOption {
  name: string
  icon: string
  imageUrl: string
}

function tr(item: { experience_translations?: { locale: string; role: string; description: string | null }[] }, locale: Locale) {
  return item.experience_translations?.find((t) => t.locale === locale) ?? { role: '', description: '' }
}

function primaryTranslation(item: ExperienceRow) {
  return tr(item, 'fr').role || tr(item, 'en').role || tr(item, 'ar').role || 'Untitled role'
}

function primaryDescription(item: ExperienceRow) {
  return tr(item, 'fr').description || tr(item, 'en').description || tr(item, 'ar').description || ''
}

function dateRange(item: ExperienceRow) {
  const from = item.start_date ? item.start_date.slice(0, 7) : 'No start date'
  const to = item.is_current ? 'Present' : item.end_date ? item.end_date.slice(0, 7) : 'No end date'
  return `${from} — ${to}`
}

function inputId(prefix: string, name: string) {
  return `${prefix}-${name.replace(/[^a-z0-9]+/gi, '-')}`
}

function Field({
  idPrefix,
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  required,
}: {
  idPrefix: string
  label: string
  name: string
  defaultValue?: string | number | null
  type?: string
  placeholder?: string
  required?: boolean
}) {
  const id = inputId(idPrefix, name)

  if (type === 'date') {
    return (
      <DatePickerField
        id={id}
        label={label}
        name={name}
        defaultValue={defaultValue != null ? String(defaultValue) : ''}
        required={required}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className={fieldClass}
      />
    </div>
  )
}

function VisibilitySelect({ idPrefix, defaultValue = 'published' }: { idPrefix: string; defaultValue?: string | null }) {
  const id = inputId(idPrefix, 'status')

  return (
    <AdminSelectField
      id={id}
      label="Visibility"
      name="status"
      options={[
        { value: 'published', label: 'Published' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' },
      ]}
      defaultValue={defaultValue ?? 'published'}
    />
  )
}

function TechnologyPicker({
  idPrefix,
  options,
  selected,
}: {
  idPrefix: string
  options: TechOption[]
  selected: string[]
}) {
  const selectedSet = new Set(selected)
  const extraSelected = selected.filter((tech) => !options.some((option) => option.name.toLowerCase() === tech.toLowerCase()))
  const allOptions = [
    ...options,
    ...extraSelected.map((name) => ({ name, icon: name, imageUrl: '' })),
  ]

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border bg-background/70 p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">Technologies used</legend>
      <p className="text-xs text-muted-foreground">
        Select from your technical skills. These tags appear as the stack on the public Experience timeline.
      </p>

      {allOptions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          No technical skills found yet. Add technical skills first in the Skills page.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allOptions.map((tech) => {
            const id = `${idPrefix}-tech-${tech.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
            const checked = selectedSet.has(tech.name)

            return (
              <label
                key={tech.name}
                htmlFor={id}
                className="group inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-primary has-[:checked]:border-primary/60 has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
              >
                <input
                  id={id}
                  type="checkbox"
                  name="technologies"
                  value={tech.name}
                  defaultChecked={checked}
                  className="sr-only"
                />
                <SkillIcon name={tech.name} icon={tech.icon} imageUrl={tech.imageUrl} className="text-primary" size={15} />
                {tech.name}
              </label>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

function ExperienceForm({
  item,
  techOptions,
}: {
  item?: ExperienceRow
  techOptions: TechOption[]
}) {
  const idPrefix = item?.id ?? 'new-experience'
  const selectedTechnologies = Array.isArray(item?.technologies) ? item.technologies : []

  return (
    <form action={saveExperienceAction} className="space-y-6 rounded-2xl border border-border bg-background/70 p-4">
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="imageUrl" value={item?.image_url ?? ''} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Field idPrefix={idPrefix} label="Company" name="company" defaultValue={item?.company} />
        <Field idPrefix={idPrefix} label="Location" name="location" defaultValue={item?.location} placeholder="Casablanca, Morocco" />
        <Field idPrefix={idPrefix} label="Company URL" name="url" defaultValue={item?.url} placeholder="https://..." />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_120px_160px]">
        <Field idPrefix={idPrefix} label="Start date" name="startDate" type="date" defaultValue={item?.start_date} />
        <Field idPrefix={idPrefix} label="End date" name="endDate" type="date" defaultValue={item?.end_date} />
        <Field idPrefix={idPrefix} label="Sort order" name="sortOrder" type="number" defaultValue={item?.sort_order ?? 0} />
        <VisibilitySelect idPrefix={idPrefix} defaultValue={item?.status} />
      </div>

      <CheckboxField
        id={`${idPrefix}-current`}
        name="isCurrent"
        label="Current role"
        defaultChecked={item?.is_current ?? false}
        className="rounded-xl border border-border bg-card px-3 py-2"
      />

      <TechnologyPicker idPrefix={idPrefix} options={techOptions} selected={selectedTechnologies} />

      <FileField
        label="Upload/replace company logo or image"
        name="imageFile"
        buttonLabel="Upload logo"
        help="Upload a JPG, PNG, or WebP logo/image up to 5 MB. If selected, it replaces the current saved image."
      />

      <div className="space-y-5">
        {LOCALES.map((locale) => {
          const value = item ? tr(item, locale) : { role: '', description: '' }
          return (
            <div key={locale} className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Field
                idPrefix={idPrefix}
                label={`Role (${locale.toUpperCase()})${locale === 'fr' ? ' *' : ''}`}
                name={`${locale}.role`}
                defaultValue={value.role}
                required={locale === 'fr'}
              />
              <TextArea
                label={`Description (${locale.toUpperCase()})`}
                name={`${locale}.description`}
                defaultValue={value.description}
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          )
        })}
      </div>

      <FormStatusButton>{item ? 'Save experience' : 'Add experience'}</FormStatusButton>
    </form>
  )
}

function ExperienceCard({
  item,
  techOptions,
}: {
  item: ExperienceRow
  techOptions: TechOption[]
}) {
  const technologies = Array.isArray(item.technologies) ? item.technologies : []

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary text-primary">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Briefcase className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{primaryTranslation(item)}</h3>
              <StatusBadge status={item.status} />
              {item.is_current && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                  Current
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {item.company && <span>{item.company}</span>}
              {item.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {item.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {dateRange(item)}
              </span>
            </div>
            {primaryDescription(item) && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {primaryDescription(item)}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              Visit
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          <form action={deleteExperienceAction}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 size={14} />
              Delete
            </Button>
          </form>
        </div>
      </div>

      {technologies.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {technologies.map((tech) => {
            const option = techOptions.find((item) => item.name.toLowerCase() === tech.toLowerCase())
            return (
              <span key={tech} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <SkillIcon name={tech} icon={option?.icon ?? tech} imageUrl={option?.imageUrl ?? ''} className="text-primary" size={14} />
                {tech}
              </span>
            )
          })}
        </div>
      )}

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:text-primary">
          <Pencil className="size-4" aria-hidden="true" />
          Edit experience
        </summary>
        <div className="border-t border-border p-4">
          <ExperienceForm item={item} techOptions={techOptions} />
        </div>
      </details>
    </div>
  )
}

export default async function AdminExperiencePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])
  // Dedupe by name (case-insensitive): the picker keys/selects technologies by
  // name, so two technical skills sharing a name must appear only once.
  const seenTech = new Set<string>()
  const techOptions: TechOption[] = []
  for (const skill of data.skills) {
    if (skill.skill_type === 'soft') continue
    const key = skill.name.trim().toLowerCase()
    if (!key || seenTech.has(key)) continue
    seenTech.add(key)
    techOptions.push({
      name: skill.name,
      icon: skill.icon ?? skill.name,
      imageUrl: skill.image_url ?? '',
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experience"
        description="Manage professional experience, translated descriptions, company images, and technologies used."
      />
      <CollectionOverview items={data.experiences} label="roles" />
      <ErrorNotice error={error} />

      <AdminCard title="Add experience">
        <ExperienceForm techOptions={techOptions} />
      </AdminCard>

      <AdminCard title={`Existing experience (${data.experiences.length})`}>
        <div className="space-y-4">
          {data.experiences.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No experience items yet"
              description="Add your first role above, then choose technologies from your technical skills."
            />
          ) : (
            data.experiences.map((item) => (
              <ExperienceCard key={item.id} item={item} techOptions={techOptions} />
            ))
          )}
        </div>
      </AdminCard>
    </div>
  )
}
