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

Env setup: copy `.env.example` to `.env.local`. Turnstile keys are optional in dev: with no site key the widget is not rendered, and with no secret the server check is skipped. Analytics (Umami) is optional too: with no `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, no script loads and the CSP does not allow Umami. So are new-submission alerts: each channel (Telegram, Discord, Resend email) turns on only when all of its variables are set.

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
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SECRET`, `TELEGRAM_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `RESEND_API_KEY`) must only be read from `server-only` modules and must never get a `NEXT_PUBLIC_` prefix.

### Public submissions
Contact messages (`features/inbox`) and freelance leads (`features/freelance`) share one flow:
1. Zod validation.
2. Turnstile check (`inbox/turnstile.ts`).
3. `reservePublicSubmission()` (`features/submissions/rate-limit.ts`): HMAC-hashes the IP, rate-limits, and can mark the submission as spam.
4. Insert with the admin client. The action generates the row id (`randomUUID()`) instead of reading it back.
5. Unless the submission was marked as spam, `after(() => notifyNewSubmission(...))` (`features/submissions/notify.ts`) sends the owner a short alert with a dashboard link once the response is out. A failed alert is only logged. The alert text and each provider's request are built in the pure, unit-tested `submissions/notifications.ts`.

Error codes returned to the client are deliberately coarse (`invalid`, `captcha`, `rate_limited`, `server`).

### Public rendering and CMS data
- Public pages are cached (ISR, `revalidate = 3600`, locales pre-rendered). Nothing under `app/[locale]` may read cookies or headers, or the whole route becomes dynamic again. Every admin action that changes published content must call `revalidatePublicSite()` (`lib/revalidate-public.ts`), which purges all public pages at once. `/projects` stays per-request because of `?page=`.
- There is no `app/layout.tsx`. `app/[locale]/layout.tsx` and `app/admin/layout.tsx` are the two root layouts, sharing `components/layouts/RootDocument.tsx` (fonts, `<html lang dir>`) and `features/seo/root-metadata.ts`. A single root above `[locale]` could only get the locale from request headers.
- `app/[locale]/page.tsx` loads `getPublishedCmsContent(locale)` (`features/cms/queries.ts`) and `getPublishedProjects()`, then passes plain props into `components/sections/*`.
- Public queries catch their own errors and return empty or fallback data. `features/cms/fallbacks.ts` builds defaults from `messages/*.json`, so the site still renders when Supabase is unreachable or empty.
- Public queries filter on `status = 'published'` explicitly, on top of RLS, so an admin viewing the site never sees drafts.
- The site uses one solid blue, `--primary` (`#2A6AFF`), never a gradient or a coloured glow; `e2e/flat-colour.spec.ts` fails on one. Admin-editable theme settings (`design_settings`) become runtime CSS variables through `features/cms/design-css.ts` and `components/ui/DesignSettingsStyle.tsx`, so a saved primary colour overrides the default in `globals.css`. Visitor-level display preferences live in a cookie (`features/preferences`) that is read in the browser by `PreferenceProvider`, never on the server (that would make pages uncacheable).
- `/freelance` opens on the request form (`FreelanceLeadForm`, three steps) beside a Three.js model its answers build (`components/three/brief-stack/`; the mapping is the pure `briefSceneState()` in `features/freelance/brief.ts`). The form dispatches its Server Action by hand on purpose: going through `<form action>` makes React reset the form, which unchecks controlled radios. Spec: `design-system/pages/freelance.md`.
- The home page's `#projects` section is a list that opens one project at a time beside a Three.js concertina doing the same (`components/three/project-fold/`; the geometry is pure, in `layout.ts`). The list is the real interface: the canvas is `aria-hidden` and everything it does is also in the list. It uses one flat accent and no gradients. `/projects` keeps its rows (`ProjectRows`); both share `ProjectWindow` and `LivePreview`. Spec: `design-system/pages/home-projects.md`.
- Blog bodies are Markdown, rendered through `components/ui/Markdown.tsx` with `rehype-sanitize`.
- Uploads go to Supabase Storage via `features/cms/media.ts`.

### Analytics
Umami (cookie-less) loads only on public pages (`components/analytics/Analytics.tsx` in the `[locale]` layout) and only reports from the production hostname. To record a click, spread `trackClick(event, data)` from `lib/analytics/events.ts` on the link or button; it works in Server Components. Record conversions with `trackEvent()` after a successful submit. Do not use Umami's own `data-umami-event` attributes: Umami cancels same-tab link clicks to send them, which turns Next.js `<Link>` navigation into full page reloads.

### Security headers
`next.config.ts` defines a strict CSP. Any new external origin (scripts, images, fetch targets, iframes) must be added to `cspHeader`, and to `images.remotePatterns` when used with `next/image`. The Umami origins are added only when analytics is configured.

Production pages cannot use eval: only `next dev` sends `'unsafe-eval'`, which React's development build needs. Browser code must not rely on `eval` or `new Function`, which is also why Zod runs jitless in the browser (`src/instrumentation-client.ts`). `e2e/security.spec.ts` fails on any CSP violation, so run the e2e tests after adding a client-side dependency.

`public/.well-known/security.txt` (RFC 9116) carries an `Expires` date of 2027-11-01. Renew it before then, keeping it less than a year ahead.

### Admin studio (`/admin` UI)
- Look: tokens live in `app/admin/(protected)/studio.css`. Light mode is a warm stone canvas, dark mode is true black, and ink pills mark active and primary states. Cards use flat colours only, never gradients. Dashboard styles are in `dashboard/dashboard.css` and use container queries, so folding the sidebar reflows the page like a narrower window would.
- 3D: WebGL runs only on the dashboard (`dashboard/scenes/`: data volumes, latest-work deck, quick-actions orb). Scenes load with `next/dynamic({ ssr: false })` inside `components/admin/three/SceneCanvas.tsx`, which renders only while on screen, shows still frames under reduced motion, and falls back if WebGL is missing. Textures are drawn on canvases and reflections come from drei `Lightformer`s, so no external asset or CSP origin is needed. Other pages get `HeaderArt` (the page icon as a tile) rather than 3D objects.
- Motion: `lib/motion/studio-motion.ts` provides Lenis for every admin page (started once by `AdminShell`), `playDataMotion` (its `data-count` / `data-bar` / `data-row`… contract) and the tilt and magnetic helpers. `dashboard/motion.ts` is the dashboard's choreography; every page using `PageHeader` gets `PageMotion`. All of it is skipped under `prefers-reduced-motion`.
- Dates: everything on the Casablanca calendar (date labels, greeting, chart buckets) is computed on the server by `dashboardStats()` and passed down. Never format Casablanca time inside an SSR-rendered client component: Node and the browser can ship different time-zone data, which breaks hydration.
- Shared pieces in `components/admin/ui.tsx`: `EditLink` and `DeleteButton` (icon row actions) and `StatusBadge` (icon per status; `read` and `spam` show as icons only). The ⌘K palette (`CommandPalette.tsx`) lists `NAV_GROUPS` from `AdminNav.tsx`.

## Project docs to consult
- `PORTFOLIO_CMS_PLAN.md`: the milestone plan (M0–M11) with task IDs, acceptance criteria, a global definition of done, and a Decision Log. When asked to implement a task ID, follow its rules: work on one task at a time, preserve unrelated changes, never touch production Supabase resources without permission, run lint/build/tests, and update the checklist and Decision Log. Many checkboxes are still unchecked even though the work is done, so check the code before assuming a task is outstanding.
- `design-system/keltoum-malouki-portfolio/MASTER.md`: design tokens and rules (true-black canvas, one solid blue with no gradients, glass/bento surfaces, WCAG AA, reduced-motion safety). A page-specific `design-system/pages/<name>.md` overrides it if one exists (`freelance.md` and `home-projects.md` do). Keep it in sync with `src/app/globals.css`.
- `src/lib/supabase/README.md` and `supabase/README.md`: client boundaries and local DB workflow.
