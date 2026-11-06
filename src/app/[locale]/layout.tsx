import type { Metadata } from 'next'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getPublishedDesignSettings } from '@/features/cms/queries'
import { readVisitorDesignPreference } from '@/features/preferences/cookie'
import Analytics from '@/components/analytics/Analytics'
import { PreferenceProvider } from '@/components/providers/PreferenceProvider'
import SmoothScroll from '@/components/providers/SmoothScroll'

// Note: no `generateStaticParams` — public pages read Supabase per request, so
// the locale subtree is rendered on demand (always reflects published content).

// Locale-generic metadata ONLY: the localized default description. Nothing
// page-specific here (no title, canonical or Open Graph) — child pages would
// otherwise inherit the home page's canonical. Every page sets its own via
// `buildPageMetadata`; the title default/template come from the root layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}

  const t = await getTranslations({ locale, namespace: 'seo' })
  return { description: t('defaultDescription') }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  // Enable static rendering for this locale segment.
  setRequestLocale(locale)

  const [messages, design, visitorPreference] = await Promise.all([
    getMessages(),
    getPublishedDesignSettings(),
    readVisitorDesignPreference(),
  ])
  return (
    <NextIntlClientProvider messages={messages}>
      <PreferenceProvider adminDesign={design} initialPreference={visitorPreference}>
        {/* Public site only: /admin keeps native scrolling and is never tracked. */}
        <SmoothScroll />
        <Analytics />
        {children}
      </PreferenceProvider>
    </NextIntlClientProvider>
  )
}
