import type { ContactMessageValues } from '@/features/inbox/schema'
import {
  BUDGET_RANGE_LABELS,
  CONTACT_PREFERENCE_LABELS,
  PROJECT_TYPE_LABELS,
  TIMELINE_LABELS,
  type LeadFormValues,
} from '@/features/freelance/schema'

// Owner alerts for new contact messages and freelance leads. Pure (no server
// imports, no I/O) so the alert text and each provider's request are
// unit-testable; `notify.ts` reads the environment and sends them.

/** A submission that was just saved, with the id it was inserted under. */
export type NewSubmission =
  | ({ kind: 'contact_message'; id: string } & ContactMessageValues)
  | ({ kind: 'freelance_lead'; id: string } & LeadFormValues)

export interface NotificationField {
  label: string
  value: string
}

/** What an alert says, before it is formatted for a channel. */
export interface SubmissionNotification {
  heading: string
  /** The visitor's name, for the email subject. */
  name: string
  /** The visitor's address: replying to an email alert answers them directly. */
  replyTo: string
  /** One-line facts; empty ones are left out. */
  fields: NotificationField[]
  /** The start of the message or project details, on one line. */
  excerpt: string
  /** The submission's page in the admin dashboard. */
  url: string
}

export type NotificationChannel = 'telegram' | 'discord' | 'email'

/** One provider API call (always a JSON POST). */
export interface NotificationRequest {
  channel: NotificationChannel
  url: string
  headers?: Record<string, string>
  body: Record<string, unknown>
}

// Caps that keep a worst-case lead, fully escaped, under Discord's
// 2000-character message limit. Only an unusually long email address is cut.
const FIELD_MAX = 200
const EXCERPT_MAX = 280

/** Resend's shared test sender. It only delivers to your own Resend account address. */
export const DEFAULT_EMAIL_FROM = 'Portfolio <onboarding@resend.dev>'

/** Discord message flag that turns off link previews. */
const SUPPRESS_EMBEDS = 1 << 2

/** Collapses whitespace and cuts to `max` characters, counting code points so emoji stay whole. */
function shorten(text: string, max: number): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : chars.join('')
}

function fieldsOf(entries: [label: string, value: string | null][]): NotificationField[] {
  return entries.flatMap(([label, value]) => (value ? [{ label, value: shorten(value, FIELD_MAX) }] : []))
}

function labelOf(labels: Record<string, string>, value: string | null): string | null {
  return value ? (labels[value] ?? value) : null
}

export function buildSubmissionNotification(
  submission: NewSubmission,
  siteUrl: string,
): SubmissionNotification {
  const visitor = { name: shorten(submission.name, FIELD_MAX), replyTo: submission.email }
  const from: [string, string][] = [
    ['From', submission.name],
    ['Email', submission.email],
  ]

  if (submission.kind === 'contact_message') {
    return {
      heading: 'New contact message',
      ...visitor,
      fields: fieldsOf([...from, ['Subject', submission.subject]]),
      excerpt: shorten(submission.message, EXCERPT_MAX),
      url: `${siteUrl}/admin/inbox/${submission.id}`,
    }
  }

  // Same labels as the admin lead page.
  return {
    heading: 'New project request',
    ...visitor,
    fields: fieldsOf([
      ...from,
      ['Company', submission.company],
      ['Project type', labelOf(PROJECT_TYPE_LABELS, submission.projectType)],
      ['Budget', labelOf(BUDGET_RANGE_LABELS, submission.budget)],
      ['Timeline', labelOf(TIMELINE_LABELS, submission.timeline)],
      ['Contact preference', labelOf(CONTACT_PREFERENCE_LABELS, submission.contactPreference)],
    ]),
    excerpt: shorten(submission.details, EXCERPT_MAX),
    url: `${siteUrl}/admin/leads/${submission.id}`,
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Backslash-escapes Discord markdown, so visitor text shows as typed and cannot add masked links. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_~|<>[\]#-]/g, '\\$&')
}

function telegramText(n: SubmissionNotification): string {
  return [
    `<b>${n.heading}</b>`,
    ...n.fields.map((f) => `${f.label}: ${escapeHtml(f.value)}`),
    `<blockquote>${escapeHtml(n.excerpt)}</blockquote>`,
    `<a href="${escapeHtml(n.url)}">Open in dashboard</a>`,
  ].join('\n')
}

function discordText(n: SubmissionNotification): string {
  return [
    `**${n.heading}**`,
    ...n.fields.map((f) => `${f.label}: ${escapeMarkdown(f.value)}`),
    `> ${escapeMarkdown(n.excerpt)}`,
    `[Open in dashboard](${n.url})`,
  ].join('\n')
}

function emailText(n: SubmissionNotification): string {
  return [
    ...n.fields.map((f) => `${f.label}: ${f.value}`),
    '',
    n.excerpt,
    '',
    `Open it in the dashboard: ${n.url}`,
    `Replying to this email answers ${n.name} directly.`,
  ].join('\n')
}

function setting(env: Record<string, string | undefined>, key: string): string | undefined {
  return env[key]?.trim() || undefined
}

/**
 * One request per channel whose variables are all set in `env` (see
 * `.env.example`); an empty list when no channel is configured.
 */
export function buildNotificationRequests(
  env: Record<string, string | undefined>,
  n: SubmissionNotification,
): NotificationRequest[] {
  const requests: NotificationRequest[] = []

  const botToken = setting(env, 'TELEGRAM_BOT_TOKEN')
  const chatId = setting(env, 'TELEGRAM_CHAT_ID')
  if (botToken && chatId) {
    requests.push({
      channel: 'telegram',
      url: `https://api.telegram.org/bot${botToken}/sendMessage`,
      body: {
        chat_id: chatId,
        text: telegramText(n),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
    })
  }

  const webhookUrl = setting(env, 'DISCORD_WEBHOOK_URL')
  if (webhookUrl) {
    requests.push({
      channel: 'discord',
      url: webhookUrl,
      body: {
        content: discordText(n),
        allowed_mentions: { parse: [] },
        flags: SUPPRESS_EMBEDS,
      },
    })
  }

  const apiKey = setting(env, 'RESEND_API_KEY')
  const to = setting(env, 'NOTIFY_EMAIL_TO')
  if (apiKey && to) {
    requests.push({
      channel: 'email',
      url: 'https://api.resend.com/emails',
      headers: { authorization: `Bearer ${apiKey}` },
      body: {
        from: setting(env, 'NOTIFY_EMAIL_FROM') ?? DEFAULT_EMAIL_FROM,
        to,
        reply_to: n.replyTo,
        subject: `${n.heading} from ${n.name}`,
        text: emailText(n),
      },
    })
  }

  return requests
}

/**
 * The provider's own error text (Telegram `description`, Discord and Resend
 * `message`) for the server log. It names what is misconfigured, such as
 * "chat not found", without echoing the alert.
 */
export function providerError(body: string): string {
  try {
    const data = JSON.parse(body) as { description?: unknown; message?: unknown }
    const text = data.description ?? data.message
    return typeof text === 'string' ? text.slice(0, 200) : ''
  } catch {
    return ''
  }
}
