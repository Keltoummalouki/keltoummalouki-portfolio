import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, Folder, Github } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import Breadcrumbs from '@/components/projects/Breadcrumbs'
import ProjectCard, { type ProjectCardLabels } from '@/components/projects/ProjectCard'
import ProjectLinks from '@/components/projects/ProjectLinks'
import ProjectOverview from '@/components/projects/ProjectOverview'
import StackChips from '@/components/projects/StackChips'
import JsonLd from '@/components/seo/JsonLd'
import Markdown from '@/components/ui/Markdown'
import { getPublishedCmsContent } from '@/features/cms/queries'
import {
  fallbackProjectCards,
  fallbackProjectDetail,
  shouldUseFallback,
} from '@/features/content/projects.fallback'
import {
  caseStudyUrls,
  projectSummary,
  toProjectCard,
  toProjectDetail,
  type ProjectCardData,
  type ProjectDetailData,
} from '@/features/content/projects.map'
import { getPublishedProjectBySlug, getPublishedProjects } from '@/features/content/projects.queries'
import {
  breadcrumbSchema,
  jsonLdGraph,
  personInputFromCms,
  personSchema,
  projectSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata, truncateDescription } from '@/features/seo/metadata'
import { PERSON, absoluteUrl, localePath } from '@/features/seo/site'
import { routing } from '@/i18n/routing'
import { trackClick } from '@/lib/analytics/events'
import type { Locale } from '@/lib/validation/locale'

// Rendered per request so case-study edits appear without a rebuild.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string; slug: string }> }

// Deduplicated per request: generateMetadata and the page share these reads.
const loadProjectRow = cache((slug: string) => getPublishedProjectBySlug(slug))
const loadProjectRows = cache(() => getPublishedProjects())

interface ResolvedCaseStudy {
  project: ProjectDetailData
  /** Other projects, for the "More projects" internal links. */
  others: ProjectCardData[]
}

/**
 * The published project for `slug`, or — only when the database lists no
 * published project at all (unreachable or empty) — the static fallback for the
 * two featured slugs. Null means 404 (unknown, draft or archived project).
 */
const resolveCaseStudy = cache(async (slug: string, locale: Locale): Promise<ResolvedCaseStudy | null> => {
  const [row, rows, projectsT] = await Promise.all([
    loadProjectRow(slug),
    loadProjectRows(),
    getTranslations({ locale, namespace: 'projects' }),
  ])

  if (row) {
    const project = toProjectDetail(row, locale)
    if (!project.title) return null
    const others = rows
      .filter((other) => other.slug !== project.slug)
      .map((other) => toProjectCard(other, locale))
      .filter((other) => other.title)
    return { project, others }
  }

  if (!shouldUseFallback(slug, rows.length)) return null
  const translate = (key: string) => projectsT(key)
  const project = fallbackProjectDetail(slug, translate, locale)
  if (!project) return null
  return { project, others: fallbackProjectCards(translate).filter((other) => other.slug !== slug) }
})

/** Meta/JSON-LD description: description > case-study intro > identity sentence. */
function caseStudyDescription(project: ProjectDetailData, fallback: string): string {
  return truncateDescription(projectSummary(project) || fallback)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) return {}

  const resolved = await resolveCaseStudy(slug, locale)
  if (!resolved) return { robots: { index: false, follow: true } }
  const { project } = resolved

  const [t, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'projectPages' }),
    getTranslations({ locale, namespace: 'seo' }),
  ])
  const { path, localizedPaths, canonicalLocale } = caseStudyUrls(project, locale)

  return buildPageMetadata({
    locale: canonicalLocale,
    path,
    localizedPaths,
    title: t('detail.metaTitle', { title: project.title }),
    description: caseStudyDescription(project, t('detail.metaDescriptionFallback', { title: project.title })),
    type: 'article',
    modifiedTime: project.updatedAt,
    authors: [PERSON.name],
    images: project.image
      ? [{ url: project.image, alt: t('coverAlt', { title: project.title }) }]
      : [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

export default async function ProjectCaseStudyPage({ params }: PageProps) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  const [resolved, t, projectsT, seo, nav, hero, cms] = await Promise.all([
    resolveCaseStudy(slug, locale),
    getTranslations({ locale, namespace: 'projectPages' }),
    getTranslations({ locale, namespace: 'projects' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'hero' }),
    getPublishedCmsContent(locale),
  ])
  if (!resolved) notFound()
  const { project, others } = resolved

  const { path, canonicalLocale } = caseStudyUrls(project, locale)
  const pagePath = localePath(canonicalLocale, path)
  const projectsPath = localePath(locale, '/projects')
  const title = project.title
  const description = caseStudyDescription(project, t('detail.metaDescriptionFallback', { title }))

  // The UI follows the requested locale; the case-study text keeps the
  // language it is written in (only differs when a translation is missing).
  const translated = project.contentLocale === locale
  const contentLang = translated
    ? {}
    : { lang: project.contentLocale, dir: project.contentLocale === 'ar' ? 'rtl' : 'ltr' }

  const linkLabels = {
    viewCode: t('viewCode'),
    viewCodeAria: t('viewCodeAria', { title }),
    liveDemo: t('liveDemo'),
    liveDemoAria: t('liveDemoAria', { title }),
  }
  const cardLabels = (card: ProjectCardData): ProjectCardLabels => ({
    readCaseStudy: t('readCaseStudy'),
    readCaseStudyAria: t('readCaseStudyAria', { title: card.title }),
    viewCode: t('viewCode'),
    viewCodeAria: t('viewCodeAria', { title: card.title }),
    liveDemo: t('liveDemo'),
    liveDemoAria: t('liveDemoAria', { title: card.title }),
    coverAlt: t('coverAlt', { title: card.title }),
    stack: projectsT('techStack'),
  })
  const stackSentence =
    project.stack.length > 0
      ? t('detail.stackSentence', {
          title,
          stack: new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(project.stack),
        })
      : null

  const jsonLd = jsonLdGraph(
    projectSchema({
      path: pagePath,
      name: title,
      description,
      locale: project.contentLocale,
      image: project.image,
      repoUrl: project.github,
      demoUrl: project.demo,
      technologies: project.stack,
      dateCreated: project.startedAt,
      dateModified: project.updatedAt,
    }),
    webPageSchema({
      path: pagePath,
      name: t('detail.metaTitle', { title }),
      description,
      locale: project.contentLocale,
      mainEntityId: `${absoluteUrl(pagePath)}#project`,
      hasBreadcrumb: true,
      primaryImage: project.image || undefined,
      dateModified: project.updatedAt || undefined,
    }),
    breadcrumbSchema(pagePath, [
      { name: nav('home'), path: localePath(locale, '/') },
      { name: nav('projects'), path: projectsPath },
      { name: title, path: pagePath },
    ]),
    websiteSchema({ description: seo('defaultDescription') }),
    personSchema(personInputFromCms(cms, { jobTitle: hero('role'), description: seo('defaultDescription') })),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />
      <main id="main-content" className="section-padding">
        <div className="container-main max-w-6xl">
          <Breadcrumbs
            label={t('breadcrumbLabel')}
            items={[
              { name: nav('home'), href: '/' },
              { name: nav('projects'), href: '/projects' },
              { name: title },
            ]}
          />

          <article className="mt-8">
            <header className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('detail.eyebrow')}</p>
              <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl" {...contentLang}>
                {title}
              </h1>
              {project.description && (
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground" {...contentLang}>
                  {project.description}
                </p>
              )}
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {t.rich('detail.byline', {
                    author: (chunks) => (
                      <Link
                        href="/about"
                        className="rounded-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
                {project.dateLabel && (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={project.startedAt ?? undefined}>{project.dateLabel}</time>
                  </>
                )}
              </p>
              <ProjectLinks
                github={project.github}
                demo={project.demo}
                labels={linkLabels}
                track={{ project: project.slug, from: 'case-study' }}
                className="mt-6"
              />
            </header>

            {!translated && (
              <p className="mt-6 max-w-3xl rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                {t('detail.languageNote')}
              </p>
            )}

            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-secondary">
              {project.image ? (
                <Image
                  src={project.image}
                  alt={t('coverAlt', { title })}
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 1152px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-violet-500/10 text-primary">
                  <Folder size={48} aria-hidden />
                </div>
              )}
            </div>

            <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 max-w-3xl" {...contentLang}>
                {project.bodyMarkdown ? (
                  <Markdown className="[&>h2:first-child]:mt-0">{project.bodyMarkdown}</Markdown>
                ) : (
                  <ProjectOverview
                    description={project.description}
                    labels={{
                      overviewTitle: t('detail.overviewTitle'),
                      overviewIntro: t('detail.overviewIntro', { title }),
                      stackTitle: t('detail.stackTitle'),
                      stackSentence,
                    }}
                  />
                )}
              </div>

              <aside aria-labelledby="project-details-title" className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
                <h2 id="project-details-title" className="text-lg font-semibold text-foreground">
                  {t('detail.factsTitle')}
                </h2>
                <dl className="mt-4 space-y-5 text-sm">
                  {project.dateLabel && (
                    <div>
                      <dt className="font-medium text-foreground">{t('detail.factDate')}</dt>
                      <dd className="mt-1 text-muted-foreground">
                        <time dateTime={project.startedAt ?? undefined}>{project.dateLabel}</time>
                      </dd>
                    </div>
                  )}
                  {project.stackItems.length > 0 && (
                    <div>
                      <dt className="font-medium text-foreground">{t('detail.factStack')}</dt>
                      <dd className="mt-2">
                        <StackChips items={project.stackItems} label={t('detail.factStack')} />
                      </dd>
                    </div>
                  )}
                  {(project.github || project.demo) && (
                    <div>
                      <dt className="font-medium text-foreground">{t('detail.factLinks')}</dt>
                      <dd className="mt-2 space-y-2">
                        {project.github && (
                          <a
                            href={project.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 break-all rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            {...trackClick('project-code', { project: project.slug, from: 'case-study' })}
                          >
                            <Github size={16} aria-hidden className="shrink-0" />
                            <span dir="ltr">{project.github.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </a>
                        )}
                        {project.demo && (
                          <a
                            href={project.demo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 break-all rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            {...trackClick('project-demo', { project: project.slug, from: 'case-study' })}
                          >
                            <ArrowRight size={16} aria-hidden className="shrink-0 rtl:rotate-180" />
                            <span dir="ltr">{project.demo.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </a>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </aside>
            </div>
          </article>

          <section aria-labelledby="more-projects-title" className="mt-20 border-t border-border pt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="more-projects-title" className="text-2xl font-bold text-foreground sm:text-3xl">
                {t('detail.moreTitle')}
              </h2>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('viewAll')}
                <ArrowRight size={16} aria-hidden className="rtl:rotate-180" />
              </Link>
            </div>
            {others.length > 0 && (
              <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                {others.map((other) => (
                  <li key={other.id}>
                    <ProjectCard project={other} labels={cardLabels(other)} from="more-projects" headingLevel="h3" showStack={false} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer links={cms.socialLinks} />
    </div>
  )
}
