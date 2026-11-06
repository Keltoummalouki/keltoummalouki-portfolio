import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Purges every cached public page (all locales, every route under `[locale]`).
 * Public pages are cached (ISR), so every admin action that changes published
 * content calls this: edits show up on the next visit instead of waiting for
 * the hourly revalidation. Content is shared across pages (header, footer,
 * profile facts), so purging everything is simpler and safer than per-path.
 */
export function revalidatePublicSite(): void {
  revalidatePath('/[locale]', 'layout')
}
