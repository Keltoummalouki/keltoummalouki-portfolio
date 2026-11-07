# Portfolio CMS, Blog, Inbox, and Freelance Platform Plan

This document is the execution checklist for turning the current static portfolio into a secure, multilingual portfolio CMS using Next.js and Supabase. It is written so Claude Code can implement one task or milestone at a time without having to redesign the architecture during every session.

## 1. Project outcome

Build a zero-cost-first system that provides:

- A secure, private administration dashboard.
- Database-managed portfolio content in French, English, and Arabic.
- A contact inbox with message statuses and notes.
- A multilingual blog with drafts, previews, publishing, tags, and SEO.
- A freelance services page and a small lead-management pipeline.
- Secure image and document management.
- Fast public pages that remain responsive, accessible, SEO-friendly, and RTL-compatible.

## 2. Agreed technical direction

- Keep the existing Next.js 15 App Router application.
- Use a modular monolith; do not create a separate Express or NestJS service.
- Use Supabase Free for PostgreSQL, Auth, Storage, and optional Edge Functions.
- Use Next.js Server Components for public reads.
- Use Server Actions or Route Handlers for validated writes.
- Use Supabase Row Level Security as the final authorization layer.
- Use Cloudflare Turnstile Free on public forms.
- Store editable content in normalized tables with separate translation tables.
- Keep interface labels in `messages/fr.json`, `messages/en.json`, and `messages/ar.json`.
- Store article bodies as Markdown and sanitize rendered HTML.
- Use locale-prefixed public URLs such as `/fr/blog/...`, `/en/blog/...`, and `/ar/blog/...`.
- Use static generation or caching with on-demand revalidation for public content.

## 3. Rules for Claude Code

Before starting any task:

- [ ] Read `CLAUDE.md` and this plan completely.
- [ ] Inspect `git status` and preserve unrelated user changes.
- [ ] Work on one task ID or one milestone only unless the user explicitly expands scope.
- [ ] State which files will be modified before editing them.
- [ ] Do not create or change Supabase production resources without explicit permission.
- [ ] Never place a service-role key, Turnstile secret, or other secret in client code.
- [ ] Do not mark a task complete until its acceptance criteria pass.
- [ ] Run the relevant verification commands after implementation.
- [ ] Update the checkboxes in this plan and add a short entry to the Decision Log.

Recommended prompt for a new Claude session:

```text
Read CLAUDE.md and PORTFOLIO_CMS_PLAN.md. Implement task [TASK-ID] only.
Inspect the current worktree before editing and preserve unrelated changes.
Follow the task requirements, security rules, and acceptance criteria.
Run the required checks, update the task checkbox, and summarize changed files,
verification results, remaining manual steps, and any decisions made.
```

## 4. Global definition of done

Every implementation task must satisfy the applicable items below:

- [ ] TypeScript remains strict; no unjustified `any` types.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Relevant automated tests pass once a test runner exists.
- [ ] No secrets or real credentials are committed.
- [ ] Database changes are represented by versioned migrations.
- [ ] RLS is enabled and tested for every exposed table.
- [ ] Public, authenticated, and administrator access are tested separately.
- [ ] English, French, and Arabic UI messages remain synchronized.
- [ ] Arabic layout and RTL behavior are manually checked.
- [ ] Keyboard navigation, focus states, labels, errors, and reduced motion are checked.
- [ ] Mobile, tablet, and desktop layouts are checked.
- [ ] Loading, empty, success, and failure states are implemented.
- [ ] Relevant documentation and this checklist are updated.

## 5. Dependency and delivery map

```text
M0 Decisions
   -> M1 Engineering foundation
      -> M2 Database and RLS
         -> M3 Authentication and dashboard shell
            -> M4 Internationalized routing and SEO
               -> M5 Projects vertical slice
                  -> M6 Remaining portfolio CMS
            -> M7 Contact inbox
            -> M8 Blog publishing
            -> M9 Freelance leads
               -> M10 Hardening and quality
                  -> M11 Deployment and launch
```

After M3, the content, inbox, blog, and freelance modules can be developed in separate branches, but they should be integrated and verified one at a time.

## 6. Suggested six-sprint schedule

| Sprint | Focus | Exit result |
| --- | --- | --- |
| 1 | M0-M2 | Local Supabase, migrations, generated types, and tested RLS |
| 2 | M3-M4 | Secure dashboard shell and locale-prefixed public routes |
| 3 | M5-M6 | Projects and remaining portfolio content managed from dashboard |
| 4 | M7 and M9 | Contact inbox, protected forms, and freelance lead pipeline |
| 5 | M8 | Multilingual blog, editor, preview, publishing, and SEO |
| 6 | M10-M11 | Security review, accessibility, performance, deployment, and launch |

The sprint sequence matters more than the calendar dates. Do not migrate every content section before the Projects vertical slice is proven.

---

# Milestone checklists

## M0 — Confirm product and free-tier decisions

### M0-T1 — Confirm scope and editorial choices `[USER]`

- [ ] Confirm Supabase as the backend provider.
- [ ] Confirm Markdown as the initial article editor format.
- [ ] Confirm locale-prefixed public URLs.
- [ ] Confirm that only one administrator account is required initially.
- [ ] Confirm that dashboard email replies initially open the local email client instead of using a paid transactional-email service.
- [ ] Decide whether comments are out of scope for the first release. Recommended: keep them out of scope.

Acceptance criteria:

- The five decisions above are recorded in the Decision Log.
- Features not included in the first release are clearly listed under Future Enhancements.

### M0-T2 — Choose compliant free hosting `[USER]`

- [ ] Check the current production host.
- [ ] If using Vercel Hobby, decide whether to move because the portfolio advertises commercial freelance services.
- [ ] Compare Netlify Free and Cloudflare Workers Free for the current Next.js application.
- [ ] Select a host with hard free-tier limits and no surprise billing.
- [ ] Do not migrate hosting until M11 unless the current host blocks development.

Acceptance criteria:

- The selected hosting target is recorded in the Decision Log.
- No paid resource is enabled without explicit approval.

## M1 — Engineering foundation

### M1-T1 — Add dependencies and environment contract

- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`.
- [ ] Install `zod` for server-side validation.
- [ ] Install the chosen Markdown rendering packages: `react-markdown`, `remark-gfm`, and `rehype-sanitize`.
- [ ] Add `.env.example` with names only, never real values.
- [ ] Document public versus server-only environment variables.
- [ ] Update CSP planning for Supabase and Turnstile; apply CSP changes only when those integrations are implemented.

Environment contract:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Acceptance criteria:

- The application builds without real credentials by using a clear development fallback or setup error.
- `SUPABASE_SERVICE_ROLE_KEY` and `TURNSTILE_SECRET_KEY` are referenced only by server modules.
- `.env.local` remains ignored by Git.

### M1-T2 — Establish module boundaries

- [ ] Create `src/lib/supabase/` for browser, server, and privileged server clients.
- [ ] Create `src/features/auth/`.
- [ ] Create `src/features/content/`.
- [ ] Create `src/features/articles/`.
- [ ] Create `src/features/inbox/`.
- [ ] Create `src/features/freelance/`.
- [ ] Create `src/lib/validation/` for shared schemas.
- [ ] Create `supabase/migrations/` and `supabase/seed.sql`.
- [ ] Keep database access out of visual components.

Acceptance criteria:

- Server-only modules use `server-only` where appropriate.
- UI components call typed feature functions rather than embedding raw queries.
- No service-role client can be imported into a Client Component.

### M1-T3 — Add an automated test baseline

- [ ] Add Vitest with a TypeScript-compatible configuration.
- [ ] Add scripts for unit tests and coverage.
- [ ] Add one validation-schema test.
- [ ] Add one pure content-mapping test.
- [ ] Document that Supabase RLS integration tests require the local Supabase stack.

Acceptance criteria:

- `npm test` runs successfully.
- Tests do not require a production Supabase project.

## M2 — Supabase database, storage, and RLS

### M2-T1 — Create local Supabase configuration

- [ ] Initialize the Supabase CLI configuration.
- [ ] Start the local Supabase stack.
- [ ] Document local startup, reset, migration, seed, and type-generation commands.
- [ ] Add generated TypeScript database types to the project.

Acceptance criteria:

- A clean local database can be recreated entirely from migrations and seed data.
- Generated database types compile with the application.

### M2-T2 — Create identity and authorization migration

- [ ] Create `admin_profiles` linked one-to-one with `auth.users`.
- [ ] Add an administrator role constraint; prepare for more roles without exposing them yet.
- [ ] Add a secure `is_admin()` database helper.
- [ ] Add `created_at` and `updated_at` conventions.
- [ ] Add a reusable `updated_at` trigger.
- [ ] Enable RLS.
- [ ] Allow administrators to read their own profile.
- [ ] Deny anonymous access.

Acceptance criteria:

- An unauthenticated user cannot read administrator records.
- A normal authenticated user cannot become an administrator by editing metadata.
- Authorization relies on server-controlled records or claims, not user-editable metadata.

### M2-T3 — Create portfolio content migrations

- [ ] Create `projects` and `project_translations`.
- [ ] Create `experiences` and `experience_translations`.
- [ ] Create `education` and `education_translations`.
- [ ] Create `certifications` and `certification_translations`.
- [ ] Create `skills` and skill categories.
- [ ] Create `services` and `service_translations`.
- [ ] Create `site_settings` for singleton structured settings.
- [ ] Add locale constraints for `fr`, `en`, and `ar`.
- [ ] Add unique constraints such as `(project_id, locale)`.
- [ ] Add publication status, featured flag, and sort order where appropriate.
- [ ] Add useful indexes for public listing and dashboard sorting.

Acceptance criteria:

- Anonymous users can select only published content.
- Administrators have full CRUD access.
- Each translated entity supports exactly one row per locale.
- Invalid locales and duplicate translations are rejected by the database.

### M2-T4 — Create article publishing migrations

- [ ] Create `articles`.
- [ ] Create `article_translations`.
- [ ] Create `tags` and `article_tags`.
- [ ] Add statuses: `draft`, `published`, and `archived`.
- [ ] Add cover image, author, published time, and optional scheduled time.
- [ ] Add translated slug, title, excerpt, Markdown body, and SEO fields.
- [ ] Add unique locale-aware slug constraints.
- [ ] Add indexes for status, publication date, slug, and tags.

Acceptance criteria:

- Public users cannot read drafts or archived articles.
- A published article must have at least the required default French translation.
- Duplicate slugs within a locale are rejected.

### M2-T5 — Create inbox and freelance CRM migrations

- [ ] Create `messages` with `new`, `read`, `replied`, `archived`, and `spam` statuses.
- [ ] Create `freelance_inquiries` with `new`, `qualified`, `meeting`, `proposal`, `won`, `lost`, and `spam` statuses.
- [ ] Create private `inquiry_notes`.
- [ ] Add server-validated length constraints.
- [ ] Add timestamps and dashboard indexes.
- [ ] Store only necessary personal data.
- [ ] Define a retention/deletion strategy.

Acceptance criteria:

- Anonymous users cannot list, read, update, or delete messages or inquiries.
- Administrators can manage all records.
- Public creation occurs only through the protected server endpoint, not unrestricted direct table access.

### M2-T6 — Create storage buckets and policies

- [ ] Create a public-read `portfolio-media` bucket.
- [ ] Create a public-read `article-media` bucket.
- [ ] Create a private bucket only if private files become necessary.
- [ ] Restrict writes and deletes to administrators.
- [ ] Enforce allowed MIME types and maximum file sizes in both code and storage policy where possible.
- [ ] Define predictable, collision-resistant file paths.

Acceptance criteria:

- Anonymous visitors can view published public images.
- Anonymous and non-admin authenticated users cannot upload or delete files.
- SVG uploads are rejected or sanitized according to an explicit decision.

### M2-T7 — Add RLS integration tests

- [ ] Test anonymous published-content reads.
- [ ] Test anonymous draft-content rejection.
- [ ] Test authenticated non-admin rejection.
- [ ] Test administrator CRUD.
- [ ] Test that message and lead contents never appear to anonymous users.
- [ ] Test storage write policies.

Acceptance criteria:

- The local RLS test suite passes after a fresh database reset.
- Every exposed table has at least one positive and one negative authorization test.

## M3 — Authentication and dashboard shell

### M3-T1 — Create Supabase client utilities

- [ ] Implement a browser client.
- [ ] Implement a cookie-aware server client.
- [ ] Implement a privileged server-only client only where necessary.
- [ ] Add auth-token refresh middleware compatible with the installed Next.js version.
- [ ] Add typed error mapping that does not leak provider details.

Acceptance criteria:

- Browser code contains only the public URL and anon key.
- Server identity is revalidated before protected actions.
- Authentication works after a full page refresh.

### M3-T2 — Configure the administrator account `[USER + CLAUDE]`

- [ ] Create the production Supabase project on the Free plan. `[USER]`
- [ ] Add local and deployment environment values. `[USER]`
- [ ] Disable open public sign-up. `[USER]`
- [ ] Create the first administrator account manually. `[USER]`
- [ ] Insert its `admin_profiles` record through a safe migration or one-time setup. `[CLAUDE]`
- [ ] Enable and test TOTP MFA for the administrator. `[USER + CLAUDE]`

Acceptance criteria:

- There is no public registration page.
- A valid admin can sign in and sign out.
- A non-admin authenticated account cannot enter the dashboard or mutate content.
- MFA is required for privileged dashboard use before launch.

### M3-T3 — Build login and protected dashboard layout

- [ ] Create an accessible `/admin/login` page.
- [ ] Create a protected `/admin` layout.
- [ ] Add sidebar navigation and mobile navigation.
- [ ] Add account, theme, and sign-out controls.
- [ ] Add loading, unauthorized, and auth-error states.
- [ ] Add an overview page with real counts once feature tables exist.
- [ ] Ensure middleware improves navigation but RLS remains the actual security boundary.

Acceptance criteria:

- Anonymous dashboard access redirects to login.
- Authenticated non-admin access returns an unauthorized result.
- Admin navigation is usable with keyboard and on mobile.

## M4 — Internationalized routing and SEO foundation

### M4-T1 — Migrate public routes to locale prefixes

- [ ] Introduce a `[locale]` route segment for public pages.
- [ ] Preserve French as the default locale.
- [ ] Redirect `/` to `/fr` or negotiate once and then use canonical locale URLs.
- [ ] Update `LanguageSwitcher` to navigate rather than reload after only changing a cookie.
- [ ] Keep the locale cookie as a preference, not the canonical source of the URL.
- [ ] Preserve `lang` and Arabic `dir="rtl"` behavior.
- [ ] Keep `/admin` outside locale routing unless a later decision requires localized dashboard URLs.

Acceptance criteria:

- `/fr`, `/en`, and `/ar` render the correct interface.
- Each language has its own canonical URL.
- Language switching preserves the equivalent route where possible.
- Arabic remains correctly RTL.

### M4-T2 — Add SEO infrastructure

- [ ] Add locale-aware metadata helpers.
- [ ] Add canonical and `hreflang` links.
- [ ] Add `sitemap.xml` generation.
- [ ] Add `robots.txt` generation.
- [ ] Exclude admin and preview routes from indexing.
- [ ] Add Person/ProfessionalService structured data.
- [ ] Prepare Article structured data for M8.
- [ ] Add a default Open Graph image and localized metadata.

Acceptance criteria:

- No admin or draft page is indexable.
- Public locale variants reference each other correctly.
- Metadata uses database content only after it has been validated and published.

## M5 — Projects: prove one complete vertical slice

### M5-T1 — Implement project data access

- [ ] Add typed project repositories/queries.
- [ ] Add public published-project queries by locale.
- [ ] Add admin list, detail, create, update, publish, reorder, and delete operations.
- [ ] Validate all mutations with Zod.
- [ ] Revalidate affected public paths after mutations.
- [ ] Add unit tests for validation and content mapping.

Acceptance criteria:

- The public query cannot return unpublished projects.
- Admin mutations fail safely for unauthenticated and non-admin users.
- Missing translations have an explicit fallback policy.

### M5-T2 — Build project dashboard screens

- [ ] Build project list with search, published status, featured status, and ordering.
- [ ] Build create and edit forms.
- [ ] Add FR/EN/AR translation tabs and completeness indicators.
- [ ] Add image upload, preview, replacement, and deletion handling.
- [ ] Add GitHub and live-demo URL validation.
- [ ] Add publish/unpublish confirmation.
- [ ] Add empty, loading, validation-error, and success states.

Acceptance criteria:

- An administrator can complete the whole project lifecycle without using the Supabase dashboard.
- An incomplete translation is visible in the admin UI.
- Failed uploads do not leave broken database records.

### M5-T3 — Replace hardcoded public project data

- [ ] Seed the existing projects and their three translations.
- [ ] Refactor `ProjectsSection` to receive typed project data.
- [ ] Keep animation logic separate from data fetching.
- [ ] Add a useful empty state if no projects are published.
- [ ] Cache public output and support on-demand revalidation.

Acceptance criteria:

- Existing visual behavior is preserved.
- Editing a project in the dashboard updates the public section after revalidation.
- The public page does not expose dashboard-only fields.

### M5 checkpoint — Architecture review

- [ ] Review project file boundaries and query patterns.
- [ ] Review RLS and server authorization.
- [ ] Review translation editing usability.
- [ ] Review cache invalidation.
- [ ] Correct the pattern before copying it to other content types.

Do not begin the bulk content migration until this checkpoint is approved.

## M6 — Remaining portfolio CMS

### M6-T1 — Experience and education

- [ ] Build typed CRUD and translations for experience.
- [ ] Build typed CRUD and translations for education.
- [ ] Add ordering and publish controls.
- [ ] Seed current content.
- [ ] Refactor public sections to use database content.

### M6-T2 — Skills and certifications

- [ ] Build skill-category management.
- [ ] Build skill management with levels or labels only if they communicate useful evidence.
- [ ] Build certification CRUD with issuer, date, credential URL, and image.
- [ ] Seed current content.
- [ ] Refactor public sections.

### M6-T3 — Services, profile, social links, and site settings

- [ ] Build service CRUD with translations.
- [ ] Manage availability status.
- [ ] Manage primary CTA, contact details, and social links.
- [ ] Manage downloadable CV metadata/file.
- [ ] Add safe singleton settings updates.
- [ ] Refactor relevant public components.

Acceptance criteria for M6:

- All repeatable public content can be managed without code edits.
- UI labels remain in message JSON files.
- Public components receive typed data and retain responsive/animated behavior.
- Content has ordering, publication, and translation-completeness controls.

## M7 — Contact inbox

### M7-T1 — Build the secure contact endpoint

- [ ] Create a Zod schema for name, email, optional subject, and message.
- [ ] Normalize inputs without destructively altering valid names or message text.
- [ ] Create and configure a Cloudflare Turnstile widget. `[USER]`
- [ ] Verify Turnstile tokens on the server.
- [ ] Add server-side rate limiting using a free, documented strategy.
- [ ] Insert messages through a server-only path.
- [ ] Return localized, generic errors.
- [ ] Add structured server logging without logging message bodies or secrets.

Acceptance criteria:

- Invalid, oversized, bot, and rate-limited submissions are rejected.
- A successful submission creates exactly one message.
- The browser cannot read stored messages.
- Raw Supabase or Turnstile errors are not shown publicly.

### M7-T2 — Replace EmailJS submission

- [ ] Update the current form to call the secure endpoint.
- [ ] Preserve accessible validation and success/error states.
- [ ] Add optional subject and consent/privacy text if approved.
- [ ] Remove EmailJS code and dependency once no longer used.
- [ ] Remove EmailJS domains from CSP after removal.
- [ ] Add Supabase and Turnstile CSP directives.

Acceptance criteria:

- Contact messages appear in the dashboard inbox.
- The form works in all three locales.
- Keyboard, screen-reader, and reduced-motion behavior remains correct.

### M7-T3 — Build inbox dashboard

- [ ] Add message list, unread count, search, filters, and pagination.
- [ ] Add message detail view.
- [ ] Add status transitions: new, read, replied, archived, and spam.
- [ ] Add a safe `mailto:` reply action.
- [ ] Add delete confirmation and retention guidance.
- [ ] Prevent message content from being rendered as HTML.

Acceptance criteria:

- Only administrators can access inbox data.
- Status counts update correctly.
- Message text cannot inject scripts or markup.

## M8 — Multilingual blog

### M8-T1 — Implement article domain and data access

- [ ] Add typed public and admin queries.
- [ ] Add draft, publish, unpublish, archive, and delete operations.
- [ ] Add slug generation with manual override.
- [ ] Add tags.
- [ ] Calculate or store reading time consistently.
- [ ] Revalidate article list, detail, sitemap, and RSS output after publishing changes.

Acceptance criteria:

- Drafts never appear in public queries, sitemap, RSS, or metadata.
- Locale-specific slugs resolve the correct translation.
- Publishing is rejected when required fields are incomplete.

### M8-T2 — Build article editor

- [ ] Add article list with filters and status indicators.
- [ ] Add FR/EN/AR editor tabs.
- [ ] Add title, slug, excerpt, Markdown body, cover, tags, and SEO fields.
- [ ] Add safe Markdown preview using `rehype-sanitize`.
- [ ] Add save-draft and publish actions.
- [ ] Warn before leaving with unsaved changes.
- [ ] Add a translation completeness checklist.
- [ ] Add accessible validation summaries.

Acceptance criteria:

- An administrator can create, preview, publish, edit, and archive an article.
- Unsafe Markdown/HTML is sanitized.
- A failed save does not lose the current editor contents.

### M8-T3 — Build public blog pages

- [ ] Add locale-aware blog index pages.
- [ ] Add locale-aware article detail pages.
- [ ] Add tag filtering and pagination.
- [ ] Add responsive article typography.
- [ ] Add cover images, publication date, reading time, and share links.
- [ ] Add related articles based on tags.
- [ ] Add not-found handling for missing translations or slugs.
- [ ] Do not add comments in the first release.

Acceptance criteria:

- Blog pages work in FR, EN, and AR.
- Article typography and code blocks work on mobile.
- Draft and archived URLs return not found to public visitors.

### M8-T4 — Complete blog SEO and discovery

- [ ] Add dynamic metadata per translation.
- [ ] Add Article JSON-LD.
- [ ] Add articles to the sitemap.
- [ ] Generate a locale-aware RSS feed.
- [ ] Add canonical and alternate-language links.
- [ ] Add Open Graph and social-card metadata.

Acceptance criteria:

- Published posts have valid metadata and structured data.
- Drafts remain excluded from every discovery mechanism.

## M9 — Freelance services and lead pipeline

### M9-T1 — Build the public freelance page

- [ ] Add a locale-aware `/[locale]/freelance` route.
- [ ] Present services, ideal clients, process, deliverables, and availability.
- [ ] Add selected case studies and measurable outcomes.
- [ ] Add a clear project-inquiry CTA.
- [ ] Add FAQ content managed through approved content fields.
- [ ] Avoid fake testimonials, clients, metrics, or guarantees.

Acceptance criteria:

- The visitor can understand the offer, process, and next action quickly.
- The page is responsive, accessible, and RTL-compatible.
- Claims are evidence-based.

### M9-T2 — Build the project inquiry endpoint and form

- [ ] Collect name, email, optional company, project type, budget range, timeline, details, and contact preference.
- [ ] Translate all options and validation messages.
- [ ] Reuse Turnstile and rate-limiting infrastructure.
- [ ] Validate on the server and insert through a server-only path.
- [ ] Add a privacy notice and avoid unnecessary personal data.

Acceptance criteria:

- Valid submissions create one lead.
- Invalid or automated submissions are rejected.
- Lead data is never publicly readable.

### M9-T3 — Build lead-management dashboard

- [ ] Add list and optional Kanban views.
- [ ] Add statuses: new, qualified, meeting, proposal, won, lost, and spam.
- [ ] Add filters for project type, budget, and status.
- [ ] Add private notes.
- [ ] Add `mailto:` contact action.
- [ ] Add CSV export if it can be implemented without exposing other private data.

Acceptance criteria:

- Only administrators can see leads and notes.
- Status history or `updated_at` makes recent changes understandable.
- Exports require explicit administrator action.

## M10 — Security, quality, and operational hardening

### M10-T1 — Security review

- [ ] Review every RLS policy and storage policy.
- [ ] Search the client bundle and source for leaked secrets.
- [ ] Verify no Client Component imports privileged modules.
- [ ] Review CSP, security headers, cookie settings, and redirects.
- [ ] Review authentication refresh and logout behavior.
- [ ] Test horizontal and vertical authorization failures.
- [ ] Test upload abuse, oversized inputs, Markdown injection, and stored XSS.
- [ ] Review dependency audit results and resolve actionable issues.

### M10-T2 — Accessibility and internationalization review

- [ ] Navigate public and admin interfaces using only a keyboard.
- [ ] Test form labels, errors, status announcements, dialogs, and focus restoration.
- [ ] Test reduced-motion behavior.
- [ ] Check color contrast.
- [ ] Verify FR/EN/AR completeness.
- [ ] Verify Arabic layout, text alignment, icon direction, and mixed LTR content.
- [ ] Ensure data tables or cards are usable on small screens.

### M10-T3 — Performance review

- [ ] Keep public content server-rendered or statically cached where appropriate.
- [ ] Add on-demand revalidation after dashboard mutations.
- [ ] Optimize uploaded images and responsive sizes.
- [ ] Lazy-load heavy 3D and animation work.
- [ ] Avoid loading dashboard dependencies on public pages.
- [ ] Run Lighthouse on representative public pages.
- [ ] Record and fix serious performance, accessibility, SEO, and best-practice regressions.

### M10-T4 — Backup, retention, and failure handling

- [ ] Document how to export database content.
- [ ] Add a safe content export feature if practical.
- [ ] Document how to restore media references and database rows.
- [ ] Define message and lead retention periods.
- [ ] Add graceful public states for temporarily unavailable Supabase services.
- [ ] Confirm cached published pages remain useful during a transient backend failure.

Acceptance criteria for M10:

- No known critical/high security issue remains.
- Core flows pass accessibility checks.
- Public pages meet agreed Lighthouse targets.
- Recovery and retention steps are documented.

## M11 — Deployment and launch

### M11-T1 — Prepare deployment configuration

- [ ] Confirm the chosen host and free-tier limits. `[USER]`
- [ ] Configure production environment variables. `[USER]`
- [ ] Configure Supabase allowed URLs and redirects. `[USER + CLAUDE]`
- [ ] Configure Turnstile production hostname. `[USER]`
- [ ] Apply production migrations through a reviewed process.
- [ ] Seed only intended public content.
- [ ] Configure custom domain and HTTPS. `[USER]`
- [ ] Ensure no billing auto-upgrade or auto-recharge is enabled unless explicitly approved. `[USER]`

### M11-T2 — Production smoke test

- [ ] Test FR, EN, and AR public home pages.
- [ ] Test language switching and canonical URLs.
- [ ] Test admin login, MFA, logout, and access denial.
- [ ] Test creating and publishing a project.
- [ ] Test contact submission and inbox processing.
- [ ] Test freelance inquiry and lead processing.
- [ ] Test article draft, preview, publication, sitemap, and RSS.
- [ ] Test image upload and deletion.
- [ ] Test mobile and desktop browsers.
- [ ] Re-run build, tests, Lighthouse, and security checks.

### M11-T3 — Documentation and handoff

- [ ] Update `README.md` architecture and setup instructions.
- [ ] Update `CLAUDE.md` with the final dynamic architecture and commands.
- [ ] Document local Supabase setup and migration workflow.
- [ ] Document administrator setup and recovery.
- [ ] Document content publishing, inbox, and lead workflows.
- [ ] Document free-tier limits and what happens when they are exceeded.
- [ ] Record final decisions and deferred features.

Launch acceptance criteria:

- Production smoke tests pass.
- No secret is present in Git history or the client bundle.
- Public forms are protected against basic spam and abuse.
- Dashboard content changes reliably update public pages.
- The site can be maintained without editing source code for normal content changes.

---

# Future enhancements — not part of the first release

- [ ] Scheduled publishing after the basic publish flow is stable.
- [ ] Transactional email notifications through a verified free provider.
- [ ] Replying to messages directly inside the dashboard.
- [ ] Newsletter subscriptions and consent tracking.
- [ ] Blog comments with moderation and anti-spam controls.
- [ ] Multiple administrator roles and audit logs.
- [ ] Content revision history and rollback.
- [ ] Automatic translation suggestions with manual approval.
- [ ] Public search across articles and projects.
- [ ] Privacy-friendly analytics.
- [ ] Testimonials management using only verified testimonials.
- [ ] Dynamic social-image generation.

# Decision Log

Add one line whenever a decision changes architecture, security, data shape, cost, or scope.

| Date | Decision | Reason | Affected tasks |
| --- | --- | --- | --- |
| YYYY-MM-DD | Supabase proposed as the backend platform | Combines PostgreSQL, Auth, Storage, RLS, and Edge Functions on a suitable free tier | M1-M11 |
| YYYY-MM-DD | Pending: hosting target | Vercel Hobby has non-commercial restrictions; select a compliant free alternative | M0-T2, M11 |
| 2026-11-07 | Production CSP no longer allows `'unsafe-eval'` (only `next dev` sends it); Zod runs jitless in the browser | Only React's development build needs eval. Zod's eval check would otherwise log a CSP violation on every page; `e2e/security.spec.ts` now fails on any violation | M10-T1 |
| 2026-11-07 | Dependabot version updates (weekly, minor and patch grouped, 7-day cooldown) and an RFC 9116 `security.txt` | Dependency updates arrive as CI-checked pull requests; vulnerability reporters get a published contact | M10-T1, M11-T3 |

# Progress summary

Update this table only after a milestone satisfies its acceptance criteria.

| Milestone | Status | Notes |
| --- | --- | --- |
| M0 Product decisions | Not started | |
| M1 Engineering foundation | Not started | |
| M2 Database and RLS | Not started | |
| M3 Authentication/dashboard | Not started | |
| M4 Locale routing/SEO | Not started | |
| M5 Projects vertical slice | Not started | |
| M6 Remaining portfolio CMS | Not started | |
| M7 Contact inbox | Not started | |
| M8 Blog | Not started | |
| M9 Freelance leads | Not started | |
| M10 Hardening | Not started | |
| M11 Deployment | Not started | |
