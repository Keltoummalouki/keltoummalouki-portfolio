import { CollectionOverview, EditorDisclosure } from '@/components/admin/Workspace'
import { Award, Trash2 } from 'lucide-react'
import { deleteCertificationAction, saveCertificationAction } from '@/features/cms/actions'
import { getAdminCmsData } from '@/features/cms/queries'
import { AdminCard, EmptyState, ErrorNotice, Field, FileField, PageHeader, StatusSelect, TextArea } from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { Button } from '@/components/ui/button'
import { LOCALES, type Locale } from '@/lib/validation/locale'

function tr(
  item: { certification_translations?: { locale: string; name: string; description: string | null }[] },
  locale: Locale,
) {
  return item.certification_translations?.find((t) => t.locale === locale) ?? { name: '', description: '' }
}

function CertificationForm({ item }: { item?: Awaited<ReturnType<typeof getAdminCmsData>>['certifications'][number] }) {
  return (
    <form action={saveCertificationAction} className="space-y-5 rounded-lg border border-border p-4">
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="imageUrl" value={item?.image_url ?? ''} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Issuer" name="issuer" defaultValue={item?.issuer} />
        <Field label="Issue date" name="issueDate" type="date" defaultValue={item?.issue_date} />
        <Field label="Credential URL" name="credentialUrl" type="url" defaultValue={item?.credential_url} />
        <Field label="Order" name="sortOrder" type="number" defaultValue={item?.sort_order ?? 0} />
        <StatusSelect defaultValue={item?.status} />
        <div className="md:col-span-3">
          <FileField label="Upload/replace certificate image or issuer logo" name="imageFile" />
        </div>
      </div>

      {LOCALES.map((locale) => {
        const value = item ? tr(item, locale) : { name: '', description: '' }
        return (
          <div key={locale} className="grid gap-4 md:grid-cols-2">
            <Field
              label={`Name (${locale.toUpperCase()})${locale === 'fr' ? ' *' : ''}`}
              name={`${locale}.name`}
              defaultValue={value.name}
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

      <FormStatusButton>{item ? 'Save certification' : 'Add certification'}</FormStatusButton>
    </form>
  )
}

export default async function AdminCertificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, data] = await Promise.all([searchParams, getAdminCmsData()])
  return (
    <div className="space-y-6">
      <PageHeader
        title="Certifications"
        description="Manage certifications, credential links, images, and translations."
      />
      <CollectionOverview items={data.certifications} label="certifications" />
      <ErrorNotice error={error} />
      <AdminCard title="Add certification">
        <CertificationForm />
      </AdminCard>
      <AdminCard title={`Existing certifications (${data.certifications.length})`}>
        {data.certifications.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No certifications yet"
            description="Add your first credential above to display it in the public Certifications section."
          />
        ) : (
          <div className="space-y-4">
            {data.certifications.map((item) => (
              <EditorDisclosure key={item.id} title={item.certification_translations?.find(t => t.locale === 'fr')?.name || item.issuer || 'Certification'} status={item.status}>
                <CertificationForm item={item} />
                <form action={deleteCertificationAction} className="flex justify-end">
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

