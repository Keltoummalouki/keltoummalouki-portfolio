import { CollectionOverview, EditorDisclosure } from '@/components/admin/Workspace'
import { GraduationCap } from 'lucide-react'
import { DeleteButton } from '@/components/admin/ui'
import { deleteEducationAction, saveEducationAction } from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import { AdminCard, EmptyState, ErrorNotice, Field, FileField, PageHeader, StatusSelect, TextArea } from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { LOCALES, type Locale } from '@/lib/validation/locale'

function tr(
  item: { education_translations?: { locale: string; degree: string; field: string | null; description: string | null }[] },
  locale: Locale,
) {
  return item.education_translations?.find((t) => t.locale === locale) ?? { degree: '', field: '', description: '' }
}

function EducationForm({ item }: { item?: Awaited<ReturnType<typeof getAdminCmsData>>['education'][number] }) {
  return (
    <form action={saveEducationAction} className="space-y-5 rounded-lg border border-border p-4">
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="imageUrl" value={item?.image_url ?? ''} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Institution" name="institution" defaultValue={item?.institution} />
        <Field label="Location" name="location" defaultValue={item?.location} />
        <Field label="Start date" name="startDate" type="date" defaultValue={item?.start_date} />
        <Field label="End date" name="endDate" type="date" defaultValue={item?.end_date} />
        <Field label="Order" name="sortOrder" type="number" defaultValue={item?.sort_order ?? 0} />
        <StatusSelect defaultValue={item?.status} />
        <div className="md:col-span-3">
          <FileField label="Upload/replace school logo or image" name="imageFile" />
        </div>
      </div>

      {LOCALES.map((locale) => {
        const value = item ? tr(item, locale) : { degree: '', field: '', description: '' }
        return (
          <div key={locale} className="grid gap-4 md:grid-cols-3">
            <Field
              label={`Degree (${locale.toUpperCase()})${locale === 'fr' ? ' *' : ''}`}
              name={`${locale}.degree`}
              defaultValue={value.degree}
              required={locale === 'fr'}
            />
            <Field label={`Field (${locale.toUpperCase()})`} name={`${locale}.field`} defaultValue={value.field} />
            <TextArea
              label={`Description (${locale.toUpperCase()})`}
              name={`${locale}.description`}
              defaultValue={value.description}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
        )
      })}

      <FormStatusButton>{item ? 'Save education' : 'Add education'}</FormStatusButton>
    </form>
  )
}

export default async function AdminEducationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])
  return (
    <div className="space-y-6">
      <PageHeader title="Education" description="Manage education entries and translated descriptions." />
      <CollectionOverview items={data.education} label="entries" />
      <ErrorNotice error={error} />
      <AdminCard title="Add education">
        <EducationForm />
      </AdminCard>
      <AdminCard title={`Existing education (${data.education.length})`}>
        {data.education.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No education entries yet"
            description="Add your first degree or program above to show it in the public Education section."
          />
        ) : (
          <div className="space-y-4">
            {data.education.map((item) => (
              <EditorDisclosure key={item.id} title={item.institution || 'Education entry'} status={item.status}>
                <EducationForm item={item} />
                <form action={deleteEducationAction} className="flex justify-end">
                  <input type="hidden" name="id" value={item.id} />
                  <DeleteButton />
                </form>
              </EditorDisclosure>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

