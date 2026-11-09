import { z } from 'zod'

// Validation for the contact inbox. Pure (no server imports) so it is safe to
// import from Client Components and unit tests.

export const MESSAGE_STATUSES = ['new', 'read', 'replied', 'archived', 'spam'] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]
export const messageStatusSchema = z.enum(MESSAGE_STATUSES)

/** What a visitor can say the message is about (the home page's topic picker). */
export const CONTACT_TOPICS = ['job', 'project', 'other'] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]

/**
 * The subject a topic gives a message in the inbox, the dashboard list and the
 * new-message alert. In English, like the rest of the dashboard.
 */
export const CONTACT_TOPIC_SUBJECTS: Record<ContactTopic, string> = {
  job: 'Job opportunity',
  project: 'Freelance project',
  other: 'General',
}

// One schema per field, so the browser can check a single field with the
// server's exact rules (see contact-form.ts).
export const contactNameSchema = z.string().trim().min(2, 'Name is too short').max(120, 'Name is too long')
export const contactEmailSchema = z.email('Enter a valid email').max(320)
export const contactBodySchema = z.string().trim().min(10, 'Message is too short').max(5000, 'Message is too long')

export const contactMessageSchema = z
  .object({
    name: contactNameSchema,
    email: contactEmailSchema,
    subject: z
      .string()
      .trim()
      .max(200, 'Subject is too long')
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    topic: z.enum(CONTACT_TOPICS).optional(),
    message: contactBodySchema,
  })
  // The topic only names the subject: it is not stored on its own.
  .transform(({ topic, ...values }) => ({
    ...values,
    subject: values.subject ?? (topic ? CONTACT_TOPIC_SUBJECTS[topic] : null),
  }))

export type ContactMessageValues = z.output<typeof contactMessageSchema>

/** Coarse, non-leaking reason code for the client to map to a localized message. */
export type ContactSubmitError = 'invalid' | 'captcha' | 'rate_limited' | 'server'

/** What the contact form's Server Action answers (`useActionState`). */
export interface ContactFormState {
  ok?: boolean
  error?: ContactSubmitError
  /** Fields the server refused, when `error` is `invalid`. */
  errors?: Partial<Record<'name' | 'email' | 'message', true>>
}
