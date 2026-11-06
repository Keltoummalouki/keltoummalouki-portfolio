import { PageHeader } from '@/components/admin/ui'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import ProjectForm, { type ProjectFormDefaults } from '../ProjectForm'
import { updateProjectAction } from '@/features/content/projects.actions'
import { getAdminProject, listTechnicalSkillOptions } from '@/features/content/projects.queries'
import { PROJECT_LOCALES } from '@/features/content/projects.schema'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [project, technicalSkills] = await Promise.all([
    getAdminProject(id),
    listTechnicalSkillOptions(),
  ])
  if (!project) notFound()

  const tr = (loc: string) => project.project_translations.find((t) => t.locale === loc)
  const skillIds = [...project.project_skills]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => link.skill_id)

  const defaultValues: ProjectFormDefaults = {
    slug: project.slug,
    status: project.status,
    featured: project.featured,
    sortOrder: project.sort_order,
    skillIds,
    repoUrl: project.repo_url ?? '',
    demoUrl: project.demo_url ?? '',
    coverImageUrl: project.cover_image_url ?? '',
    startedAt: project.started_at ?? '',
    translations: Object.fromEntries(
      PROJECT_LOCALES.map((loc) => [
        loc,
        {
          title: tr(loc)?.title ?? '',
          description: tr(loc)?.description ?? '',
          bodyMarkdown: tr(loc)?.body_markdown ?? '',
        },
      ]),
    ) as ProjectFormDefaults['translations'],
  }

  return (
    <div className="space-y-6">
      <div className="admin-project-editor-heading">
        <PageHeader title="Edit project" description={project.slug} />
        {project.status === 'published' && (
          <a
            href={`/fr/projects/${encodeURIComponent(project.slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View case study
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
      <ProjectForm
        action={updateProjectAction.bind(null, id)}
        submitLabel="Save changes"
        technicalSkills={technicalSkills}
        defaultValues={defaultValues}
      />
    </div>
  )
}
