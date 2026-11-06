import type { Metadata, Viewport } from 'next'
import RootDocument from '@/components/layouts/RootDocument'
import { SITE_NAME } from '@/features/seo/site'
import { rootMetadata, rootViewport } from '@/features/seo/root-metadata'

// Root layout of every /admin route (login + protected): the public site has
// its own under app/[locale]. The dashboard is French-default, never indexed,
// and rendered per request (its pages check the admin session).
export const metadata: Metadata = {
  ...rootMetadata,
  title: { default: 'Admin', template: `%s | ${SITE_NAME}` },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = rootViewport

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument lang="fr" dir="ltr">
      {children}
    </RootDocument>
  )
}
