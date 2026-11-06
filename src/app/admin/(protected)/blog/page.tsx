import { CollectionOverview } from '@/components/admin/Workspace'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/ui'
import { listAdminArticles } from '@/features/articles/queries'
import ArticlesTable, { type ArticleRowVM } from './ArticlesTable'

export default async function AdminBlogPage() {
  const articles = await listAdminArticles()

  const rows: ArticleRowVM[] = articles.map((a) => {
    const hasLocale = (loc: string) => a.article_translations.some((t) => t.locale === loc && t.title)
    const frTitle = a.article_translations.find((t) => t.locale === 'fr')?.title
    const anyTitle = a.article_translations[0]?.title

    return {
      id: a.id,
      title: frTitle || anyTitle || '',
      slug: a.slug,
      status: a.status,
      featured: a.featured,
      publishedAt: a.published_at,
      locales: { fr: hasLocale('fr'), en: hasLocale('en'), ar: hasLocale('ar') },
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Write and publish multilingual articles."
        action={
          <Button asChild>
            <Link href="/admin/blog/new">
              <Plus size={16} />
              New article
            </Link>
          </Button>
        }
      />

      <CollectionOverview items={articles} label="articles" />

      <ArticlesTable articles={rows} />
    </div>
  )
}
