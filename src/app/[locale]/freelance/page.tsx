import type { Metadata } from 'next'
import { CalendarClock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'
import { pillOutline } from '@/components/sections/showcase/classes'
import JsonLd from '@/components/seo/JsonLd'
import { fallbackFaq } from '@/features/cms/faq'
import { getPublishedFaq } from '@/features/cms/faq.queries'
import { getPublishedCmsContent } from '@/features/cms/queries'
import { SERVICE_CURRENCY, formatStartingPrice } from '@/features/cms/services'
import { getPublishedServices } from '@/features/cms/services.queries'
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
import { normalizeAvailability } from '@/features/seo/profile-summary'
import { SCHEMA_IDS, localePath } from '@/features/seo/site'
import { trackClick } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/validation/locale'
import BriefStudio from './BriefStudio'
import FreelanceFaq from './FreelanceFaq'
import FreelancePackages from './FreelancePackages'
import FreelanceProcess from './FreelanceProcess'

// Cached and shared between visitors (ISR). Admin edits purge it at once
// (revalidatePublicSite); the hourly revalidation is only a safety net.
export const revalidate = 3600

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

  const availability = normalizeAvailability(cms.about?.availabilityStatus)
  const emailLink = cms.socialLinks.find((link) => link.url.toLowerCase().startsWith('mailto:'))

  return (
    <div className="min-h-screen relative">
      <JsonLd data={jsonLd} />
      <Header brandName={cms.about?.fullName} design={cms.design} />
      <main id="main-content">
        <BriefStudio
          bookingUrl={bookingUrl}
          intro={
            <header>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-sm text-muted-foreground backdrop-blur">
                <span aria-hidden="true" className="relative flex size-2">
                  {availability === 'available' && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex size-2 rounded-full',
                      availability === 'available' && 'bg-green-500',
                      availability === 'limited' && 'bg-amber-500',
                      availability === 'unavailable' && 'bg-muted-foreground',
                    )}
                  />
                </span>
                {t(`availability.${availability}`)}
              </p>
              <h1
                id="freelance-title"
                className="mt-5 text-5xl font-bold leading-[1.02] tracking-tight text-foreground text-balance sm:text-6xl xl:text-7xl"
              >
                {t('title')}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
                {t('lead')}
              </p>
              {/* A call takes less effort than a written request, so it stays one click away. */}
              {bookingUrl && (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${pillOutline} mt-5`}
                  {...trackClick('booking-click', { from: 'freelance' })}
                >
                  <CalendarClock aria-hidden="true" className="size-4" />
                  {t('cta.book')}
                  <span className="sr-only">{t('cta.newTab')}</span>
                </a>
              )}
            </header>
          }
          alternatives={
            emailLink && (
              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted-foreground">
                {t('alternatives.email')}
                <a
                  href={emailLink.url}
                  dir="ltr"
                  className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary-text underline-offset-4 hover:underline"
                  {...trackClick('contact-link', { channel: 'email', from: 'freelance' })}
                >
                  {emailLink.url.replace(/^mailto:/i, '').split('?')[0]}
                </a>
              </p>
            )
          }
        />

        <FreelanceProcess
          title={t('process.title')}
          lead={t('process.lead')}
          cta={t('cta.request')}
          steps={PROCESS_STEPS.map((id) => ({
            id,
            title: t(`process.steps.${id}.title`),
            text: t(`process.steps.${id}.text`),
          }))}
        />

        <FreelancePackages
          title={t('packages.title')}
          lead={t('packages.lead')}
          leadQuote={t('packages.leadQuote')}
          fromLabel={t('packages.from')}
          quoteLabel={t('packages.quote')}
          includesLabel={t('packages.includes')}
          ctaLabel={t('packages.cta')}
          items={packages}
        />

        <FreelanceFaq
          title={faqT('title')}
          lead={faqT('subtitle')}
          more={faqT('more')}
          moreCta={faqT('moreCta')}
          cta={t('cta.request')}
          items={faqItems}
        />
      </main>
      <Footer links={cms.socialLinks} />
    </div>
  )
}
