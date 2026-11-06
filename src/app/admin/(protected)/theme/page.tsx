import { EditorGuide } from '@/components/admin/Workspace'
import { saveDesignSettingsAction } from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import {
  CURSOR_OPTIONS,
  DEFAULT_PUBLIC_NAV_ITEMS,
  FONT_OPTIONS,
  HEADER_POSITIONS,
  NAV_ITEMS,
  normalizeNavItems,
  type CursorKey,
  type FontKey,
  type HeaderPosition,
} from '@/features/cms/design-options'
import { ErrorNotice, PageHeader, SectionCard } from '@/components/admin/CmsAdmin'
import { AdminSelectField, ColorPickerField } from '@/components/admin/AdminFormControls'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { cn } from '@/lib/utils'
import { PaginatedCursorPicker, PaginatedFontPicker } from './ThemeOptionPickers'

const fontValues = FONT_OPTIONS.map((font) => font.value)
const cursorValues = CURSOR_OPTIONS.map((cursor) => cursor.value)
const positionValues = HEADER_POSITIONS.map((position) => position.value)

function validFont(value: string | null | undefined, fallback: FontKey): FontKey {
  return fontValues.includes(value as FontKey) ? (value as FontKey) : fallback
}

function validCursor(value: string | null | undefined): CursorKey {
  return cursorValues.includes(value as CursorKey) ? (value as CursorKey) : 'default'
}

function validPosition(value: string | null | undefined): HeaderPosition {
  return positionValues.includes(value as HeaderPosition) ? (value as HeaderPosition) : 'bottom'
}

// Small uppercase label matching the subheaders rendered inside the paginated
// pickers, so subsections read consistently within a card.
function SubHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function HeaderPreview({ position }: { position: HeaderPosition }) {
  return (
    <span className="relative block h-24 rounded-xl border border-border bg-background/80 p-3">
      <span className="absolute inset-3 rounded-lg border border-border/70" />
      <span
        className={cn(
          'absolute rounded-full bg-primary shadow-lg shadow-primary/20',
          position === 'bottom' && 'bottom-4 left-6 right-6 h-2',
          position === 'left' && 'bottom-5 left-4 top-5 w-2',
          position === 'right' && 'bottom-5 right-4 top-5 w-2',
        )}
      />
      <span className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-md bg-secondary" />
    </span>
  )
}

function HeaderPositionCard({
  option,
  selected,
}: {
  option: (typeof HEADER_POSITIONS)[number]
  selected: HeaderPosition
}) {
  return (
    <label className="group cursor-pointer">
      <input
        type="radio"
        name="headerPosition"
        value={option.value}
        defaultChecked={selected === option.value}
        className="peer sr-only"
      />
      <span className="block h-full rounded-2xl border border-border bg-background/70 p-4 transition duration-200 hover:border-primary/40 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50">
        <HeaderPreview position={option.value} />
        <span className="mt-3 block text-sm font-semibold text-foreground">{option.label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{option.tone}</span>
      </span>
    </label>
  )
}

export default async function AdminThemePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])
  const design = data.design
  const selectedBodyFont = validFont(design?.font_body, 'space-grotesk')
  const selectedHeadingFont = validFont(design?.font_heading, 'archivo')
  const selectedCursor = validCursor(design?.cursor_style)
  const selectedHeaderPosition = validPosition(design?.header_position)
  const selectedNavItems = normalizeNavItems(design?.nav_items ?? DEFAULT_PUBLIC_NAV_ITEMS)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Theme & design"
        description="Control safe presets for colors, fonts, cursor, header position, and public navigation."
      />
      <ErrorNotice error={error} />
      <EditorGuide items={[{"href":"#brand","label":"Brand","detail":"Colors & defaults"},{"href":"#typography","label":"Typography","detail":"Your reading experience"},{"href":"#interface","label":"Interface","detail":"Cursor & navigation position"},{"href":"#navigation","label":"Navigation","detail":"What visitors can explore"}]} />

      <form action={saveDesignSettingsAction} className="space-y-6">
        {/* Colors + defaults */}
        <SectionCard
          id="brand" title="Brand & defaults"
          description="Accent colors and the locale/theme visitors see first. Colors drive buttons, links, and highlights."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorPickerField label="Primary color" name="primaryColor" defaultValue={design?.primary_color ?? '#2563EB'} />
            <ColorPickerField label="Accent color" name="accentColor" defaultValue={design?.accent_color ?? '#8B5CF6'} />
            <AdminSelectField
              id="defaultLocale"
              label="Default locale"
              name="defaultLocale"
              defaultValue={design?.default_locale ?? 'fr'}
              options={[
                { value: 'fr', label: 'French', description: 'Shown first to new visitors' },
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'Arabic', description: 'Right-to-left layout' },
              ]}
            />
            <AdminSelectField
              id="defaultTheme"
              label="Default theme"
              name="defaultTheme"
              defaultValue={design?.default_theme ?? 'dark'}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System', description: "Follow the visitor's device" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Typography */}
        <SectionCard
          id="typography" title="Typography"
          description="Pick the fonts used across the public site. Previews render in the actual typeface."
        >
          <div className="space-y-8">
            <PaginatedFontPicker
              title="Body font"
              description="Affects normal paragraphs, forms, and cards."
              name="fontBody"
              selected={selectedBodyFont}
            />
            <PaginatedFontPicker
              title="Heading font"
              description="Affects section titles, the hero title, and article headings."
              name="fontHeading"
              selected={selectedHeadingFont}
            />
          </div>
        </SectionCard>

        {/* Interface: cursor + header position */}
        <SectionCard
          id="interface" title="Interface"
          description="Pointer style and where the floating public navigation sits."
        >
          <div className="space-y-8">
            <PaginatedCursorPicker selected={selectedCursor} />

            <div className="space-y-3">
              <SubHeading
                title="Header position"
                description="Choose where the public section dock should float."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {HEADER_POSITIONS.map((option) => (
                  <HeaderPositionCard key={option.value} option={option} selected={selectedHeaderPosition} />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Public navigation */}
        <SectionCard
          id="navigation" title="Public navigation links"
          description="Select the links shown in the public header. Admin/login/profile links become visible to visitors when enabled."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {NAV_ITEMS.map((item) => (
              <label key={item.value} className="group cursor-pointer">
                <input
                  type="checkbox"
                  name="navItems"
                  value={item.value}
                  defaultChecked={selectedNavItems.includes(item.value)}
                  className="peer sr-only"
                />
                <span className="flex h-full items-start justify-between gap-3 rounded-2xl border border-border bg-background/70 p-4 transition duration-200 hover:border-primary/40 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{item.href}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.kind}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Sticky save bar */}
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Presets are validated, then applied across the public site after saving.
            </p>
            <div className="ml-auto">
              <FormStatusButton>Save design settings</FormStatusButton>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
