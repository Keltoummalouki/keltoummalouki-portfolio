import { StatusBadge } from '@/components/admin/ui'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { getLead } from '@/features/freelance/queries'
import { updateLeadStatusAction } from '@/features/freelance/actions'
import {
  BUDGET_RANGE_LABELS,
  CONTACT_PREFERENCE_LABELS,
  LEAD_STATUSES,
  PROJECT_TYPE_LABELS,
  TIMELINE_LABELS,
} from '@/features/freelance/schema'
import { AdminSelectField } from '@/components/admin/AdminFormControls'
import { Button } from '@/components/ui/button'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function labelOf(map: Record<string, string>, value: string | null): string {
  if (!value) return '—'
  return map[value] ?? value
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const lead = await getLead(id)
  if (!lead) notFound()

  const mailtoSubject = encodeURIComponent('Re: your project inquiry')
  const mailto = `mailto:${lead.email}?subject=${mailtoSubject}`

  const facts: { label: string; value: string }[] = [
    { label: 'Company', value: lead.company ?? '—' },
    { label: 'Project type', value: labelOf(PROJECT_TYPE_LABELS, lead.project_type) },
    { label: 'Budget', value: labelOf(BUDGET_RANGE_LABELS, lead.budget_range) },
    { label: 'Timeline', value: labelOf(TIMELINE_LABELS, lead.timeline) },
    { label: 'Contact preference', value: labelOf(CONTACT_PREFERENCE_LABELS, lead.contact_preference) },
  ]

  return (
    <div className="admin-detail space-y-6">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Back to leads
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{lead.name}</h1>
            <div className="my-2"><StatusBadge status={lead.status} /></div>
            <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline">
              {lead.email}
            </a>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={lead.created_at}>
            {formatDateTime(lead.created_at)}
          </time>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="text-sm text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Details</p>
          {/* Plain text — never rendered as HTML. */}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
            {lead.details ?? '—'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Button asChild>
          <a href={mailto}>
            <Mail size={16} />
            Reply by email
          </a>
        </Button>

        <form action={updateLeadStatusAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={lead.id} />
          <AdminSelectField
            id="status"
            label="Status"
            name="status"
            options={LEAD_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
            defaultValue={lead.status}
            className="w-44"
          />
          <Button type="submit" variant="outline">Update</Button>
        </form>
      </div>
    </div>
  )
}
