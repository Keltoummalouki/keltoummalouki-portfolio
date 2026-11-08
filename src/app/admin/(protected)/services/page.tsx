import { CollectionOverview, EditorDisclosure } from '@/components/admin/Workspace'
import { BadgeEuro } from 'lucide-react'
import { DeleteButton } from '@/components/admin/ui'
import { deleteServiceAction, saveServiceAction } from '@/features/cms/actions'
import { formatStartingPrice, type ServiceRow } from '@/features/cms/services'
import { getAdminServices } from '@/features/cms/services.queries'
import { AdminCard, EmptyState, ErrorNotice, Field, I18nInputs, PageHeader, StatusSelect, i18nValues } from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'

function ServiceForm({ service }: { service?: ServiceRow }) {
  return (
    <form action={saveServiceAction} className="space-y-5 rounded-lg border border-border p-4">
      <input type="hidden" name="id" value={service?.id ?? ''} />

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label="Starting price (€)"
          name="priceFrom"
          type="number"
          placeholder="Empty = quote on request"
          defaultValue={service?.price_from ?? ''}
        />
        <Field label="Order" name="sortOrder" type="number" defaultValue={service?.sort_order ?? 0} />
        <StatusSelect defaultValue={service?.status} />
      </div>

      <I18nInputs prefix="title" label="Package name" values={i18nValues(service?.title)} />
      <I18nInputs prefix="description" label="Short description" values={i18nValues(service?.description)} textarea requiredFr={false} />
      <I18nInputs prefix="includes" label="Included (one item per line)" values={i18nValues(service?.includes)} textarea requiredFr={false} />

      <FormStatusButton>{service ? 'Save package' : 'Add package'}</FormStatusButton>
    </form>
  )
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, { items, error: loadError }] = await Promise.all([searchParams, getAdminServices()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services & pricing"
        description="Packages shown on the freelance page, with an optional “starting from” price in euros. Without a price, a package shows “quote on request”."
      />
      <CollectionOverview items={items} label="packages" />
      <ErrorNotice error={error} />
      {loadError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Packages could not be loaded ({loadError}). If this is a new environment, apply
          <code className="mx-1 rounded bg-background/60 px-1">supabase/migrations/20261106120000_service_packages.sql</code>
          first.
        </p>
      )}

      <AdminCard title="Add package">
        <ServiceForm />
      </AdminCard>

      <AdminCard title={`Existing packages (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState
            icon={BadgeEuro}
            title="No packages yet"
            description="The freelance page hides the packages section until you publish one."
          />
        ) : (
          <div className="space-y-4">
            {items.map((service) => (
              <EditorDisclosure
                key={service.id}
                title={i18nValues(service.title).fr || i18nValues(service.title).en}
                subtitle={service.price_from === null ? 'Quote on request' : `From ${formatStartingPrice(service.price_from, 'fr')}`}
                status={service.status}
              >
                <ServiceForm service={service} />
                <form action={deleteServiceAction} className="flex justify-end">
                  <input type="hidden" name="id" value={service.id} />
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
