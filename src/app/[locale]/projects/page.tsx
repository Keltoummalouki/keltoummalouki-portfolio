import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { ArrowUpRight } from 'lucide-react'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import Breadcrumbs from '@/components/projects/Breadcrumbs'
import ProjectCard, { type ProjectCardLabels } from '@/components/projects/ProjectCard'
import JsonLd from '@/components/seo/JsonLd'
import Pagination from '@/components/ui/Pagination'
import { getPublishedCmsContent } from '@/features/cms/queries'
import { fallbackProjectCards } from '@/features/content/projects.fallback'
import { toProjectCard, type ProjectCardData } from '@/features/content/projects.map'
import { getPublishedProjects } from '@/features/content/projects.queries'
import {
  breadcrumbSchema,
  itemListSchema,
  jsonLdGraph,
  personInputFromCms,
  personSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata } from '@/features/seo/metadata'
import { FALLBACK_SAME_AS, absoluteUrl, localePath } from '@/features/seo/site'
import { routing } from '@/i18n/routing'
import { pagePath, paginate, parsePageParam } from '@/lib/pagination'

// Rendered per request because of the ?page= parameter; its data reads are
// cookie-free, so they no longer depend on who is visiting.

/** Case studies per page (2-column grid). Pages are crawlable: /projects?page=N. */
const PROJECTS_PER_PAGE = 6

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const page = parsePageParam((await searchParams).page)

  const [t, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'projectPages.index' }),
    getTranslations({ locale, namespace: 'seo' }),
  ])
  // Each page is self-canonical with a distinct title (Google indexes pages 2+
  // on their own; canonicalising them to page 1 would hide their projects).
  return buildPageMetadata({
    locale,
    path: pagePath('/projects', page),
    title: page > 1 ? `${t('metaTitle')} — ${t('pageTitleSuffix', { page })}` : t('metaTitle'),
    absoluteTitle: true,
    description: t('metaDescription'),
    // Explicit: a page-level `openGraph` replaces the layout's file-based image.
    images: [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

export default async function ProjectsIndexPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const requestedPage = parsePageParam((await searchParams).page)

  const [t, projectsT, seo, nav, hero, rows, cms] = await Promise.all([
    getTranslations({ locale, namespace: 'projectPages' }),
    getTranslations({ locale, namespace: 'projects' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'hero' }),
    getPublishedProjects(),
    getPublishedCmsContent(locale),
  ])

  // Database projects when any are published; otherwise (empty or unreachable
  // database) the same static projects as the home ProjectsSection.
  const projects: ProjectCardData[] =
    rows.length > 0
      ? rows.map((row) => toProjectCard(row, locale)).filter((project) => project.title)
      : fallbackProjectCards((key) => projectsT(key))
  const slice = paginate(projects, requestedPage, PROJECTS_PER_PAGE)
  // ?page=99 must not render (and get indexed as) a copy of the last page.
  if (requestedPage > slice.totalPages) notFound()

  const labelsFor = (project: ProjectCardData): ProjectCardLabels => ({
    readCaseStudy: t('readCaseStudy'),
    readCaseStudyAria: t('readCaseStudyAria', { title: project.title }),
    viewCode: t('viewCode'),
    viewCodeAria: t('viewCodeAria', { title: project.title }),
    liveDemo: t('liveDemo'),
    liveDemoAria: t('liveDemoAria', { title: project.title }),
    coverAlt: t('coverAlt', { title: project.title }),
    stack: projectsT('techStack'),
  })

  const person = personInputFromCms(cms, { jobTitle: hero('role'), description: seo('defaultDescription') })
  const githubUrl =
    [...(person.sameAs ?? []), ...FALLBACK_SAME_AS].find((url) => /^https:\/\/github\.com\//i.test(url)) ??
    FALLBACK_SAME_AS[0]

  const listPath = localePath(locale, '/projects')
  const currentPath = localePath(locale, pagePath('/projects', slice.page))
  const jsonLd = jsonLdGraph(
    webPageSchema({
      type: 'CollectionPage',
      path: currentPath,
      name: t('index.title'),
      description: t('index.metaDescription'),
      locale,
      hasBreadcrumb: true,
      mainEntityId: slice.items.length > 0 ? `${absoluteUrl(currentPath)}#itemlist` : undefined,
    }),
    slice.items.length > 0 &&
      itemListSchema(
        currentPath,
        slice.items.map((project) => ({
          name: project.title,
          path: localePath(locale, `/projects/${project.slug}`),
        })),
      ),
    breadcrumbSchema(currentPath, [
      { name: nav('home'), path: localePath(locale, '/') },
      { name: nav('projects'), path: listPath },
    ]),
    websiteSchema({ description: seo('defaultDescription') }),
    personSchema(person),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />
      <main id="main-content" className="section-padding">
        <div className="container-main">
          <Breadcrumbs
            label={t('breadcrumbLabel')}
            items={[{ name: nav('home'), href: '/' }, { name: nav('projects') }]}
          />

          <header className="mx-auto mt-8 mb-12 max-w-3xl text-center">
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{t('index.title')}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{t('index.intro')}</p>
          </header>

          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {slice.items.map((project, index) => (
              <li key={project.id}>
                <ProjectCard project={project} labels={labelsFor(project)} from="projects" priority={slice.page === 1 && index < 2} />
              </li>
            ))}
          </ul>

          <Pagination
            basePath="/projects"
            page={slice.page}
            totalPages={slice.totalPages}
            label={projectsT('paginationLabel')}
            className="mt-12"
          />

          <p className="mt-12 text-center text-muted-foreground">
            {t('index.selection')}{' '}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('index.githubCta')}
              <ArrowUpRight size={16} aria-hidden className="rtl:-scale-x-100" />
            </a>
          </p>
        </div>
      </main>
      <Footer links={cms.socialLinks} />
    </div>
  )
}
