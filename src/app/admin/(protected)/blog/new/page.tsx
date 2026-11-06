import { PageHeader } from '@/components/admin/ui'
import ArticleForm from '../ArticleForm'
import { createArticleAction } from '@/features/articles/actions'

export default function NewArticlePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New article" description="Draft an article and add its translations." />
      <ArticleForm action={createArticleAction} submitLabel="Create article" />
    </div>
  )
}
