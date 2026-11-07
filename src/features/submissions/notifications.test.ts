import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EMAIL_FROM,
  buildNotificationRequests,
  buildSubmissionNotification,
  providerError,
  type NewSubmission,
  type NotificationChannel,
} from './notifications'

const SITE = 'https://www.example.com'
const ID = '7f1c2a9e-4b1d-4c55-9a8e-2f3b6d0e1a11'

const message: Extract<NewSubmission, { kind: 'contact_message' }> = {
  kind: 'contact_message',
  id: ID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Website redesign',
  message: 'Hello Keltoum,\n\nWe would like a new site for our agency.',
}

const lead: Extract<NewSubmission, { kind: 'freelance_lead' }> = {
  kind: 'freelance_lead',
  id: ID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  company: null,
  projectType: 'web_app',
  budget: '5k_15k',
  timeline: null,
  contactPreference: 'video',
  details: 'A booking platform in three languages.',
}

const ALL_CHANNELS = {
  TELEGRAM_BOT_TOKEN: '123:abc',
  TELEGRAM_CHAT_ID: '42',
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/token',
  RESEND_API_KEY: 're_test',
  NOTIFY_EMAIL_TO: 'owner@example.com',
}

function requestFor(
  channel: NotificationChannel,
  submission: NewSubmission = message,
  env: Record<string, string> = ALL_CHANNELS,
) {
  const request = buildNotificationRequests(env, buildSubmissionNotification(submission, SITE)).find(
    (r) => r.channel === channel,
  )
  if (!request) throw new Error(`no ${channel} request`)
  return request
}

describe('buildSubmissionNotification', () => {
  it('links a contact message to its inbox page', () => {
    const n = buildSubmissionNotification(message, SITE)
    expect(n.heading).toBe('New contact message')
    expect(n.url).toBe(`${SITE}/admin/inbox/${ID}`)
    expect(n.replyTo).toBe('jane@example.com')
    expect(n.fields).toEqual([
      { label: 'From', value: 'Jane Doe' },
      { label: 'Email', value: 'jane@example.com' },
      { label: 'Subject', value: 'Website redesign' },
    ])
  })

  it('leaves out empty fields', () => {
    const n = buildSubmissionNotification({ ...message, subject: null }, SITE)
    expect(n.fields.map((f) => f.label)).toEqual(['From', 'Email'])
  })

  it('describes a lead with the admin labels and links to its lead page', () => {
    const n = buildSubmissionNotification(lead, SITE)
    expect(n.heading).toBe('New project request')
    expect(n.url).toBe(`${SITE}/admin/leads/${ID}`)
    expect(n.fields).toEqual([
      { label: 'From', value: 'Jane Doe' },
      { label: 'Email', value: 'jane@example.com' },
      { label: 'Project type', value: 'Web app' },
      { label: 'Budget', value: '€5k–15k' },
      { label: 'Contact preference', value: 'Video call' },
    ])
  })

  it('puts the start of the text on one line', () => {
    expect(buildSubmissionNotification(message, SITE).excerpt).toBe(
      'Hello Keltoum, We would like a new site for our agency.',
    )
  })

  it('cuts long text to 280 characters without splitting an emoji', () => {
    expect(buildSubmissionNotification({ ...message, message: 'a'.repeat(400) }, SITE).excerpt).toBe(
      `${'a'.repeat(279)}…`,
    )
    expect(buildSubmissionNotification({ ...message, message: `${'a'.repeat(278)}😀😀😀` }, SITE).excerpt).toBe(
      `${'a'.repeat(278)}😀…`,
    )
  })
})

describe('buildNotificationRequests', () => {
  const n = buildSubmissionNotification(message, SITE)

  it('sends nothing when no channel is configured', () => {
    expect(buildNotificationRequests({}, n)).toEqual([])
  })

  it('needs every variable of a channel and ignores blank ones', () => {
    const env = { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '  ', RESEND_API_KEY: 're_test' }
    expect(buildNotificationRequests(env, n)).toEqual([])
  })

  it('sends to every configured channel', () => {
    expect(buildNotificationRequests(ALL_CHANNELS, n).map((r) => r.channel)).toEqual([
      'telegram',
      'discord',
      'email',
    ])
  })
})

describe('telegram alert', () => {
  it('escapes visitor HTML and turns off link previews', () => {
    const request = requestFor('telegram', { ...message, name: '<b>Eve</b> & co' })
    const text = String(request.body.text)

    expect(request.url).toBe('https://api.telegram.org/bot123:abc/sendMessage')
    expect(request.body).toMatchObject({
      chat_id: '42',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    })
    expect(text).toContain('From: &lt;b&gt;Eve&lt;/b&gt; &amp; co')
    expect(text).toContain(`<a href="${SITE}/admin/inbox/${ID}">Open in dashboard</a>`)
  })
})

describe('discord alert', () => {
  it('blocks mentions, link previews and masked links', () => {
    const request = requestFor('discord', {
      ...message,
      message: '[Open in dashboard](https://evil.example) @everyone',
    })
    const content = String(request.body.content)

    expect(request.url).toBe(ALL_CHANNELS.DISCORD_WEBHOOK_URL)
    expect(request.body).toMatchObject({ allowed_mentions: { parse: [] }, flags: 4 })
    expect(content).toContain('> \\[Open in dashboard\\](https://evil.example) @everyone')
    expect(content.endsWith(`[Open in dashboard](${SITE}/admin/inbox/${ID})`)).toBe(true)
  })

  it('keeps a worst-case lead under the 2000-character message limit', () => {
    const worst = {
      ...lead,
      name: '_'.repeat(120),
      email: `${'_'.repeat(310)}@example.com`,
      company: '*'.repeat(160),
      timeline: '1_3_months' as const,
      details: '#'.repeat(5000),
    }
    expect(String(requestFor('discord', worst).body.content).length).toBeLessThanOrEqual(2000)
  })
})

describe('email alert', () => {
  it('sends through Resend with Reply-To set to the visitor', () => {
    const request = requestFor('email')

    expect(request.url).toBe('https://api.resend.com/emails')
    expect(request.headers).toEqual({ authorization: 'Bearer re_test' })
    expect(request.body).toMatchObject({
      from: DEFAULT_EMAIL_FROM,
      to: 'owner@example.com',
      reply_to: 'jane@example.com',
      subject: 'New contact message from Jane Doe',
    })
    expect(String(request.body.text)).toContain(`${SITE}/admin/inbox/${ID}`)
  })

  it('keeps the subject on one line', () => {
    const request = requestFor('email', { ...message, name: 'Jane\r\nBcc: someone@example.com' })
    expect(request.body.subject).toBe('New contact message from Jane Bcc: someone@example.com')
  })

  it('uses NOTIFY_EMAIL_FROM when set', () => {
    const from = 'Portfolio <alerts@example.com>'
    expect(requestFor('email', message, { ...ALL_CHANNELS, NOTIFY_EMAIL_FROM: from }).body.from).toBe(from)
  })
})

describe('providerError', () => {
  it('reads the error text of each provider', () => {
    expect(providerError('{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}')).toBe(
      'Bad Request: chat not found',
    )
    expect(providerError('{"message":"Unknown Webhook","code":10015}')).toBe('Unknown Webhook')
  })

  it('returns an empty string for anything else', () => {
    expect(providerError('<html>Bad gateway</html>')).toBe('')
    expect(providerError('null')).toBe('')
  })
})
