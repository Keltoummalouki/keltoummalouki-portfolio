import { CollectionOverview } from '@/components/admin/Workspace'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/ui'
import { listAdminProjects } from '@/features/content/projects.queries'
import ProjectsTable, { type ProjectRowVM } from './ProjectsTable'

export default async function AdminProjectsPage() {
  const projects = await listAdminProjects()

  const rows: ProjectRowVM[] = projects.map((p) => {
    const hasLocale = (loc: string) =>
      p.project_translations.some((t) => t.locale === loc && t.title)
    const frTitle = p.project_translations.find((t) => t.locale === 'fr')?.title
    const anyTitle = p.project_translations[0]?.title

    return {
      id: p.id,
      slug: p.slug,
      title: frTitle || anyTitle || '',
      status: p.status,
      featured: p.featured,
      sortOrder: p.sort_order,
      techCount: p.tech_stack.length,
      locales: { fr: hasLocale('fr'), en: hasLocale('en'), ar: hasLocale('ar') },
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage your portfolio projects and their translations."
        action={
          <Button asChild>
            <Link href="/admin/projects/new">
              <Plus size={16} />
              New project
            </Link>
          </Button>
        }
      />

      <CollectionOverview items={projects} label="projects" />

      <ProjectsTable projects={rows} />
    </div>
  )
}
