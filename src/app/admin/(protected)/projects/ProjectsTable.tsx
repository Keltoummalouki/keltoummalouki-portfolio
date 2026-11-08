'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderKanban, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeleteButton, EditLink, EmptyState, StatusBadge, table } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { deleteProjectAction } from '@/features/content/projects.actions'
import {
  PROJECT_LOCALES,
  PROJECT_STATUSES,
  type ProjectLocale,
  type ProjectStatus,
} from '@/features/content/projects.schema'

export interface ProjectRowVM {
  id: string
  slug: string
  title: string
  status: ProjectStatus
  featured: boolean
  sortOrder: number
  techCount: number
  locales: Record<ProjectLocale, boolean>
}

const control =
  'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'

export default function ProjectsTable({ projects }: { projects: ProjectRowVM[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')

  const filtered = projects.filter((p) => {
    const needle = q.trim().toLowerCase()
    const matchesQ =
      !needle || p.title.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle)
    const matchesStatus = status === 'all' || p.status === status
    return matchesQ && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="admin-collection-toolbar flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title or slug…"
          aria-label="Search projects"
          className={cn(control, 'sm:max-w-xs sm:flex-1')}
        />
        <Select value={status} onValueChange={(next) => setStatus(next as ProjectStatus | 'all')}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="admin-result-count" role="status">{filtered.length} of {projects.length} projects</span>
        {(q || status !== 'all') && <button type="button" className="admin-clear-filters" onClick={() => { setQ(''); setStatus('all') }}>Clear filters</button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={projects.length === 0 ? 'No projects yet' : 'No matching projects'}
          description={
            projects.length === 0
              ? 'Create your first portfolio project to get started.'
              : 'No projects match your search and filters.'
          }
          action={
            projects.length === 0 ? (
              <Button asChild size="sm">
                <Link href="/admin/projects/new">New project</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={table.shell}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Project</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Featured</th>
                <th className={table.th}>Order</th>
                <th className={table.th}>Locales</th>
                <th className={cn(table.th, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {filtered.map((p) => (
                <tr key={p.id} className={table.tr}>
                  <td className={table.td}>
                    <div className="font-medium text-foreground">
                      {p.title || <span className="text-muted-foreground">(untitled)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
                  </td>
                  <td className={table.td}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className={table.td}>
                    {p.featured ? (
                      <Star size={16} className="fill-current text-amber-500" aria-label="Featured" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn(table.td, 'text-muted-foreground tabular-nums')}>{p.sortOrder}</td>
                  <td className={table.td}>
                    <div className="flex gap-1">
                      {PROJECT_LOCALES.map((loc) => (
                        <span
                          key={loc}
                          title={p.locales[loc] ? `${loc} translated` : `${loc} missing`}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                            p.locales[loc]
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground/60',
                          )}
                        >
                          {loc}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={table.td}>
                    <div className="flex justify-end gap-2">
                      <EditLink href={`/admin/projects/${p.id}`} label={`Edit ${p.title || 'project'}`} />
                      <form
                        action={deleteProjectAction}
                        onSubmit={(e) => {
                          if (!confirm('Delete this project? This cannot be undone.')) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <DeleteButton label={`Delete ${p.title || 'project'}`} />
                      </form>
                    </div>
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
