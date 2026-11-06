import { CollectionOverview, EditorDisclosure } from '@/components/admin/Workspace'
import { MessageCircleQuestion, Trash2 } from 'lucide-react'
import { deleteFaqItemAction, saveFaqItemAction } from '@/features/cms/actions'
import type { FaqItemRow } from '@/features/cms/faq'
import { getAdminFaqItems } from '@/features/cms/faq.queries'
import { AdminCard, EmptyState, ErrorNotice, Field, I18nInputs, PageHeader, StatusSelect, i18nValues } from '@/components/admin/CmsAdmin'
import FormStatusButton from '@/components/admin/FormStatusButton'
import { Button } from '@/components/ui/button'

function FaqItemForm({ item }: { item?: FaqItemRow }) {
  return (
    <form action={saveFaqItemAction} className="space-y-5 rounded-lg border border-border p-4">
      <input type="hidden" name="id" value={item?.id ?? ''} />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Order" name="sortOrder" type="number" defaultValue={item?.sort_order ?? 0} />
        <StatusSelect defaultValue={item?.status} />
      </div>

      <I18nInputs prefix="question" label="Question" values={i18nValues(item?.question)} />
      <I18nInputs prefix="answer" label="Answer" values={i18nValues(item?.answer)} textarea />

      <FormStatusButton>{item ? 'Save question' : 'Add question'}</FormStatusButton>
    </form>
  )
}

export default async function AdminFaqPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, { items, error: loadError }] = await Promise.all([searchParams, getAdminFaqItems()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQ"
        description="Popular questions shown on the freelance page (also published as FAQ structured data for search engines)."
      />
      <CollectionOverview items={items} label="questions" />
      <ErrorNotice error={error} />
      {loadError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          FAQ items could not be loaded ({loadError}). If this is a new environment, apply
          <code className="mx-1 rounded bg-background/60 px-1">supabase/migrations/20261004120000_reviews_and_faq.sql</code>
          first.
        </p>
      )}

      <AdminCard title="Add question">
        <FaqItemForm />
      </AdminCard>

      <AdminCard title={`Existing questions (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState
            icon={MessageCircleQuestion}
            title="No questions yet"
            description="The freelance page shows the default questions from the translation files until you publish your own."
          />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <EditorDisclosure key={item.id} title={i18nValues(item.question).fr || i18nValues(item.question).en} status={item.status}>
                <FaqItemForm item={item} />
                <form action={deleteFaqItemAction} className="flex justify-end">
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
