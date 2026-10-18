import type { MetadataRoute } from 'next'
import { PERSON, SITE_NAME } from '@/features/seo/site'

// /manifest.webmanifest — install metadata and the portrait icons (generated
// from the same studio headshot as favicon.ico / icon.png / apple-icon.png).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${PERSON.jobTitle}`,
    short_name: SITE_NAME,
    description:
      'Keltoum Malouki, Full Stack Web Developer in Casablanca, Morocco: portfolio, case studies, blog and contact.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
