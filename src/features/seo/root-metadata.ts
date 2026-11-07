import type { Metadata, Viewport } from "next";
import { PERSON, SITE_NAME, SITE_URL, TITLE_TEMPLATE, isIndexable } from "./site";

// Site-wide metadata defaults. `app/[locale]/layout.tsx` only localizes the
// default description; every public page sets its own title, canonical,
// hreflang and Open Graph via `buildPageMetadata`. Admin routes add `noindex`.
const verification: Metadata["verification"] = {
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
  ...(process.env.BING_SITE_VERIFICATION
    ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
    : {}),
};

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${PERSON.name} — ${PERSON.jobTitle}`,
    template: TITLE_TEMPLATE,
  },
  description:
    "Keltoum Malouki, Full Stack Web Developer in Casablanca, Morocco, builds web applications with React, Next.js, NestJS, Laravel and Ruby on Rails.",
  applicationName: SITE_NAME,
  authors: [{ name: PERSON.name, url: SITE_URL }],
  creator: PERSON.name,
  publisher: PERSON.name,
  keywords: [
    "Keltoum Malouki",
    ...PERSON.alternateName,
    "Full Stack Web Developer",
    "Développeuse Web Full Stack",
    "مطورة ويب متكاملة",
    "Web Developer Casablanca",
    "Casablanca",
    "Morocco",
    "Maroc",
    "React",
    "Next.js",
    "TypeScript",
    "Node.js",
    "NestJS",
    "Laravel",
    "Ruby on Rails",
    "Angular",
    "PostgreSQL",
    "Docker",
  ],
  formatDetection: { telephone: false, email: false, address: false },
  robots: isIndexable()
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : { index: false, follow: false },
  ...(Object.keys(verification).length > 0 ? { verification } : {}),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
  },
  category: "technology",
};

// Browser UI tint (mobile address bar, PWA title bar) matches the canvas.
export const rootViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
  ],
  colorScheme: "dark light",
};
