import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import JsonLd from '@/components/seo/JsonLd'
import styles from '@/components/about/about-layout.module.css'
import AboutBreadcrumb from '@/components/about/AboutBreadcrumb'
import AboutCertifications, { type AboutCertificationItem } from '@/components/about/AboutCertifications'
import AboutContactCta from '@/components/about/AboutContactCta'
import AboutFacts from '@/components/about/AboutFacts'
import AboutFaq from '@/components/about/AboutFaq'
import AboutGithub from '@/components/about/AboutGithub'
import AboutIntro from '@/components/about/AboutIntro'
import AboutRail from '@/components/about/AboutRail'
import AboutServices, { type AboutServiceKey } from '@/components/about/AboutServices'
import {
  AboutLanguages,
  AboutSkills,
  AboutSoftSkills,
  type AboutSkillCategory,
  type AboutSkillItem,
} from '@/components/about/AboutSkills'
import { AboutEducation, AboutExperience } from '@/components/about/AboutTimeline'
import { buildAboutChapters, type AboutChapterId } from '@/components/about/chapters'
import { getFallbackLanguages } from '@/features/cms/languages'
import { getPublishedCmsContent } from '@/features/cms/queries'
import { getGithubSummary } from '@/features/github/queries'
import {
  FALLBACK_DOCKER_CREDENTIAL_URL,
  FALLBACK_SKILL_CATEGORIES,
  aboutPersonInput,
  buildAboutFacts,
  buildAboutFaq,
  composeAboutIntro,
  resolveAboutProfile,
  splitNameAndPlace,
  splitTechnologies,
  type AboutEducationItem,
  type AboutExperienceItem,
  type AboutTranslate,
} from '@/features/seo/about-faq'
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdGraph,
  personInputFromCms,
  personSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata, truncateDescription } from '@/features/seo/metadata'
import { withUsableHeadline } from '@/features/seo/profile-summary'
import { PERSON, localePath } from '@/features/seo/site'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

// Cached and shared between visitors (ISR). Admin edits purge it at once
// (revalidatePublicSite); the hourly revalidation is only a safety net.
export const revalidate = 3600

// The canonical profile page for the entity "Keltoum Malouki": fully
// server-rendered, every fact visible, one JSON-LD graph (ProfilePage + Person
// + BreadcrumbList + FAQPage) built from the same data as the visible copy.

type PageProps = { params: Promise<{ locale: string }> }

const EXPERIENCE_FALLBACK_IDS = ['dabadoc', 'caisseManager'] as const
const EDUCATION_FALLBACK_IDS = ['youcode', 'bac'] as const
const SOFT_SKILL_FALLBACKS = [
  { key: 'timeManagement', icon: 'time_management' },
  { key: 'adaptability', icon: 'adaptability' },
  { key: 'teamwork', icon: 'teamwork' },
] as const
const SERVICE_KEYS: AboutServiceKey[] = ['fullStack', 'backend', 'frontend']

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}

  const [meta, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'aboutPage.meta' }),
    getTranslations({ locale, namespace: 'seo' }),
  ])
  return buildPageMetadata({
    locale,
    path: '/about',
    type: 'profile',
    // The title already names the person; skip the "| Keltoum Malouki" template.
    title: meta('title'),
    absoluteTitle: true,
    description: truncateDescription(meta('description')),
    // Explicit (same as the other public pages): a page-level `openGraph`
    // replaces the inherited file-based image.
    images: [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  const [cms, messages, t, seo] = await Promise.all([
    getPublishedCmsContent(locale),
    getTranslations({ locale }),
    getTranslations({ locale, namespace: 'aboutPage' }),
    getTranslations({ locale, namespace: 'seo' }),
  ])
  const tAbout: AboutTranslate = (key, values) => t(key, values)

  // A placeholder CMS headline ("Get to know me") must never become the role.
  const cmsAbout = withUsableHeadline(cms.about)
  const cmsContent = { ...cms, about: cmsAbout }

  // Message fallbacks, used only when the matching CMS collection is empty.
  const experienceFallbacks: AboutExperienceItem[] = EXPERIENCE_FALLBACK_IDS.map((id, index) => {
    const { name, place } = splitNameAndPlace(messages(`experience.items.${id}.company`))
    return {
      id,
      role: messages(`experience.items.${id}.title`),
      company: name,
      place,
      date: messages(`experience.items.${id}.date`),
      description: messages(`experience.items.${id}.description`),
      technologies: splitTechnologies(messages(`experience.items.${id}.stack`)),
      isCurrent: index === 0,
    }
  })
  const educationFallbacks: AboutEducationItem[] = EDUCATION_FALLBACK_IDS.map((id) => {
    const { name, place } = splitNameAndPlace(messages(`education.items.${id}.school`))
    return {
      id,
      degree: messages(`education.items.${id}.title`),
      institution: name,
      place,
      date: messages(`education.items.${id}.date`),
      description: messages(`education.items.${id}.description`),
    }
  })

  const profile = resolveAboutProfile(
    cmsContent,
    {
      name: messages('hero.name'),
      role: messages('hero.role'),
      experiences: experienceFallbacks,
      education: educationFallbacks,
      skills: FALLBACK_SKILL_CATEGORIES.flatMap((category) => category.skills),
      languages: getFallbackLanguages(locale),
    },
    { presentLabel: t('present') },
  )

  const definition = composeAboutIntro(profile, tAbout, locale)
  const facts = buildAboutFacts(profile, tAbout, locale)
  const faq = buildAboutFaq(profile, tAbout, locale)

  const photoUrl = cmsAbout?.avatarUrl || PERSON.image
  const skillCategories: AboutSkillCategory[] = cms.skillCategories.length
    ? cms.skillCategories.map((category) => ({
        id: category.id,
        name: category.name,
        skills: category.skills.map((skill) => ({ name: skill.name, icon: skill.icon, imageUrl: skill.imageUrl })),
      }))
    : FALLBACK_SKILL_CATEGORIES.map((category) => ({
        id: category.key,
        name: messages(`skills.categories.${category.key}`),
        skills: category.skills.map((name) => ({ name })),
      }))
  const softSkills: AboutSkillItem[] = cms.softSkills.length
    ? cms.softSkills.map((skill) => ({ name: skill.name, icon: skill.icon, imageUrl: skill.imageUrl }))
    : SOFT_SKILL_FALLBACKS.map((skill) => ({ name: messages(`softSkills.items.${skill.key}`), icon: skill.icon }))
  const certifications: AboutCertificationItem[] = cms.certifications.length
    ? cms.certifications.map((item) => ({
        id: item.id,
        name: item.name,
        issuer: item.issuer,
        date: item.issueDate,
        description: item.description,
        credentialUrl: item.credentialUrl,
      }))
    : [
        {
          id: 'docker',
          name: messages('certifications.items.docker.title'),
          issuer: messages('certifications.items.docker.issuer'),
          date: messages('certifications.items.docker.date'),
          description: messages('certifications.items.docker.description'),
          credentialUrl: FALLBACK_DOCKER_CREDENTIAL_URL,
        },
      ]

  const pagePath = localePath(locale, '/about')
  const pageTitle = t('meta.title')
  const pageDescription = truncateDescription(t('meta.description'))
  const person = aboutPersonInput(
    {
      ...personInputFromCms(cmsContent, { jobTitle: messages('hero.role') }),
      // The third-person definitional intro describes the entity better than a
      // first-person bio, and it is the visible text of this page.
      description: definition,
    },
    profile,
    {
      credentials: certifications.map((item) => ({
        name: item.name,
        issuer: item.issuer || undefined,
        url: item.credentialUrl || undefined,
        date: item.date || undefined,
      })),
    },
  )
  const jsonLd = jsonLdGraph(
    webPageSchema({
      type: 'ProfilePage',
      path: pagePath,
      name: pageTitle,
      description: pageDescription,
      locale,
      hasBreadcrumb: true,
      primaryImage: photoUrl,
    }),
    personSchema(person),
    breadcrumbSchema(pagePath, [
      { name: messages('nav.home'), path: localePath(locale, '/') },
      { name: messages('nav.about'), path: pagePath },
    ]),
    faqSchema(
      pagePath,
      faq.map(({ question, answer }) => ({ question, answer })),
    ),
    websiteSchema({ description: seo('defaultDescription') }),
  )

  // The chapter list: the intro, then each section that renders, with the same
  // conditions the sections use to render nothing (an empty CMS collection).
  const chapters = buildAboutChapters([
    { id: 'profile', label: t('eyebrow') },
    { id: 'at-a-glance', label: t('glance.title') },
    { id: 'what-i-do', label: t('services.title') },
    profile.experiences.length > 0 && { id: 'experience', label: t('experience.title') },
    profile.education.length > 0 && { id: 'education', label: t('education.title') },
    skillCategories.length > 0 && { id: 'skills', label: t('skills.title') },
    certifications.length > 0 && { id: 'certifications', label: t('certifications.title') },
    { id: 'github', label: messages('github.heading') },
    profile.languages.length > 0 && { id: 'languages', label: t('languages.title') },
    softSkills.length > 0 && { id: 'how-i-work', label: t('softSkills.title') },
    faq.length > 0 && { id: 'faq', label: t('faq.title') },
    { id: 'contact', label: t('contact.title') },
  ])
  const numberOf = (id: AboutChapterId) => chapters.find((chapter) => chapter.id === id)?.number
  const cvUrl = cmsAbout?.cvUrl || '/cv.pdf'

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />

      {/* overflow-x: clip, not hidden: `hidden` would make <main> a scroll container and stop the rail sticking. */}
      <main id="main-content" className="relative overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] grid-pattern opacity-30"
        />
        <div className="relative container-main max-w-6xl pb-24 pt-24 md:pt-32 lg:pb-32">
          <AboutBreadcrumb
            label={seo('breadcrumbLabel')}
            homeLabel={messages('nav.home')}
            currentLabel={messages('nav.about')}
          />

          <div className={cn(styles.layout, 'mt-8 md:mt-10')}>
            <AboutIntro
              className={styles.intro}
              eyebrow={t('eyebrow')}
              title={t('title', { name: profile.name })}
              definition={definition}
              bio={cmsAbout?.bio || messages('about.description')}
              photoUrl={photoUrl}
              photoAlt={profile.fullName}
              location={cmsAbout?.location || messages('hero.location')}
              availability={profile.availability}
              availabilityLabel={messages(`hero.availability.${profile.availability}`)}
              cvUrl={cvUrl}
              email={profile.email}
              labels={{
                actions: t('intro.cta.label'),
                downloadCv: t('intro.cta.downloadCv'),
                workWithMe: t('intro.cta.workWithMe'),
                email: t('intro.cta.email'),
              }}
            />

            <AboutRail
              className={styles.rail}
              chapters={chapters}
              label={t('toc.label')}
              cvUrl={cvUrl}
              labels={{ downloadCv: t('intro.cta.downloadCv'), workWithMe: t('intro.cta.workWithMe') }}
            />

            <div className={styles.body}>
              <AboutFacts title={t('glance.title')} number={numberOf('at-a-glance')} facts={facts} />

              <AboutServices
                title={t('services.title')}
                number={numberOf('what-i-do')}
                lead={t('services.lead')}
                items={SERVICE_KEYS.map((key) => ({
                  key,
                  title: t(`services.items.${key}.title`),
                  description: t(`services.items.${key}.description`),
                }))}
              />

              <AboutExperience
                title={t('experience.title')}
                number={numberOf('experience')}
                currentLabel={t('experience.current')}
                technologiesLabel={t('experience.technologies')}
                items={profile.experiences}
              />

              <AboutEducation title={t('education.title')} number={numberOf('education')} items={profile.education} />

              <AboutSkills
                title={t('skills.title')}
                number={numberOf('skills')}
                lead={t('skills.lead')}
                categories={skillCategories}
              />

              <AboutCertifications
                title={t('certifications.title')}
                number={numberOf('certifications')}
                viewLabel={t('certifications.viewCredential')}
                items={certifications}
              />

              {/* Streams in: a slow GitHub API never holds up the profile. */}
              <Suspense fallback={<AboutGithub locale={locale} number={numberOf('github')} summary={null} pending />}>
                <GithubActivity locale={locale} number={numberOf('github')} />
              </Suspense>

              <AboutLanguages title={t('languages.title')} number={numberOf('languages')} languages={profile.languages} />

              <AboutSoftSkills
                title={t('softSkills.title')}
                number={numberOf('how-i-work')}
                lead={t('softSkills.lead')}
                skills={softSkills}
              />

              <AboutFaq
                title={t('faq.title')}
                number={numberOf('faq')}
                lead={t('faq.lead', { name: profile.name })}
                items={faq}
              />

              <AboutContactCta
                title={t('contact.title')}
                number={numberOf('contact')}
                text={t('contact.text', { email: profile.email })}
                email={profile.email}
                linkedinUrl={profile.linkedinUrl}
                githubUrl={profile.githubUrl}
                labels={{
                  email: t('contact.email'),
                  freelance: t('contact.freelance'),
                  linkedin: t('contact.linkedin'),
                  github: t('contact.github'),
                }}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer links={cms.socialLinks} />
    </div>
  )
}

async function GithubActivity({ locale, number }: { locale: string; number?: string }) {
  return <AboutGithub locale={locale} number={number} summary={await getGithubSummary()} />
}
