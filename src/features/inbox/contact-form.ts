import {
  CONTACT_TOPICS,
  contactBodySchema,
  contactEmailSchema,
  contactNameSchema,
  type ContactTopic,
} from './schema'

// Logic of the home page's contact form and of the 3D letter it writes, free of
// React and Three.js so it can be unit-tested. Validation reuses the server's
// field schemas, so the browser and the Server Action can never disagree.

export interface ContactValues {
  topic: ContactTopic | ''
  name: string
  email: string
  message: string
}

export const EMPTY_CONTACT: ContactValues = { topic: '', name: '', email: '', message: '' }

/** Required fields, in page order. */
export const CONTACT_FIELDS = ['name', 'email', 'message'] as const
export type ContactField = (typeof CONTACT_FIELDS)[number]

/** Why a field is refused, for its message. */
export type ContactFieldError = 'required' | 'tooShort' | 'invalid' | 'tooLong'

/** The form's own cap: the server accepts more, a contact message needs less. */
export const MESSAGE_MAX_LENGTH = 2000
export const NAME_MAX_LENGTH = 120
export const EMAIL_MAX_LENGTH = 320
/** The counter appears from here, so it never adds noise to a short message. */
export const MESSAGE_COUNTER_FROM = 1500

/** One field's verdict, with the server's rules (and the form's message cap). */
export function contactFieldError(field: ContactField, values: ContactValues): ContactFieldError | null {
  const value = values[field].trim()
  if (!value) return 'required'
  switch (field) {
    case 'name':
      return contactNameSchema.safeParse(value).success ? null : value.length < 2 ? 'tooShort' : 'tooLong'
    case 'email':
      return contactEmailSchema.safeParse(value).success ? null : 'invalid'
    case 'message':
      if (value.length > MESSAGE_MAX_LENGTH) return 'tooLong'
      return contactBodySchema.safeParse(value).success ? null : 'tooShort'
  }
}

/** The required fields that don't pass yet, in page order. */
export function invalidContactFields(values: ContactValues): ContactField[] {
  return CONTACT_FIELDS.filter((field) => contactFieldError(field, values) !== null)
}

export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === 'string' && (CONTACT_TOPICS as readonly string[]).includes(value)
}

// ── The letter (3D model) ─────────────────────────────────────────────────────

export type ContactPhase = 'editing' | 'sending' | 'sent' | 'failed'

/** Lines on the letter, and how many characters fill one. */
export const LETTER_LINES = 7
export const LETTER_LINE_CHARS = 36
/** Letters of the name that shape the signature. */
export const SIGNATURE_LETTERS = 14
/** Characters after which the reply-to line is drawn at full length. */
const REPLY_FULL_AT = 24

/** What the 3D letter shows. Every part of it mirrors something in the form. */
export interface LetterSceneState {
  phase: ContactPhase
  /** The stamp in the corner. */
  topic: ContactTopic | null
  /** Width of each written line, 0..1 of the text column, at most LETTER_LINES. */
  lines: number[]
  /** Character codes that shape the signature (the name, as typed). */
  signature: number[]
  /** The reply-to line's length, 0..1 (the email, as typed). */
  reply: number
  replyValid: boolean
  /** Every required field passes: the crease lines show, ready to fold. */
  ready: boolean
}

/**
 * The message as lines on the letter: its own line breaks start a new line, and
 * a long paragraph wraps every `lineChars` characters. Wordless on purpose: the
 * letter shows how much is written, never what.
 */
export function letterLines(message: string, lineChars = LETTER_LINE_CHARS, maxLines = LETTER_LINES): number[] {
  const lines: number[] = []
  const paragraphs = message.replace(/\r\n?/g, '\n').trimEnd().split('\n')
  if (paragraphs.length === 1 && paragraphs[0].trim() === '') return lines
  for (const paragraph of paragraphs) {
    let length = paragraph.trim().length
    // An empty line between paragraphs stays a gap; it is not drawn.
    if (length === 0) {
      lines.push(0)
    }
    while (length > 0) {
      lines.push(Math.min(1, length / lineChars))
      length -= lineChars
    }
    if (lines.length >= maxLines) break
  }
  return lines.slice(0, maxLines)
}

/** The first letters of the name, as character codes: same name, same signature. */
export function signatureCodes(name: string): number[] {
  return Array.from(name.trim().replace(/\s+/g, ' '))
    .slice(0, SIGNATURE_LETTERS)
    .map((letter) => letter.codePointAt(0) ?? 0)
}

export function letterSceneState(values: ContactValues, phase: ContactPhase): LetterSceneState {
  const email = values.email.trim()
  return {
    phase,
    topic: values.topic || null,
    lines: letterLines(values.message),
    signature: signatureCodes(values.name),
    reply: Math.min(1, email.length / REPLY_FULL_AT),
    replyValid: contactFieldError('email', values) === null,
    ready: invalidContactFields(values).length === 0,
  }
}

/** The signature as points (x right, y down), from its codes: loops, humps and dips, then a flourish. */
export function signaturePoints(codes: readonly number[]): { x: number; y: number }[] {
  if (codes.length === 0) return []
  const points = [{ x: 0, y: 0.15 }]
  let x = 0
  codes.forEach((code, index) => {
    const advance = 0.55 + ((code * 7) % 5) * 0.11
    const height = (0.5 + ((code * 13) % 7) * 0.09) * (index === 0 ? 1.55 : 1)
    const kind = code % 3
    if (code === 32) {
      // A space: a short lift of the pen, drawn as a low connector.
      points.push({ x: x + advance * 0.5, y: 0.25 })
    } else if (kind === 0) {
      // A loop, like an l.
      points.push({ x: x + advance * 0.55, y: -height }, { x: x + advance * 0.2, y: -height * 0.55 }, { x: x + advance * 0.75, y: 0.12 })
    } else if (kind === 1) {
      // A hump, like an n.
      points.push({ x: x + advance * 0.3, y: -height * 0.6 }, { x: x + advance * 0.7, y: -height * 0.55 }, { x: x + advance * 0.9, y: 0.1 })
    } else {
      // A dip, like a u.
      points.push({ x: x + advance * 0.25, y: 0.2 }, { x: x + advance * 0.6, y: -height * 0.45 }, { x: x + advance * 0.85, y: 0.15 })
    }
    x += advance
  })
  // The underline flourish, back under the name.
  points.push({ x: x + 0.45, y: 0.32 }, { x: x * 0.55, y: 0.5 }, { x: -0.15, y: 0.42 })
  return points
}

// ── Draft ──────────────────────────────────────────────────────────────────────

/** Keeps an unsent message for this visit (sessionStorage), across pages. */
export const CONTACT_DRAFT_KEY = 'contact-draft'

/** The draft to keep, or null when there is nothing worth keeping. */
export function serializeContactDraft(values: ContactValues): string | null {
  if (!values.name.trim() && !values.email.trim() && !values.message.trim()) return null
  return JSON.stringify(values)
}

/** A stored draft, if it is one: anything else (old shape, tampering) is ignored. */
export function parseContactDraft(raw: string | null): ContactValues | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const text = (key: string, max: number) => (typeof record[key] === 'string' ? (record[key] as string).slice(0, max) : '')
  const values: ContactValues = {
    topic: isContactTopic(record.topic) ? record.topic : '',
    name: text('name', NAME_MAX_LENGTH),
    email: text('email', EMAIL_MAX_LENGTH),
    message: text('message', MESSAGE_MAX_LENGTH),
  }
  return serializeContactDraft(values) ? values : null
}
