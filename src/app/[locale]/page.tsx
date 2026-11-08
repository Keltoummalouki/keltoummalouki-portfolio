import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import JsonLd from '@/components/seo/JsonLd'
import ContactSection from '@/components/sections/ContactSection'
import ExperienceSection from '@/components/sections/ExperienceSection'
import HeroSection from '@/components/sections/HeroSection'
import ProfileSummarySection from '@/components/sections/ProfileSummarySection'
import ProjectsSection from '@/components/sections/ProjectsSection'
import ReviewsSection from '@/components/sections/ReviewsSection'
import ShowcaseGroup from '@/components/sections/showcase/ShowcaseGroup'
import ScrollProgress from '@/components/ui/ScrollProgress'
import { getFallbackLanguages } from '@/features/cms/languages'
import { getPublishedCmsContent } from '@/features/cms/queries'
import { getFramableDemos, getPublishedProjects } from '@/features/content/projects.queries'
import { toProjectCard, type ProjectCardData } from '@/features/content/projects.map'
import { getApprovedReviews } from '@/features/reviews/queries'
import {
  jsonLdGraph,
  organizationSchema,
  personInputFromCms,
  personSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata } from '@/features/seo/metadata'
import { enrichPersonInput, resolveProfileFacts, withUsableHeadline } from '@/features/seo/profile-summary'
import { PERSON, SCHEMA_IDS, localePath } from '@/features/seo/site'
import { routing } from '@/i18n/routing'

// Cached and shared between visitors (ISR). Admin edits purge it at once
// (revalidatePublicSite); the hourly revalidation is only a safety net.
export const revalidate = 3600

// The home page stays short: a recruiter skims it in about 30 seconds. Skills,
// education, certifications and GitHub activity live on /about; the FAQ on
// /freelance, next to the project request form.

/** Projects shown here, in published order (featured first); /projects lists them all. */
const HOME_PROJECT_COUNT = 3

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}

  const [meta, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'home.meta' }),
    getTranslations({ locale, namespace: 'seo' }),
  ])
  return buildPageMetadata({
    locale,
    path: '/',
    title: meta('title'),
    absoluteTitle: true,
    description: meta('description'),
    type: 'website',
    // Explicit (same as the other public pages): a page-level `openGraph`
    // replaces the inherited file-based image.
    images: [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  const [cms, projectRows, reviews, meta, seo, hero, about, experience, education, profile] = await Promise.all([
    getPublishedCmsContent(locale),
    getPublishedProjects(),
    getApprovedReviews(),
    getTranslations({ locale, namespace: 'home.meta' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'hero' }),
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'experience' }),
    getTranslations({ locale, namespace: 'education' }),
    getTranslations({ locale, namespace: 'home.profile' }),
  ])
  const projects = projectRows.map((project) => toProjectCard(project, locale))
  const featuredProjects = projects.slice(0, HOME_PROJECT_COUNT)

  // A placeholder CMS headline (the seed stored "Get to know me") must never
  // surface as the job title in the hero, the About card or the JSON-LD.
  const cmsAbout = withUsableHeadline(cms.about)

  const facts = resolveProfileFacts(
    { ...cms, about: cmsAbout },
    {
      name: hero('name'),
      role: hero('role'),
      current: { role: experience('items.dabadoc.title'), company: profile('fallback.currentCompany') },
      education: { school: profile('fallback.school'), degree: education('items.youcode.title') },
      languages: getFallbackLanguages(locale),
    },
  )

  const person = enrichPersonInput(
    personInputFromCms({ ...cms, about: cmsAbout }, { jobTitle: hero('role'), description: about('description') }),
    facts,
  )
  const jsonLd = jsonLdGraph(
    webPageSchema({
      type: 'WebPage',
      path: localePath(locale, '/'),
      name: meta('title'),
      description: meta('description'),
      locale,
      mainEntityId: SCHEMA_IDS.person,
      primaryImage: cms.about?.avatarUrl || PERSON.image,
    }),
    websiteSchema({ description: seo('defaultDescription') }),
    organizationSchema({ description: seo('organizationDescription'), sameAs: person.sameAs }),
    personSchema(person),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <ScrollProgress />
      <Header brandName={cms.about?.fullName} design={cms.design} />

      <main id="main-content">
        {/* Ice Bear (hero) blows away as snow on scroll and the snow forms the
            portrait below (data-portrait-destination): see components/three/ice-bear. */}
        <HeroSection about={cmsAbout} socialLinks={cms.socialLinks} />
        <ProfileSummarySection locale={locale} facts={facts} bio={cmsAbout?.bio} avatarUrl="/images/keltoum-portrait.jpg" />
        <ExperienceSection items={cms.experiences} />
        {/* Numbered block (03–04), continuing after the profile (01) and experience (02). */}
        <ShowcaseGroup>
          {/* Streams in: checking which demos can be framed live never holds up the page. */}
          <Suspense fallback={<ProjectsSection index="03" projects={featuredProjects} total={projects.length} />}>
            <ProjectsWithLivePreviews index="03" projects={featuredProjects} total={projects.length} />
          </Suspense>
          <ReviewsSection index="04" reviews={reviews} />
        </ShowcaseGroup>
        <ContactSection socialLinks={cms.socialLinks} />
      </main>

      <Footer links={cms.socialLinks} />
    </div>
  )
}

async function ProjectsWithLivePreviews({
  index,
  projects,
  total,
}: {
  index: string
  projects: ProjectCardData[]
  total: number
}) {
  const livePreviews = await getFramableDemos(projects.map((project) => project.demo))
  return <ProjectsSection index={index} projects={projects} total={total} livePreviews={livePreviews} />
}
