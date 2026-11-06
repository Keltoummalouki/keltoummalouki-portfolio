import { CollectionOverview, EditorDisclosure } from '@/components/admin/Workspace'
import { Languages as LanguagesIcon, Trash2 } from 'lucide-react'
import { deleteLanguageAction, saveLanguageAction } from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import { AdminCard, EmptyState, ErrorNotice, Field, I18nInputs, PageHeader, StatusSelect, i18nValues } from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { Button } from '@/components/ui/button'

type LanguageItem = Awaited<ReturnType<typeof getAdminCmsData>>['languages'][number]

function LanguageForm({ item }: { item?: LanguageItem }) {
  return (
    <form action={saveLanguageAction} className="space-y-5 rounded-lg border border-border p-4">
      <input type="hidden" name="id" value={item?.id ?? ''} />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Icon key" name="icon" defaultValue={item?.icon} placeholder="globe" />
        <Field label="Order" name="sortOrder" type="number" defaultValue={item?.sort_order ?? 0} />
        <StatusSelect defaultValue={item?.status} />
      </div>

      <I18nInputs prefix="name" label="Language name" values={i18nValues(item?.name)} />
      <I18nInputs prefix="level" label="Level" values={i18nValues(item?.level)} requiredFr={false} />

      <FormStatusButton>{item ? 'Save language' : 'Add language'}</FormStatusButton>
    </form>
  )
}

export default async function AdminLanguagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Languages"
        description="Manage public spoken languages and levels shown in the About section."
      />
      <CollectionOverview items={data.languages} label="languages" />
      <ErrorNotice error={error} />

      <AdminCard title="Add language">
        <LanguageForm />
      </AdminCard>

      <AdminCard title={`Existing languages (${data.languages.length})`}>
        {data.languages.length === 0 ? (
          <EmptyState
            icon={LanguagesIcon}
            title="No languages yet"
            description="Add Arabic, French, and English to replace the fallback content in the About section."
          />
        ) : (
          <div className="space-y-4">
            {data.languages.map((item) => (
              <EditorDisclosure key={item.id} title={i18nValues(item.name).fr || i18nValues(item.name).en} status={item.status}>
                <LanguageForm item={item} />
                <form action={deleteLanguageAction} className="flex justify-end">
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </form>
              </EditorDisclosure>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
