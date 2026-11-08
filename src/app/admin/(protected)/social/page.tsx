import { CollectionOverview, EditorDisclosure } from '@/components/admin/Workspace'
import { ExternalLink, Plus } from 'lucide-react'
import { DeleteButton } from '@/components/admin/ui'
import { deleteSocialLinkAction, saveSocialLinkAction } from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import { CMS_STATUSES } from '@/features/cms/schema'
import {
  SOCIAL_PLATFORM_OPTIONS,
  defaultSocialLabel,
  displaySocialPlatform,
  normalizeSocialPlatform,
} from '@/features/cms/social-platforms'
import { AdminSelectField } from '@/components/admin/AdminFormControls'
import { AdminCard, EmptyState, ErrorNotice, FileField, PageHeader, StatusBadge, fieldClass, labelClass } from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'
import SocialIcon from '@/components/ui/SocialIcon'

type SocialLinkRow = {
  id: string
  platform: string
  label: string | null
  icon: string | null
  url: string
  sort_order: number
  status: string
}

function isUploadedIcon(icon: string | null | undefined) {
  const value = icon?.trim() ?? ''
  return value.startsWith('/') || /^https?:\/\//i.test(value)
}

function SocialField({
  id,
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  required,
}: {
  id: string
  label: string
  name: string
  defaultValue?: string | number | null
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
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

function PlatformSelect({ defaultValue, idSuffix }: { defaultValue: string; idSuffix: string }) {
  const normalized = normalizeSocialPlatform(defaultValue)
  const hasKnownPlatform = SOCIAL_PLATFORM_OPTIONS.some((option) => option.key === normalized)
  const id = `platform-${idSuffix}`
  const options = [
    ...(!hasKnownPlatform && normalized
      ? [{ value: normalized, label: displaySocialPlatform(normalized) }]
      : []),
    ...SOCIAL_PLATFORM_OPTIONS.map((option) => ({
      value: option.key,
      label: `${option.action}: ${option.label}`,
    })),
  ]

  return (
    <AdminSelectField
      id={id}
      label="Link type"
      name="platform"
      options={options}
      defaultValue={normalized || 'email'}
    />
  )
}

function IconPresetSelect({ link, idSuffix }: { link?: SocialLinkRow; idSuffix: string }) {
  const currentIcon = link?.icon ?? ''
  const currentIsUploaded = isUploadedIcon(currentIcon)
  const id = `iconPreset-${idSuffix}`

  return (
    <AdminSelectField
      id={id}
      label="Built-in icon"
      name="iconPreset"
      options={[
        { value: '', label: currentIsUploaded ? 'Keep uploaded icon' : 'Auto / keep current' },
        ...SOCIAL_PLATFORM_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
        })),
      ]}
      defaultValue=""
    />
  )
}

function VisibilitySelect({ defaultValue = 'published', idSuffix }: { defaultValue?: string | null; idSuffix: string }) {
  const id = `status-${idSuffix}`

  return (
    <AdminSelectField
      id={id}
      label="Visibility"
      name="status"
      options={CMS_STATUSES.map((status) => ({
        value: status,
        label: status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'Archived',
      }))}
      defaultValue={defaultValue ?? 'published'}
    />
  )
}

function SocialForm({ link }: { link?: SocialLinkRow }) {
  const platform = normalizeSocialPlatform(link?.platform ?? 'email')
  const platformOption = SOCIAL_PLATFORM_OPTIONS.find((option) => option.key === platform)
  const labelPlaceholder = platformOption?.defaultLabel ?? defaultSocialLabel(platform)
  const urlPlaceholder = platformOption?.placeholder ?? 'https://example.com/profile'
  const existingIcon = link?.icon ?? ''
  const formId = link?.id ?? 'new'

  return (
    <form action={saveSocialLinkAction} className="space-y-5">
      <input type="hidden" name="id" value={link?.id ?? ''} />
      <input type="hidden" name="existingIcon" value={existingIcon} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.35fr]">
        <PlatformSelect defaultValue={platform} idSuffix={formId} />
        <SocialField id={`label-${formId}`} label="Public label" name="label" defaultValue={link?.label} placeholder={labelPlaceholder} />
        <SocialField id={`url-${formId}`} label="Destination URL" name="url" type="url" defaultValue={link?.url} placeholder={urlPlaceholder} required />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_120px_150px]">
        <IconPresetSelect link={link} idSuffix={formId} />
        <FileField
          label="Upload custom icon"
          name="iconFile"
          buttonLabel="Upload icon"
          help="Optional: upload a JPG, PNG, or WebP icon up to 5 MB. If selected, it replaces the built-in icon."
        />
        <SocialField id={`sortOrder-${formId}`} label="Sort order" name="sortOrder" type="number" defaultValue={link?.sort_order ?? 0} />
        <VisibilitySelect defaultValue={link?.status} idSuffix={formId} />
      </div>

      <div className="flex justify-end">
        <FormStatusButton size="sm" className="min-w-32">
          {link ? 'Save changes' : 'Add link'}
        </FormStatusButton>
      </div>
    </form>
  )
}

function ExistingLinkCard({ link }: { link: SocialLinkRow }) {
  const label = link.label || defaultSocialLabel(link.platform)

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
            <SocialIcon platform={link.platform} icon={link.icon} className="size-5" imageClassName="rounded-md" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{label}</p>
              <StatusBadge status={link.status} />
            </div>
            <p className="text-sm text-muted-foreground">{displaySocialPlatform(link.platform)}</p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 lg:max-w-md">
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-primary"
          >
            <span className="truncate">{link.url}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
          <form action={deleteSocialLinkAction}>
            <input type="hidden" name="id" value={link.id} />
            <DeleteButton />
          </form>
        </div>
      </div>

      <EditorDisclosure title="Edit link" subtitle="Destination, icon & visibility"><SocialForm link={link} /></EditorDisclosure>
    </div>
  )
}

function PlatformChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {SOCIAL_PLATFORM_OPTIONS.map((option) => (
        <span
          key={option.key}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <SocialIcon platform={option.key} icon={option.key} className="size-3.5 text-primary" />
          {option.label}
        </span>
      ))}
    </div>
  )
}

export default async function AdminSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social & contact links"
        description="Manage the buttons shown in the hero, footer, and public contact/follow areas."
      />
      <CollectionOverview items={data.socialLinks} label="links" />
      <ErrorNotice error={error} />

      <AdminCard title="Supported platforms">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add contact links for email, WhatsApp, Telegram, or Discord, and follow links for GitHub, Instagram, LinkedIn, X, Reddit, and Medium.
          </p>
          <PlatformChips />
        </div>
      </AdminCard>

      <AdminCard title="Add social/contact link">
        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
              <Plus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Create a public link</p>
              <p className="text-sm text-muted-foreground">Leave the label empty to use a smart default like “Contact me by email”.</p>
            </div>
          </div>
          <SocialForm />
        </div>
      </AdminCard>

      <AdminCard title="Existing links">
        <div className="space-y-4">
          {data.socialLinks.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No social links yet"
              description="Add your first email, GitHub, WhatsApp, Instagram, LinkedIn, Telegram, X, Discord, Reddit, or Medium link above."
            />
          ) : (
            data.socialLinks.map((link) => <ExistingLinkCard key={link.id} link={link} />)
          )}
        </div>
      </AdminCard>
    </div>
  )
}
