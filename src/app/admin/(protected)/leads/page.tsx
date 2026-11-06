import { OverviewMetrics } from '@/components/admin/Workspace'
import Link from 'next/link'
import { Target } from 'lucide-react'
import { listLeads, getLeadStatusCounts } from '@/features/freelance/queries'
import {
  BUDGET_RANGE_LABELS,
  LEAD_STATUSES,
  PROJECT_TYPE_LABELS,
  leadStatusSchema,
} from '@/features/freelance/schema'
import { EmptyState, FilterTabs, PageHeader, StatusBadge, table } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const parsedStatus = leadStatusSchema.safeParse(status)
  const activeStatus = parsedStatus.success ? parsedStatus.data : undefined

  const [leads, counts] = await Promise.all([listLeads(activeStatus), getLeadStatusCounts()])
  const total = LEAD_STATUSES.reduce((sum, s) => sum + counts[s], 0)

  const tabs = [
    { key: 'all', label: 'All', count: total, href: '/admin/leads', active: !activeStatus },
    ...LEAD_STATUSES.map((s) => ({
      key: s,
      label: s,
      count: counts[s],
      href: `/admin/leads?status=${s}`,
      active: s === activeStatus,
    })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Freelance leads" description="Project inquiries from your freelance form." />
      <OverviewMetrics items={[{label:'All opportunities',value:total,hint:'Your freelance pipeline',href:'/admin/leads'},{label:'New inquiries',value:counts.new,hint:'Start a conversation',href:'/admin/leads?status=new'},{label:'In progress',value:counts.qualified+counts.meeting+counts.proposal,hint:'Qualified, meeting, or proposal'},{label:'Won',value:counts.won,hint:'Successful opportunities',href:'/admin/leads?status=won'}]} />

      <FilterTabs tabs={tabs} ariaLabel="Filter leads by status" />

      {leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title={activeStatus ? `No ${activeStatus} leads` : 'No leads yet'}
          description={
            activeStatus
              ? 'Try a different status filter.'
              : 'Inquiries from your freelance form will appear here.'
          }
        />
      ) : (
        <div className={table.shell}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Lead</th>
                <th className={table.th}>Project</th>
                <th className={table.th}>Budget</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Received</th>
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {leads.map((lead) => (
                <tr key={lead.id} className={table.tr}>
                  <td className={table.td}>
                    <Link href={`/admin/leads/${lead.id}`} className="block">
                      <div className={cn('font-medium text-foreground', lead.status === 'new' && 'font-semibold')}>
                        {lead.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {lead.company ? `${lead.company} · ` : ''}{lead.email}
                      </div>
                    </Link>
                  </td>
                  <td className={cn(table.td, 'text-muted-foreground')}>
                    {lead.project_type ? (PROJECT_TYPE_LABELS[lead.project_type] ?? lead.project_type) : '—'}
                  </td>
                  <td className={cn(table.td, 'text-muted-foreground')}>
                    {lead.budget_range ? (BUDGET_RANGE_LABELS[lead.budget_range] ?? lead.budget_range) : '—'}
                  </td>
                  <td className={table.td}>
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className={table.td}>
                    <time className="text-xs text-muted-foreground" dateTime={lead.created_at}>
                      {formatDate(lead.created_at)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
