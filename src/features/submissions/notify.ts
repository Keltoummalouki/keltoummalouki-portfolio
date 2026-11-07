import 'server-only'

import { SITE_URL } from '@/features/seo/site'
import {
  buildNotificationRequests,
  buildSubmissionNotification,
  providerError,
  type NewSubmission,
} from './notifications'

// Owner alerts for new public submissions. Each channel (Telegram, Discord,
// Resend email) is optional and switched on by its environment variables; with
// none set, this does nothing.

const TIMEOUT_MS = 5_000

/**
 * Sends a short alert, with a link to the submission in the dashboard, on
 * every configured channel. Never throws: the submission is already saved, so
 * a failed alert is only logged. Call it through `after()` so the visitor
 * never waits for it.
 */
export async function notifyNewSubmission(submission: NewSubmission): Promise<void> {
  const notification = buildSubmissionNotification(submission, SITE_URL)

  await Promise.all(
    buildNotificationRequests(process.env, notification).map(async ({ channel, url, headers, body }) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) {
          console.error(`${channel} notification failed: HTTP ${res.status} ${providerError(await res.text())}`)
        }
      } catch (error) {
        // Never log the URL: Telegram and Discord carry their token in it.
        console.error(
          `${channel} notification failed:`,
          error instanceof Error ? error.message : 'unknown error',
        )
      }
    }),
  )
}
