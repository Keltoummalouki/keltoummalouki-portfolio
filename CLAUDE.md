# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio for Keltoum Malouki, now a multilingual CMS: Next.js 15 (App Router, React 19, TypeScript strict), Tailwind v4 + shadcn/ui (new-york), and Supabase (Postgres, Auth, Storage) as the backend. The public site is in `fr` (default), `en`, and `ar` (RTL). A private `/admin` dashboard manages portfolio content, blog articles, the contact inbox, and freelance leads.

`README.md` is the public, GitHub-facing overview (screenshots in `docs/screenshots/`). Keep it in sync when features or the architecture change; for setup details, `.env.example` is authoritative.

## Commands

```bash
npm run dev              # Next dev server (Turbopack) on :3000
npm run build            # production build (also the type-check gate)
npm run lint             # next lint (next/core-web-vitals + next/typescript)
npm test                 # vitest run: pure-logic unit tests, no Supabase needed
npm run test:watch
npm run test:coverage
npx vitest run src/features/articles/schema.test.ts   # single test file
npx vitest run -t "pickTranslation"                   # tests matching a name
npm run test:e2e         # Playwright smoke tests: builds into .next-e2e, serves on :3100 with Supabase offline
                         # (E2E_BROWSER_CHANNEL=msedge uses an installed browser instead of Playwright's download)
```

Local Supabase (Docker must be running; see `supabase/README.md`):

```bash
npx supabase start       # API :54321, Postgres :54322, Studio :54323
npx supabase db reset    # re-apply every migration + seed.sql
npx supabase migration new <name>
npm run db:types         # regenerate src/lib/supabase/database.types.ts
```

`database.types.ts` is checked in. Regenerate it after every schema migration. Every schema change must be a new file in `supabase/migrations/`, because `db reset` has to rebuild the database from version-controlled files alone.

Env setup: copy `.env.example` to `.env.local`. Turnstile keys are optional in dev: with no site key the widget is not rendered, and with no secret the server check is skipped. Analytics (Umami) is optional too: with no `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, no script loads and the CSP does not allow Umami.

## Architecture

### Routing and i18n
- `src/middleware.ts` splits traffic. `/admin/*` gets only a Supabase session refresh and stays **unprefixed**. Every other route goes through next-intl locale routing (`localePrefix: 'always'`, config in `src/i18n/routing.ts`).
- Public pages live under `src/app/[locale]/` (home, `blog`, `blog/[slug]`, `freelance`). Use the helpers in `src/i18n/navigation.ts` for locale-aware links.
- UI labels live in `messages/{fr,en,ar}.json`. Keep all three in sync. Editable content lives in the database, not in these files.
- Locale lists appear in both `src/i18n/routing.ts` and `src/lib/validation/locale.ts` (`LOCALES`, `DEFAULT_LOCALE`, `localeSchema`). Keep them in sync.
- Translated DB content uses two patterns:
  - Normalized `*_translations` tables (projects, experiences, education, certifications, articles), resolved with `pickTranslation()`.
  - `{fr,en,ar}` JSONB columns (about_profile, site_settings, design_settings, skill_categories, …), resolved with `pickI18n()`.
  - Both fall back from the requested locale to `fr`, then to the first available value.

### Feature modules (`src/features/<domain>/`)
The data layer uses one folder per domain: `articles`, `auth`, `cms`, `content` (projects), `freelance`, `inbox`, `preferences`, `stats`, `submissions`. UI never builds raw Supabase queries. It calls typed functions from these modules. Typical file roles:
- `schema.ts`: Zod schemas plus form-state types (client-safe).
- `map.ts`: pure mapping from DB rows to UI shapes (client-safe, unit-tested).
- `queries.ts`: `import 'server-only'`, reads through the cookie-aware server client.
- `actions.ts`: `'use server'` Server Actions. The pattern is: `requireAdmin()` → Zod `safeParse` → Supabase write → `revalidatePath` → `redirect`, or return a `{ ok, message, errors }` form state.
- `index.ts`: re-exports **only client-safe** modules. Server code imports `queries`/`actions` directly from their files.

Pure logic (schemas, mappers, translation pickers) sits in separate files so it can be tested without Supabase. Tests are colocated as `*.test.ts` and run in the Vitest `node` environment. There are no DOM or component tests.

### Supabase clients and the security model (`src/lib/supabase/`)
- `client.ts`: browser anon client.
- `server.ts`: `server-only`, anon key plus request cookies, so queries run under the user's RLS context. Use it for admin reads and every write.
- `public.ts`: `server-only`, anon key and **no cookies**. Every public `getPublished*` reader uses it, so public pages can be cached. Never use it for admin reads or writes.
- `admin.ts`: `server-only`, service-role key, **bypasses RLS**. Use it only where needed. Current uses are the public contact and lead inserts and the submission rate limiter.
- RLS is the real authorization boundary. Admin status comes from the SQL function `public.is_admin()` over the `admin_profiles` table, never from auth metadata. `features/auth/session.ts` exposes `getAdminSession()` and `requireAdmin()`. `app/admin/(protected)/layout.tsx` guards every dashboard page on the server, and each admin Server Action also calls `requireAdmin()`.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SECRET`) must only be read from `server-only` modules and must never get a `NEXT_PUBLIC_` prefix.

### Public submissions
Contact messages (`features/inbox`) and freelance leads (`features/freelance`) share one flow:
1. Zod validation.
2. Turnstile check (`inbox/turnstile.ts`).
3. `reservePublicSubmission()` (`features/submissions/rate-limit.ts`): HMAC-hashes the IP, rate-limits, and can mark the submission as spam.
4. Insert with the admin client.

Error codes returned to the client are deliberately coarse (`invalid`, `captcha`, `rate_limited`, `server`).

### Public rendering and CMS data
- Public pages are cached (ISR, `revalidate = 3600`, locales pre-rendered). Nothing under `app/[locale]` may read cookies or headers, or the whole route becomes dynamic again. Every admin action that changes published content must call `revalidatePublicSite()` (`lib/revalidate-public.ts`), which purges all public pages at once. `/projects` stays per-request because of `?page=`.
- There is no `app/layout.tsx`. `app/[locale]/layout.tsx` and `app/admin/layout.tsx` are the two root layouts, sharing `components/layouts/RootDocument.tsx` (fonts, `<html lang dir>`) and `features/seo/root-metadata.ts`. A single root above `[locale]` could only get the locale from request headers.
- `app/[locale]/page.tsx` loads `getPublishedCmsContent(locale)` (`features/cms/queries.ts`) and `getPublishedProjects()`, then passes plain props into `components/sections/*`.
- Public queries catch their own errors and return empty or fallback data. `features/cms/fallbacks.ts` builds defaults from `messages/*.json`, so the site still renders when Supabase is unreachable or empty.
- Public queries filter on `status = 'published'` explicitly, on top of RLS, so an admin viewing the site never sees drafts.
- Admin-editable theme settings (`design_settings`) become runtime CSS variables through `features/cms/design-css.ts` and `components/ui/DesignSettingsStyle.tsx`. Visitor-level display preferences live in a cookie (`features/preferences`) that is read in the browser by `PreferenceProvider`, never on the server (that would make pages uncacheable).
- Blog bodies are Markdown, rendered through `components/ui/Markdown.tsx` with `rehype-sanitize`.
- Uploads go to Supabase Storage via `features/cms/media.ts`.

### Analytics
Umami (cookie-less) loads only on public pages (`components/analytics/Analytics.tsx` in the `[locale]` layout) and only reports from the production hostname. To record a click, spread `trackClick(event, data)` from `lib/analytics/events.ts` on the link or button; it works in Server Components. Record conversions with `trackEvent()` after a successful submit. Do not use Umami's own `data-umami-event` attributes: Umami cancels same-tab link clicks to send them, which turns Next.js `<Link>` navigation into full page reloads.

### Security headers
`next.config.ts` defines a strict CSP. Any new external origin (scripts, images, fetch targets, iframes) must be added to `cspHeader`, and to `images.remotePatterns` when used with `next/image`. The Umami origins are added only when analytics is configured.

## Project docs to consult
- `PORTFOLIO_CMS_PLAN.md`: the milestone plan (M0–M11) with task IDs, acceptance criteria, a global definition of done, and a Decision Log. When asked to implement a task ID, follow its rules: work on one task at a time, preserve unrelated changes, never touch production Supabase resources without permission, run lint/build/tests, and update the checklist and Decision Log. Many checkboxes are still unchecked even though the work is done, so check the code before assuming a task is outstanding.
- `design-system/keltoum-malouki-portfolio/MASTER.md`: design tokens and rules (dark-first navy + blue→violet palette, glass/bento surfaces, WCAG AA, reduced-motion safety). A page-specific `design-system/pages/<name>.md` overrides it if one exists. Keep it in sync with `src/app/globals.css`.
- `src/lib/supabase/README.md` and `supabase/README.md`: client boundaries and local DB workflow.
