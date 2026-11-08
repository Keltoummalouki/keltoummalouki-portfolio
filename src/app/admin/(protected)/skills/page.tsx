import Link from 'next/link'
import { Code2, FolderTree, Layers3, Pencil, Sparkles } from 'lucide-react'
import { DeleteButton } from '@/components/admin/ui'
import {
  deleteSkillAction,
  deleteSkillCategoryAction,
  saveSkillAction,
  saveSkillCategoryAction,
} from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import type { SkillType } from '@/features/cms/schema'
import {
  AdminCard,
  EmptyState,
  ErrorNotice,
  I18nInputs,
  PageHeader,
  StatCard,
  StatusBadge,
  i18nValues,
  fieldClass,
  labelClass,
} from '@/components/admin/CmsAdmin'
import { AdminSelectField } from '@/components/admin/AdminFormControls'
import FormStatusButton from '@/components/admin/FormStatusButton'
import SkillIcon from '@/components/ui/SkillIcon'
import SkillFormFields, { type SkillFieldsValues } from './SkillFormFields'

type AdminCmsData = Awaited<ReturnType<typeof getAdminCmsData>>
type SkillRow = AdminCmsData['skills'][number]
type CategoryRow = AdminCmsData['skillCategories'][number]
type SkillsSearchParams = {
  error?: string | string[]
  techPage?: string | string[]
  softPage?: string | string[]
  categoryPage?: string | string[]
  [key: string]: string | string[] | undefined
}

const TECHNICAL_PAGE_SIZE = 8
const SOFT_PAGE_SIZE = 3
const CATEGORY_PAGE_SIZE = 4
const VISIBILITY_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function pageCount(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

function currentPage(params: SkillsSearchParams, key: keyof SkillsSearchParams, totalItems: number, pageSize: number) {
  const raw = Number.parseInt(firstValue(params[key]) ?? '1', 10)
  const page = Number.isFinite(raw) && raw > 0 ? raw : 1
  return Math.min(page, pageCount(totalItems, pageSize))
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

function visibleRange(totalItems: number, page: number, pageSize: number) {
  if (totalItems === 0) return { start: 0, end: 0 }
  return {
    start: (page - 1) * pageSize + 1,
    end: Math.min(totalItems, page * pageSize),
  }
}

function pageHref(params: SkillsSearchParams, key: string, page: number) {
  const next = new URLSearchParams()

  for (const [paramKey, value] of Object.entries(params)) {
    if (!value || paramKey === key || paramKey === 'error') continue
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (item) next.append(paramKey, item)
    }
  }

  if (page > 1) next.set(key, String(page))
  const query = next.toString()
  return query ? `/admin/skills?${query}` : '/admin/skills'
}

function paginationPages(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= totalPages))
  const sorted = [...pages].sort((a, b) => a - b)
  const output: Array<number | 'ellipsis'> = []

  for (const item of sorted) {
    const previous = output[output.length - 1]
    if (typeof previous === 'number' && item - previous > 1) output.push('ellipsis')
    output.push(item)
  }

  return output
}

function PaginationControls({
  label,
  page,
  pageSize,
  totalItems,
  pageParam,
  searchParams,
}: {
  label: string
  page: number
  pageSize: number
  totalItems: number
  pageParam: string
  searchParams: SkillsSearchParams
}) {
  if (totalItems <= pageSize) return null

  const totalPages = pageCount(totalItems, pageSize)
  const range = visibleRange(totalItems, page, pageSize)
  const pages = paginationPages(page, totalPages)
  const baseButtonClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

  return (
    <nav
      aria-label={`${label} pagination`}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{range.start}</span>–
        <span className="font-medium text-foreground">{range.end}</span> of{' '}
        <span className="font-medium text-foreground">{totalItems}</span> {label}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <Link href={pageHref(searchParams, pageParam, page - 1)} className={`${baseButtonClass} border-border bg-card hover:bg-secondary`}>
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${baseButtonClass} border-border bg-card text-muted-foreground opacity-50`}>
            Previous
          </span>
        )}

        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={pageHref(searchParams, pageParam, item)}
              aria-current={item === page ? 'page' : undefined}
              className={
                item === page
                  ? `${baseButtonClass} border-primary bg-primary text-primary-foreground`
                  : `${baseButtonClass} border-border bg-card hover:bg-secondary`
              }
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={pageHref(searchParams, pageParam, page + 1)} className={`${baseButtonClass} border-border bg-card hover:bg-secondary`}>
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={`${baseButtonClass} border-border bg-card text-muted-foreground opacity-50`}>
            Next
          </span>
        )}
      </div>
    </nav>
  )
}

function skillTypeOf(skill: SkillRow): SkillType {
  return skill.skill_type === 'soft' ? 'soft' : 'technical'
}

function skillValues(skill: SkillRow): SkillFieldsValues {
  return {
    skillType: skillTypeOf(skill),
    name: skill.name,
    categoryId: skill.category_id ?? '',
    icon: skill.icon ?? '',
    imageUrl: skill.image_url ?? '',
    level: skill.level != null ? String(skill.level) : '',
    sortOrder: skill.sort_order,
    status: skill.status,
  }
}

function categoryLabel(category: CategoryRow) {
  return i18nValues(category.name).fr || category.slug
}

function Field({
  id,
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
  required,
}: {
  id: string
  label: string
  name: string
  defaultValue?: string | number | null
  placeholder?: string
  type?: string
  required?: boolean
}) {
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
        placeholder={placeholder}
        defaultValue={defaultValue ?? ''}
        className={fieldClass}
      />
    </div>
  )
}

function VisibilitySelect({ id, defaultValue = 'published' }: { id: string; defaultValue?: string | null }) {
  return (
    <AdminSelectField
      id={id}
      label="Visibility"
      name="status"
      options={VISIBILITY_OPTIONS}
      defaultValue={defaultValue ?? 'published'}
    />
  )
}

function CategoryForm({ category }: { category?: CategoryRow }) {
  const id = category?.id ?? 'new-category'

  return (
    <form action={saveSkillCategoryAction} className="space-y-4">
      <input type="hidden" name="id" value={category?.id ?? ''} />
      <div className="grid gap-4 md:grid-cols-[1fr_120px_160px]">
        <Field id={`${id}-slug`} label="Category slug" name="slug" placeholder="frameworks" defaultValue={category?.slug} required />
        <Field id={`${id}-order`} label="Sort order" name="sortOrder" type="number" defaultValue={category?.sort_order ?? 0} />
        <VisibilitySelect id={`${id}-status`} defaultValue={category?.status} />
      </div>
      <I18nInputs prefix="name" label="Category name" values={category ? i18nValues(category.name) : { fr: '', en: '', ar: '' }} />
      <FormStatusButton size={category ? 'sm' : undefined}>{category ? 'Save category' : 'Add category'}</FormStatusButton>
    </form>
  )
}

function SkillEditor({
  skill,
  categories,
  categoryName,
}: {
  skill: SkillRow
  categories: { id: string; label: string }[]
  categoryName?: string
}) {
  const isSoft = skillTypeOf(skill) === 'soft'

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
            <SkillIcon name={skill.name} icon={skill.icon} imageUrl={skill.image_url} className="text-primary" size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{skill.name}</h3>
              <StatusBadge status={skill.status} />
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {isSoft ? 'Soft' : 'Technical'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSoft ? 'Standalone soft skill' : categoryName ? `Category: ${categoryName}` : 'No category'}
              {!isSoft && skill.level != null ? ` · Level ${skill.level}/5` : ''}
              {` · Order ${skill.sort_order}`}
            </p>
          </div>
        </div>

        <form action={deleteSkillAction}>
          <input type="hidden" name="id" value={skill.id} />
          <DeleteButton />
        </form>
      </div>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:text-primary">
          <Pencil className="size-4" aria-hidden="true" />
          Edit skill
        </summary>
        <div className="border-t border-border p-4">
          <form action={saveSkillAction} className="space-y-4">
            <input type="hidden" name="id" value={skill.id} />
            <SkillFormFields idPrefix={`skill-${skill.id}`} categories={categories} values={skillValues(skill)} />
            <FormStatusButton size="sm">Save changes</FormStatusButton>
          </form>
        </div>
      </details>
    </div>
  )
}

export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: Promise<SkillsSearchParams>
}) {
  const [params, data] = await Promise.all([searchParams, getAdminCmsData()])
  const { error } = params

  const categoryOptions = data.skillCategories.map((category) => ({
    id: category.id,
    label: categoryLabel(category),
  }))
  const categoryNameById = new Map(categoryOptions.map((category) => [category.id, category.label]))
  const technicalSkills = data.skills.filter((skill) => skillTypeOf(skill) === 'technical')
  const softSkills = data.skills.filter((skill) => skillTypeOf(skill) === 'soft')
  const ungroupedTechnical = technicalSkills.filter((skill) => !skill.category_id)
  const technicalEntries = [
    ...data.skillCategories.flatMap((category) =>
      technicalSkills
        .filter((skill) => skill.category_id === category.id)
        .map((skill) => ({
          sectionId: category.id,
          sectionLabel: categoryLabel(category),
          sectionIcon: 'category' as const,
          categoryName: categoryNameById.get(category.id),
          skill,
        })),
    ),
    ...ungroupedTechnical.map((skill) => ({
      sectionId: 'uncategorized',
      sectionLabel: 'Uncategorized technical skills',
      sectionIcon: 'uncategorized' as const,
      categoryName: undefined,
      skill,
    })),
  ]
  const technicalPage = currentPage(params, 'techPage', technicalEntries.length, TECHNICAL_PAGE_SIZE)
  const softPage = currentPage(params, 'softPage', softSkills.length, SOFT_PAGE_SIZE)
  const categoryPage = currentPage(params, 'categoryPage', data.skillCategories.length, CATEGORY_PAGE_SIZE)
  const visibleTechnicalEntries = paginate(technicalEntries, technicalPage, TECHNICAL_PAGE_SIZE)
  const visibleSoftSkills = paginate(softSkills, softPage, SOFT_PAGE_SIZE)
  const visibleCategories = paginate(data.skillCategories, categoryPage, CATEGORY_PAGE_SIZE)
  const technicalSectionTotals = new Map<string, number>()

  for (const entry of technicalEntries) {
    technicalSectionTotals.set(entry.sectionId, (technicalSectionTotals.get(entry.sectionId) ?? 0) + 1)
  }

  const visibleTechnicalGroups = visibleTechnicalEntries.reduce<
    Array<{
      sectionId: string
      sectionLabel: string
      sectionIcon: 'category' | 'uncategorized'
      skills: SkillRow[]
    }>
  >((groups, entry) => {
    const last = groups[groups.length - 1]
    if (last?.sectionId === entry.sectionId) {
      last.skills.push(entry.skill)
      return groups
    }

    groups.push({
      sectionId: entry.sectionId,
      sectionLabel: entry.sectionLabel,
      sectionIcon: entry.sectionIcon,
      skills: [entry.skill],
    })
    return groups
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Manage technical skills with categories/logos, plus standalone soft skills."
      />
      <ErrorNotice error={error} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Code2} label="Technical skills" value={technicalSkills.length} />
        <StatCard icon={Sparkles} label="Soft skills" value={softSkills.length} />
        <StatCard icon={FolderTree} label="Technical categories" value={data.skillCategories.length} />
      </div>

      <AdminCard title="Add skill">
        <div className="mb-5 rounded-2xl border border-border bg-background/70 p-4">
          <p className="font-semibold text-foreground">Choose the skill family first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Technical skills show category and logo upload fields. Soft skills only need a name, icon key, order, and visibility.
          </p>
        </div>
        <form action={saveSkillAction} className="space-y-4">
          <input type="hidden" name="id" value="" />
          <SkillFormFields idPrefix="new-skill" categories={categoryOptions} />
          <FormStatusButton>Add skill</FormStatusButton>
        </form>
      </AdminCard>

      <AdminCard title="Add technical category">
        <CategoryForm />
      </AdminCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard title={`Technical skills (${technicalSkills.length})`}>
          <div className="space-y-5">
            {visibleTechnicalGroups.map((group) => (
              <section key={group.sectionId} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary">
                    {group.sectionIcon === 'category' ? (
                      <Layers3 className="size-4" aria-hidden="true" />
                    ) : (
                      <Code2 className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <h2 className="font-semibold text-foreground">{group.sectionLabel}</h2>
                  <span className="text-sm text-muted-foreground">({technicalSectionTotals.get(group.sectionId) ?? group.skills.length})</span>
                </div>
                <div className="space-y-3">
                  {group.skills.map((skill) => (
                    <SkillEditor
                      key={skill.id}
                      skill={skill}
                      categories={categoryOptions}
                      categoryName={categoryNameById.get(skill.category_id ?? '')}
                    />
                  ))}
                </div>
              </section>
            ))}

            {technicalSkills.length === 0 && (
              <EmptyState
                title="No technical skills yet."
                description="Add technologies like Next.js, Docker, PostgreSQL, or Figma from the form above."
              />
            )}

            <PaginationControls
              label="technical skills"
              page={technicalPage}
              pageSize={TECHNICAL_PAGE_SIZE}
              totalItems={technicalEntries.length}
              pageParam="techPage"
              searchParams={params}
            />
          </div>
        </AdminCard>

        <AdminCard title={`Soft skills (${softSkills.length})`}>
          <div className="space-y-3">
            {softSkills.length === 0 ? (
              <EmptyState
                title="No soft skills yet."
                description="Add skills like time management, adaptability, teamwork, or problem solving."
              />
            ) : (
              visibleSoftSkills.map((skill) => (
                <SkillEditor key={skill.id} skill={skill} categories={categoryOptions} />
              ))
            )}

            <PaginationControls
              label="soft skills"
              page={softPage}
              pageSize={SOFT_PAGE_SIZE}
              totalItems={softSkills.length}
              pageParam="softPage"
              searchParams={params}
            />
          </div>
        </AdminCard>
      </div>

      <AdminCard title={`Technical categories (${data.skillCategories.length})`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.skillCategories.length === 0 ? (
            <EmptyState
              title="No categories yet."
              description="Create categories such as Languages, Frameworks & APIs, DevOps, or Databases."
            />
          ) : (
            visibleCategories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{categoryLabel(category)}</p>
                    <p className="text-sm text-muted-foreground">
                      /{category.slug} · Order {category.sort_order}
                    </p>
                  </div>
                  <StatusBadge status={category.status} />
                </div>

                <details className="group rounded-xl border border-border bg-card">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:text-primary">
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit category
                  </summary>
                  <div className="border-t border-border p-4">
                    <CategoryForm category={category} />
                    <form action={deleteSkillCategoryAction} className="mt-3 flex justify-end">
                      <input type="hidden" name="id" value={category.id} />
                      <DeleteButton label="Delete category" />
                    </form>
                  </div>
                </details>
              </div>
            ))
          )}
        </div>

        <PaginationControls
          label="technical categories"
          page={categoryPage}
          pageSize={CATEGORY_PAGE_SIZE}
          totalItems={data.skillCategories.length}
          pageParam="categoryPage"
          searchParams={params}
        />
      </AdminCard>
    </div>
  )
}
