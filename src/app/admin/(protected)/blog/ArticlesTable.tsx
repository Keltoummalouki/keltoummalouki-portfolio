'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Star } from 'lucide-react'
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
import { deleteArticleAction } from '@/features/articles/actions'
import {
  ARTICLE_LOCALES,
  ARTICLE_STATUSES,
  type ArticleLocale,
  type ArticleStatus,
} from '@/features/articles/schema'

export interface ArticleRowVM {
  id: string
  title: string
  slug: string
  status: ArticleStatus
  featured: boolean
  publishedAt: string | null
  locales: Record<ArticleLocale, boolean>
}

const control =
  'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'

export default function ArticlesTable({ articles }: { articles: ArticleRowVM[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ArticleStatus | 'all'>('all')

  const filtered = articles.filter((a) => {
    const needle = q.trim().toLowerCase()
    const matchesQ =
      !needle || a.title.toLowerCase().includes(needle) || a.slug.toLowerCase().includes(needle)
    const matchesStatus = status === 'all' || a.status === status
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
          aria-label="Search articles"
          className={cn(control, 'sm:max-w-xs sm:flex-1')}
        />
        <Select value={status} onValueChange={(next) => setStatus(next as ArticleStatus | 'all')}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              {ARTICLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="admin-result-count" role="status">{filtered.length} of {articles.length} articles</span>
        {(q || status !== 'all') && <button type="button" className="admin-clear-filters" onClick={() => { setQ(''); setStatus('all') }}>Clear filters</button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={articles.length === 0 ? 'No articles yet' : 'No matching articles'}
          description={
            articles.length === 0
              ? 'Write your first article to start your blog.'
              : 'No articles match your search and filters.'
          }
          action={
            articles.length === 0 ? (
              <Button asChild size="sm">
                <Link href="/admin/blog/new">Write article</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={table.shell}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Article</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Featured</th>
                <th className={table.th}>Locales</th>
                <th className={cn(table.th, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {filtered.map((a) => (
                <tr key={a.id} className={table.tr}>
                  <td className={table.td}>
                    <div className="font-medium text-foreground">
                      {a.title || <span className="text-muted-foreground">(untitled)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.slug}</div>
                  </td>
                  <td className={table.td}>
                    <StatusBadge status={a.status} />
                  </td>
                  <td className={table.td}>
                    {a.featured ? (
                      <Star size={16} className="fill-current text-amber-500" aria-label="Featured" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={table.td}>
                    <div className="flex gap-1">
                      {ARTICLE_LOCALES.map((loc) => (
                        <span
                          key={loc}
                          title={a.locales[loc] ? `${loc} translated` : `${loc} missing`}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                            a.locales[loc]
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
                      <EditLink href={`/admin/blog/${a.id}`} label={`Edit ${a.title || 'article'}`} />
                      <form
                        action={deleteArticleAction}
                        onSubmit={(e) => {
                          if (!confirm('Delete this article? This cannot be undone.')) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={a.id} />
                        <DeleteButton label={`Delete ${a.title || 'article'}`} />
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
