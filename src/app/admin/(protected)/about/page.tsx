import { EditorGuide } from '@/components/admin/Workspace'
import { saveAboutAction } from '@/features/cms/actions'
import { ABOUT_FALLBACK } from '@/features/cms/fallbacks'
import { getAdminCmsData } from '@/features/cms/queries'
import { readSiteProfile } from '@/features/cms/site-profile'
import { ExternalLink, FileText } from 'lucide-react'
import {
  ErrorNotice,
  Field,
  FileField,
  I18nInputs,
  PageHeader,
  SectionCard,
  StatusSelect,
  i18nValues,
} from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { cn } from '@/lib/utils'
import type { I18nText } from '@/features/cms/schema'

function withI18nFallback(values: I18nText, fallback: I18nText): I18nText {
  return {
    fr: values.fr || fallback.fr,
    en: values.en || fallback.en,
    ar: values.ar || fallback.ar,
  }
}

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', dot: 'bg-emerald-500' },
  { value: 'limited', label: 'Limited', dot: 'bg-amber-500' },
  { value: 'unavailable', label: 'Unavailable', dot: 'bg-slate-400' },
] as const

function AvailabilityField({ defaultValue }: { defaultValue: string }) {
  const selected = AVAILABILITY_OPTIONS.some((o) => o.value === defaultValue)
    ? defaultValue
    : 'available'

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-foreground">Availability</legend>
      <div className="grid grid-cols-3 gap-2">
        {AVAILABILITY_OPTIONS.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name="availabilityStatus"
              value={option.value}
              defaultChecked={selected === option.value}
              className="peer sr-only"
            />
            <span className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50">
              <span className={cn('size-2 shrink-0 rounded-full', option.dot)} aria-hidden="true" />
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function CurrentCvFile({ label, url }: { label: string; url: string }) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">No file uploaded yet</span>
        </span>
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors duration-200 hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/10">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
          Open current file
        </span>
      </span>
      <ExternalLink
        className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary"
        aria-hidden="true"
      />
    </a>
  )
}

export default async function AdminAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])
  const about = data.about
  const site = data.siteSettings
  const siteProfile = readSiteProfile(site?.profile)
  const avatarUrl = about?.avatar_url || ABOUT_FALLBACK.avatarUrl
  const legacyCvUrl = site?.cv_url || ABOUT_FALLBACK.cvUrl
  const cvUrlFr = siteProfile.cvUrlFr || legacyCvUrl
  const cvUrlEn = siteProfile.cvUrlEn || legacyCvUrl
  const fullName = about?.full_name || ABOUT_FALLBACK.fullName
  const locationValues = withI18nFallback(siteProfile.location, ABOUT_FALLBACK.location)
  const headlineValues = withI18nFallback(i18nValues(about?.headline), ABOUT_FALLBACK.headline)
  const bioValues = withI18nFallback(i18nValues(about?.bio), ABOUT_FALLBACK.bio)

  return (
    <div className="space-y-6">
      <PageHeader
        title="About"
        description="Manage the public profile: photo, name, availability, localized copy, CV files, and booking link."
      />
      <ErrorNotice error={error} />
      <EditorGuide items={[{"href":"#profile","label":"Identity","detail":"Photo, name & availability"},{"href":"#biography","label":"Your story","detail":"Headline & multilingual bio"},{"href":"#resume","label":"Your résumé","detail":"Localized PDF documents"},{"href":"#booking","label":"Booking","detail":"Calendar link for calls"}]} />

      <form action={saveAboutAction} className="space-y-6">
        <input type="hidden" name="existingAvatarUrl" value={avatarUrl} />
        <input type="hidden" name="existingCvUrl" value={legacyCvUrl} />
        <input type="hidden" name="existingCvUrlFr" value={cvUrlFr} />
        <input type="hidden" name="existingCvUrlEn" value={cvUrlEn} />

        {/* Profile: photo, name, availability, location */}
        <SectionCard
          id="profile" title="Profile"
          description="Your photo, name, and availability shown across the public site."
        >
          <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center gap-4">
              <div className="size-32 overflow-hidden rounded-full border border-border bg-secondary ring-2 ring-border/60">
                {avatarUrl ? (
                  // Avatar lives on Supabase Storage; next/image is unnecessary for this admin preview.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-4xl font-bold text-primary">
                    {fullName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="w-full">
                <FileField
                  label="Profile photo"
                  name="avatarFile"
                  buttonLabel="Upload photo"
                  help="JPG, PNG, or WebP up to 5 MB. Replaces the current photo on save."
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" name="fullName" defaultValue={fullName} />
                <AvailabilityField
                  defaultValue={site?.availability_status ?? ABOUT_FALLBACK.availabilityStatus}
                />
              </div>
              <I18nInputs prefix="location" label="Location" values={locationValues} />
            </div>
          </div>
        </SectionCard>

        {/* Localized copy */}
        <SectionCard
          id="biography" title="Headline & bio"
          description="Your public tagline and short biography. French is required; Arabic is entered right-to-left."
        >
          <div className="space-y-6">
            <I18nInputs prefix="headline" label="Headline (job title — shown in the hero and search results)" values={headlineValues} />
            <I18nInputs prefix="bio" label="Bio" values={bioValues} textarea />
          </div>
        </SectionCard>

        {/* CV files */}
        <SectionCard
          id="resume" title="CV / résumé files"
          description="Upload localized PDFs. Arabic visitors use the French CV unless a dedicated Arabic CV is added."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <CurrentCvFile label="Current CV (FR)" url={cvUrlFr} />
              <FileField
                label="Upload CV FR (PDF)"
                name="cvFileFr"
                accept="application/pdf"
                buttonLabel="Upload French CV"
                help="PDF up to 10 MB. Replaces the current FR CV on save."
              />
            </div>
            <div className="space-y-3">
              <CurrentCvFile label="Current CV (EN)" url={cvUrlEn} />
              <FileField
                label="Upload CV EN (PDF)"
                name="cvFileEn"
                accept="application/pdf"
                buttonLabel="Upload English CV"
                help="PDF up to 10 MB. Replaces the current EN CV on save."
              />
            </div>
          </div>
        </SectionCard>

        {/* Booking link */}
        <SectionCard
          id="booking" title="Booking link"
          description="A Cal.com or Calendly page. When set, the freelance page shows a “Book a call” button that opens it in a new tab. Leave empty to hide the button."
        >
          <Field
            label="Booking page (https://)"
            name="bookingUrl"
            type="url"
            placeholder="https://cal.com/your-name/30min"
            defaultValue={siteProfile.bookingUrl}
          />
        </SectionCard>

        {/* About uses a single visibility; kept fixed so the public profile is always shown. */}
        <div className="hidden">
          <StatusSelect />
        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Changes go live on the public site after you save.
            </p>
            <div className="ml-auto">
              <FormStatusButton>Save changes</FormStatusButton>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
