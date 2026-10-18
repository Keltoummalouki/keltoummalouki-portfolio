import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// The production domain is proxied through Cloudflare, which injects its Web
// Analytics beacon (static.cloudflareinsights.com) into HTML responses; the
// beacon reports to cloudflareinsights.com.
// frame-src: the home page shows each project's demo (an admin-managed URL,
// checked server-side before it is framed) live in an iframe, so any https
// origin may be framed; this also covers the Turnstile widget.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://cloudflareinsights.com;
  frame-src https:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
    // Don't advertise the framework in every response (flagged by SEO audits).
    poweredByHeader: false,
    images: {
        remotePatterns: [
            {
                // Supabase Storage public objects (e.g. project cover images).
                protocol: 'https',
                hostname: '*.supabase.co',
            },
        ],
    },
    transpilePackages: ['three'],
    experimental: {
        serverActions: {
            // Admin forms post files through Server Actions (default cap: 1 MB).
            // The largest is the profile form: avatar (5 MB) + two CV PDFs (10 MB
            // each), per the limits enforced in src/features/cms/media.ts.
            bodySizeLimit: '26mb',
        },
    },
    // The OG image route reads the profile photo from disk at runtime; make sure
    // output file tracing bundles it into that serverless function.
    outputFileTracingIncludes: {
        '/[locale]/opengraph-image': ['./public/images/keltoum.png'],
    },
    // Pin the workspace root so Turbopack doesn't infer it from a stray parent lockfile.
    turbopack: {
        root: __dirname,
    },
    // The layout is dynamic (cookie-based locale), so Next streams metadata into <body>
    // for non-bot UAs. Disable streaming metadata so <title>/<meta description>/OG always
    // render in <head> — required for Lighthouse SEO and non-JS social scrapers.
    htmlLimitedBots: /.*/,
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: cspHeader,
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};

export default withNextIntl(nextConfig);
