import { describe, expect, it } from 'vitest'
import {
  EMPTY_CONTACT,
  LETTER_LINES,
  MESSAGE_MAX_LENGTH,
  contactFieldError,
  invalidContactFields,
  letterLines,
  letterSceneState,
  parseContactDraft,
  serializeContactDraft,
  signatureCodes,
  signaturePoints,
  type ContactValues,
} from './contact-form'
import { contactMessageSchema } from './schema'

const valid: ContactValues = {
  topic: 'job',
  name: 'Jane Doe',
  email: 'jane@example.com',
  message: 'Hello, I would like to talk about a role on our team.',
}

describe('contact form validation', () => {
  it('names each problem, so the field can say what to fix', () => {
    expect(contactFieldError('name', { ...valid, name: '  ' })).toBe('required')
    expect(contactFieldError('name', { ...valid, name: 'J' })).toBe('tooShort')
    expect(contactFieldError('email', { ...valid, email: 'jane@' })).toBe('invalid')
    expect(contactFieldError('message', { ...valid, message: 'Hi there' })).toBe('tooShort')
    expect(contactFieldError('message', { ...valid, message: 'x'.repeat(MESSAGE_MAX_LENGTH + 1) })).toBe('tooLong')
    expect(contactFieldError('email', valid)).toBeNull()
  })

  it('lists the invalid fields in page order', () => {
    expect(invalidContactFields(EMPTY_CONTACT)).toEqual(['name', 'email', 'message'])
    expect(invalidContactFields({ ...valid, email: 'nope' })).toEqual(['email'])
    expect(invalidContactFields(valid)).toEqual([])
  })

  it('agrees with the server on every value it accepts', () => {
    const samples: ContactValues[] = [
      valid,
      { ...valid, name: ' Al ' },
      { ...valid, email: 'a.b+c@sub.example.org' },
      { ...valid, message: '0123456789' },
      { ...valid, topic: '' },
    ]
    for (const values of samples) {
      const server = contactMessageSchema.safeParse({ ...values, topic: values.topic || undefined }).success
      expect(invalidContactFields(values).length === 0).toBe(server)
    }
  })
})

describe('the letter', () => {
  it('writes one line per stretch of message, wordless, and keeps paragraph breaks', () => {
    expect(letterLines('')).toEqual([])
    expect(letterLines('   \n  ')).toEqual([])
    expect(letterLines('x'.repeat(18), 36)).toEqual([0.5])
    expect(letterLines('x'.repeat(72), 36)).toEqual([1, 1])
    expect(letterLines('Hello\n\nBye', 10)).toEqual([0.5, 0, 0.3])
  })

  it('never writes more lines than the page holds', () => {
    expect(letterLines('x'.repeat(MESSAGE_MAX_LENGTH))).toHaveLength(LETTER_LINES)
    expect(letterLines('a\n'.repeat(40))).toHaveLength(LETTER_LINES)
  })

  it('signs with the name as typed, up to a limit', () => {
    expect(signatureCodes('  Jane   Doe ')).toEqual(Array.from('Jane Doe').map((c) => c.codePointAt(0)))
    expect(signatureCodes('x'.repeat(40))).toHaveLength(14)
  })

  it('draws the same signature for the same name, and a longer one for a longer name', () => {
    const jane = signaturePoints(signatureCodes('Jane'))
    expect(signaturePoints(signatureCodes('Jane'))).toEqual(jane)
    const width = (points: { x: number }[]) => Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
    expect(width(signaturePoints(signatureCodes('Jane Doe')))).toBeGreaterThan(width(jane))
    expect(signaturePoints([])).toEqual([])
  })

  it('maps the form to the letter', () => {
    const empty = letterSceneState(EMPTY_CONTACT, 'editing')
    expect(empty).toMatchObject({ topic: null, lines: [], signature: [], reply: 0, replyValid: false, ready: false })

    const typing = letterSceneState({ ...EMPTY_CONTACT, email: 'jane@exa' }, 'editing')
    expect(typing.reply).toBeGreaterThan(0)
    expect(typing.replyValid).toBe(false)

    const done = letterSceneState(valid, 'sending')
    expect(done).toMatchObject({ phase: 'sending', topic: 'job', replyValid: true, ready: true })
    expect(done.lines.length).toBeGreaterThan(0)
  })
})

describe('the draft', () => {
  it('keeps something worth keeping, and nothing else', () => {
    expect(serializeContactDraft(EMPTY_CONTACT)).toBeNull()
    expect(serializeContactDraft({ ...EMPTY_CONTACT, topic: 'job' })).toBeNull()
    expect(parseContactDraft(serializeContactDraft(valid))).toEqual(valid)
  })

  it('ignores anything that is not a draft', () => {
    expect(parseContactDraft(null)).toBeNull()
    expect(parseContactDraft('not json')).toBeNull()
    expect(parseContactDraft('[1,2]')).toBeNull()
    expect(parseContactDraft(JSON.stringify({ name: 42 }))).toBeNull()
  })

  it('cleans what it restores', () => {
    const raw = JSON.stringify({ topic: 'spam', name: 'Jane', email: 1, message: 'x'.repeat(MESSAGE_MAX_LENGTH + 50) })
    expect(parseContactDraft(raw)).toEqual({
      topic: '',
      name: 'Jane',
      email: '',
      message: 'x'.repeat(MESSAGE_MAX_LENGTH),
    })
  })
})
