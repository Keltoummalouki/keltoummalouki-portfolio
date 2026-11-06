import type { Metadata } from 'next'
import { CalendarClock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import JsonLd from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { fallbackFaq } from '@/features/cms/faq'
import { getPublishedFaq } from '@/features/cms/faq.queries'
import { getPublishedCmsContent } from '@/features/cms/queries'
import { SERVICE_CURRENCY, formatStartingPrice } from '@/features/cms/services'
import { getPublishedServices } from '@/features/cms/services.queries'
import { PROJECT_TYPES } from '@/features/freelance/schema'
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdGraph,
  offerCatalogSchema,
  organizationSchema,
  personInputFromCms,
  personSchema,
  webPageSchema,
  websiteSchema,
} from '@/features/seo/jsonld'
import { buildPageMetadata } from '@/features/seo/metadata'
import { SCHEMA_IDS, localePath } from '@/features/seo/site'
import { trackClick } from '@/lib/analytics/events'
import type { Locale } from '@/lib/validation/locale'
import FreelanceFaq from './FreelanceFaq'
import FreelanceLeadForm from './FreelanceLeadForm'
import FreelancePackages from './FreelancePackages'
import FreelanceProcess from './FreelanceProcess'

/** "How I work" steps in order; their copy is in messages (`freelance.process.steps`). */
const PROCESS_STEPS = ['brief', 'scope', 'build', 'launch'] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = await getTranslations({ locale, namespace: 'seo' })
  return buildPageMetadata({
    locale,
    path: '/freelance',
    title: seo('freelanceTitle'),
    absoluteTitle: true,
    description: seo('freelanceDescription'),
    // Explicit: a page-level `openGraph` replaces the layout's file-based image.
    images: [{ url: localePath(locale, '/opengraph-image'), width: 1200, height: 630, alt: seo('ogImageAlt') }],
  })
}

export default async function FreelancePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = (await params).locale as Locale
  const [t, seo, nav, hero, faqT, cms, faqRows, services] = await Promise.all([
    getTranslations({ locale, namespace: 'freelance' }),
    getTranslations({ locale, namespace: 'seo' }),
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'hero' }),
    getTranslations({ locale, namespace: 'faq' }),
    getPublishedCmsContent(locale),
    getPublishedFaq(locale),
    getPublishedServices(locale),
  ])
  // CMS-managed questions when published; otherwise the defaults in messages.
  const faqItems = faqRows.length > 0 ? faqRows : fallbackFaq((key) => faqT(key))
  const bookingUrl = cms.about?.bookingUrl ?? ''
  const packages = services.map((service) => ({
    ...service,
    price: service.priceFrom === null ? null : formatStartingPrice(service.priceFrom, locale),
  }))

  const pagePath = localePath(locale, '/freelance')
  const person = personInputFromCms(cms, { jobTitle: hero('role'), description: seo('defaultDescription') })
  const jsonLd = jsonLdGraph(
    webPageSchema({
      path: pagePath,
      name: seo('freelanceTitle'),
      description: seo('freelanceDescription'),
      locale,
      mainEntityId: SCHEMA_IDS.organization,
      hasBreadcrumb: true,
    }),
    organizationSchema({ description: seo('organizationDescription'), sameAs: person.sameAs }),
    breadcrumbSchema(pagePath, [
      { name: nav('home'), path: localePath(locale, '/') },
      { name: nav('freelance'), path: pagePath },
    ]),
    websiteSchema({ description: seo('defaultDescription') }),
    personSchema(person),
    // Same packages and Q&As as the visible sections (expandable answers are allowed).
    services.length > 0 && offerCatalogSchema(pagePath, t('packages.title'), services, SERVICE_CURRENCY),
    faqItems.length > 0 && faqSchema(pagePath, faqItems),
  )

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />
      <main id="main-content" className="section-padding">
        <div className="container-main max-w-4xl">
          <header className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{t('title')}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t('subtitle')}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {/* A call takes less effort than a written brief, so it leads when a booking page is set. */}
              {bookingUrl && (
                <Button asChild size="lg">
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer" {...trackClick('booking-click', { from: 'freelance' })}>
                    <CalendarClock aria-hidden="true" />
                    {t('cta.book')}
                    <span className="sr-only">{t('cta.newTab')}</span>
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant={bookingUrl ? 'outline' : 'default'}>
                <a href="#request" {...trackClick('contact-cta', { from: 'freelance' })}>
                  {t('cta.request')}
                </a>
              </Button>
            </div>
          </header>

          <section className="mb-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">{t('helpTitle')}</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {PROJECT_TYPES.map((value) => (
                <li key={value} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  {t(`options.projectType.${value}`)}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">{t('intro')}</p>
          </section>

          <FreelanceProcess
            title={t('process.title')}
            lead={t('process.lead')}
            steps={PROCESS_STEPS.map((id) => ({
              id,
              title: t(`process.steps.${id}.title`),
              text: t(`process.steps.${id}.text`),
            }))}
          />

          <FreelancePackages
            title={t('packages.title')}
            lead={t('packages.lead')}
            fromLabel={t('packages.from')}
            quoteLabel={t('packages.quote')}
            includesLabel={t('packages.includes')}
            items={packages}
          />

          <section
            id="request"
            aria-labelledby="request-title"
            className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 sm:p-8"
          >
            <h2 id="request-title" className="mb-6 text-lg font-semibold text-foreground">
              {t('formTitle')}
            </h2>
            <FreelanceLeadForm />
          </section>

          <FreelanceFaq
            title={faqT('title')}
            lead={faqT('subtitle')}
            more={faqT('more')}
            moreCta={faqT('moreCta')}
            items={faqItems}
          />
        </div>
      </main>
      <Footer links={cms.socialLinks} />
    </div>
  )
}
