import { PageHeader } from '@/components/admin/ui'
import { notFound } from 'next/navigation'
import ArticleForm, { type ArticleFormDefaults } from '../ArticleForm'
import { updateArticleAction } from '@/features/articles/actions'
import { getAdminArticle } from '@/features/articles/queries'
import { ARTICLE_LOCALES } from '@/features/articles/schema'

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const article = await getAdminArticle(id)
  if (!article) notFound()

  const tr = (loc: string) => article.article_translations.find((t) => t.locale === loc)
  const translations = Object.fromEntries(
    ARTICLE_LOCALES.map((loc) => {
      const t = tr(loc)
      return [
        loc,
        {
          slug: t?.slug ?? '',
          title: t?.title ?? '',
          excerpt: t?.excerpt ?? '',
          body: t?.body_markdown ?? '',
          seoTitle: t?.seo_title ?? '',
          seoDescription: t?.seo_description ?? '',
        },
      ]
    }),
  ) as ArticleFormDefaults['translations']

  const defaultValues: ArticleFormDefaults = {
    status: article.status,
    featured: article.featured,
    coverImageUrl: article.cover_image_url ?? '',
    authorName: article.author_name ?? '',
    publishedAt: article.published_at ? article.published_at.slice(0, 10) : '',
    translations,
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit article" description={article.slug} />
      <ArticleForm
        action={updateArticleAction.bind(null, id)}
        submitLabel="Save changes"
        defaultValues={defaultValues}
      />
    </div>
  )
}
