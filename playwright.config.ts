import { defineConfig, devices } from '@playwright/test'

// End-to-end smoke tests against a production build.
//
// The server never talks to a real backend: Supabase points at a closed local
// port, so public pages render their built-in fallback content (deterministic,
// no secrets needed in CI) and a form submission can never reach the live
// database. Turnstile, analytics and new-submission alerts are switched off.
// The build goes to `.next-e2e` so it never overwrites the `.next` of a
// running dev server.
const PORT = 3100
const OFFLINE_ENV = {
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:59999',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role-key',
  IP_HASH_SECRET: 'e2e-ip-hash-secret',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  TURNSTILE_SECRET_KEY: '',
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: '',
  TELEGRAM_BOT_TOKEN: '',
  DISCORD_WEBHOOK_URL: '',
  RESEND_API_KEY: '',
  NEXT_TELEMETRY_DISABLED: '1',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Skips scroll and reveal animations so assertions don't race them.
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional: E2E_BROWSER_CHANNEL=msedge (or chrome) uses an installed
        // browser instead of Playwright's download.
        ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    env: OFFLINE_ENV,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
