import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import JsonLd from '@/components/seo/JsonLd'
import CertificationsSection from '@/components/sections/CertificationsSection'
import ContactSection from '@/components/sections/ContactSection'
import EducationSection from '@/components/sections/EducationSection'
import ExperienceSection from '@/components/sections/ExperienceSection'
import FaqSection from '@/components/sections/FaqSection'
import GithubStatsSection from '@/components/sections/GithubStatsSection'
import HeroSection from '@/components/sections/HeroSection'
import ProfileSummarySection from '@/components/sections/ProfileSummarySection'
import PortraitTransition from '@/components/sections/PortraitTransition'
import ProjectsSection from '@/components/sections/ProjectsSection'
import ReviewsSection from '@/components/sections/ReviewsSection'
import SkillsSection from '@/components/sections/SkillsSection'
import ShowcaseGroup, { ShowcasePair } from '@/components/sections/showcase/ShowcaseGroup'
import ScrollProgress from '@/components/ui/ScrollProgress'
import { fallbackFaq } from '@/features/cms/faq'
import { getPublishedFaq } from '@/features/cms/faq.queries'
import { getFallbackLanguages } from '@/features/cms/languages'
import { getPublishedCmsContent } from '@/features/cms/queries'
import { getPublishedProjects } from '@/features/content/projects.queries'
import { toProjectCard } from '@/features/content/projects.map'
import { getGithubSummary } from '@/features/github/queries'
import { getApprovedReviews } from '@/features/reviews/queries'
import {
  faqSchema,
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

// Render per request so the public portfolio reflects CMS changes immediately.
export const dynamic = 'force-dynamic'

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

  const [cms, projectRows, faqRows, reviews, faqT, meta, seo, hero, about, experience, education, profile] = await Promise.all([
    getPublishedCmsContent(locale),
    getPublishedProjects(),
    getPublishedFaq(locale),
    getApprovedReviews(),
    getTranslations({ locale, namespace: 'faq' }),
    getTranslations({ locale, namespace: 'home.meta' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'hero' }),
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'experience' }),
    getTranslations({ locale, namespace: 'education' }),
    getTranslations({ locale, namespace: 'home.profile' }),
  ])
  const projects = projectRows.map((project) => toProjectCard(project, locale))
  // CMS-managed questions when published; otherwise the defaults in messages.
  const faqItems = faqRows.length > 0 ? faqRows : fallbackFaq((key) => faqT(key))

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
    // Same Q&As as the visible FAQ section (expandable answers are allowed).
    faqItems.length > 0 && faqSchema(localePath(locale, '/'), faqItems),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <ScrollProgress />
      <Header brandName={cms.about?.fullName} design={cms.design} />

      <main id="main-content">
        <HeroSection about={cmsAbout} socialLinks={cms.socialLinks} avatarUrl="/images/keltoum-portrait.jpg" />
        <ProfileSummarySection locale={locale} facts={facts} avatarUrl="/images/keltoum-portrait.jpg" />
        <PortraitTransition />
        <SkillsSection categories={cms.skillCategories} />
        <ExperienceSection items={cms.experiences} />
        {/* Numbered bento block (04–09): side-label sections, two-up from lg. */}
        <ShowcaseGroup>
          <EducationSection index="04" items={cms.education} />
          <ProjectsSection index="05" projects={projects} />
          <ShowcasePair>
            <CertificationsSection index="06" items={cms.certifications} />
            {/* Streams in: a slow GitHub API never holds up the rest of the page. */}
            <Suspense fallback={<GithubStatsSection index="07" summary={null} pending />}>
              <GithubStats index="07" />
            </Suspense>
          </ShowcasePair>
          <ShowcasePair>
            <ReviewsSection index="08" reviews={reviews} />
            <FaqSection index="09" items={faqItems} />
          </ShowcasePair>
        </ShowcaseGroup>
        <ContactSection socialLinks={cms.socialLinks} />
      </main>

      <Footer links={cms.socialLinks} />
    </div>
  )
}

async function GithubStats({ index }: { index: string }) {
  return <GithubStatsSection index={index} summary={await getGithubSummary()} />
}
