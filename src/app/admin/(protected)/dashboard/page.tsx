import { requireAdmin } from '@/features/auth/session'
import { listAdminProjects } from '@/features/content/projects.queries'
import { listAdminArticles } from '@/features/articles/queries'
import { listMessages } from '@/features/inbox/queries'
import { listLeads } from '@/features/freelance/queries'
import DashboardView from './DashboardView'
import type { DashboardRecord } from './analytics'

function title(translations: { locale: string; title: string | null }[]) {
  return translations.find(t => t.locale === 'fr')?.title || translations.find(t => t.title)?.title || 'Untitled'
}

export default async function DashboardPage() {
  await requireAdmin()
  const [projects, articles, messages, leads] = await Promise.all([
    listAdminProjects(), listAdminArticles(), listMessages(), listLeads(),
  ])
  // Send only the display fields needed by the dashboard, never full contact records.
  const records: DashboardRecord[] = [
    ...projects.map(p => ({ id: p.id, kind: 'project' as const, title: title(p.project_translations), detail: 'Portfolio project', status: p.status, createdAt: p.created_at, href: `/admin/projects/${p.id}` })),
    ...articles.map(a => ({ id: a.id, kind: 'article' as const, title: title(a.article_translations), detail: 'Blog article', status: a.status, createdAt: a.created_at, href: `/admin/blog/${a.id}` })),
    ...messages.map(m => ({ id: m.id, kind: 'message' as const, title: m.name, detail: m.subject || 'Contact message', status: m.status, createdAt: m.created_at, href: `/admin/inbox/${m.id}` })),
    ...leads.map(l => ({ id: l.id, kind: 'lead' as const, title: l.name, detail: l.company || 'Freelance inquiry', status: l.status, createdAt: l.created_at, href: `/admin/leads/${l.id}` })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return <DashboardView records={records} now={new Date().toISOString()} />
}
