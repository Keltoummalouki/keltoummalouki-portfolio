import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getPublishedDesignSettings } from '@/features/cms/queries'
import Analytics from '@/components/analytics/Analytics'
import HtmlLocale from '@/components/providers/HtmlLocale'
import { PreferenceProvider } from '@/components/providers/PreferenceProvider'
import SmoothScroll from '@/components/providers/SmoothScroll'
import RootDocument from '@/components/layouts/RootDocument'
import { rootMetadata, rootViewport } from '@/features/seo/root-metadata'

// Root layout of the public site (there is no app/layout.tsx; /admin has its
// own). It knows the locale from the URL, so <html lang/dir> render without
// reading the request and the pages below can be cached. The three locales are
// pre-rendered at build; admin edits purge them (revalidatePublicSite).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = rootViewport

// Locale-generic metadata ONLY: the localized default description. Nothing
// page-specific here (no title, canonical or Open Graph) — child pages would
// otherwise inherit the home page's canonical. Every page sets its own via
// `buildPageMetadata`; the title default/template come from rootMetadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return rootMetadata

  const t = await getTranslations({ locale, namespace: 'seo' })
  return { ...rootMetadata, description: t('defaultDescription') }
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

  // Nothing here reads the request (no cookies, no headers), so the pages below
  // can be cached; the visitor's design preference is applied in the browser.
  const [messages, design] = await Promise.all([getMessages(), getPublishedDesignSettings()])
  return (
    <RootDocument lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <NextIntlClientProvider messages={messages}>
        <PreferenceProvider adminDesign={design}>
          {/* Public site only: /admin keeps native scrolling and is never tracked. */}
          <HtmlLocale locale={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
          <SmoothScroll />
          <Analytics />
          {children}
        </PreferenceProvider>
      </NextIntlClientProvider>
    </RootDocument>
  )
}
