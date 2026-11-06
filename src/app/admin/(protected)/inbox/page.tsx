import { OverviewMetrics } from '@/components/admin/Workspace'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { listMessages, getStatusCounts } from '@/features/inbox/queries'
import { MESSAGE_STATUSES, messageStatusSchema } from '@/features/inbox/schema'
import { EmptyState, FilterTabs, PageHeader, StatusBadge } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function snippet(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const parsedStatus = messageStatusSchema.safeParse(status)
  const activeStatus = parsedStatus.success ? parsedStatus.data : undefined

  const [messages, counts] = await Promise.all([listMessages(activeStatus), getStatusCounts()])
  const total = MESSAGE_STATUSES.reduce((sum, s) => sum + counts[s], 0)

  const tabs = [
    { key: 'all', label: 'All', count: total, href: '/admin/inbox', active: !activeStatus },
    ...MESSAGE_STATUSES.map((s) => ({
      key: s,
      label: s,
      count: counts[s],
      href: `/admin/inbox?status=${s}`,
      active: s === activeStatus,
    })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" description="Messages submitted through the contact form." />
      <OverviewMetrics items={[{label:'All messages',value:total,hint:'Every conversation',href:'/admin/inbox'},{label:'New',value:counts.new,hint:'Waiting for your attention',href:'/admin/inbox?status=new'},{label:'Read',value:counts.read,hint:'Reviewed messages',href:'/admin/inbox?status=read'},{label:'Replied',value:counts.replied,hint:'Conversations followed up',href:'/admin/inbox?status=replied'}]} />

      <FilterTabs tabs={tabs} ariaLabel="Filter messages by status" />

      {messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={activeStatus ? `No ${activeStatus} messages` : 'No messages yet'}
          description={
            activeStatus
              ? 'Try a different status filter.'
              : 'Messages from your contact form will appear here.'
          }
        />
      ) : (
        <ul className="admin-inbox-list divide-y divide-border overflow-hidden rounded-xl border border-border">
          {messages.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/inbox/${m.id}`}
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-foreground', m.status === 'new' && 'font-semibold')}>
                      {m.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.subject ? <span className="text-foreground">{m.subject} — </span> : null}
                    {snippet(m.message)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={m.status} />
                  <time className="text-xs text-muted-foreground" dateTime={m.created_at}>
                    {formatDate(m.created_at)}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
