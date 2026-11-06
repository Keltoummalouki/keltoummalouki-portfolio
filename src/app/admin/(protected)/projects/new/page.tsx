import { PageHeader } from '@/components/admin/ui'
import ProjectForm from '../ProjectForm'
import { createProjectAction } from '@/features/content/projects.actions'
import { listTechnicalSkillOptions } from '@/features/content/projects.queries'

export default async function NewProjectPage() {
  const technicalSkills = await listTechnicalSkillOptions()

  return (
    <div className="space-y-6">
      <PageHeader title="New project" description="Create a project and add its translations." />
      <ProjectForm
        action={createProjectAction}
        submitLabel="Create project"
        technicalSkills={technicalSkills}
      />
    </div>
  )
}
