import { describe, it, expect } from 'vitest'
import { CONTACT_TOPIC_SUBJECTS, contactMessageSchema, messageStatusSchema } from './schema'

const valid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  message: 'Hello, I would like to discuss a project with you.',
}

describe('contactMessageSchema', () => {
  it('accepts a valid message and normalizes an empty subject to null', () => {
    const result = contactMessageSchema.safeParse({ ...valid, subject: '   ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.subject).toBeNull()
  })

  it('rejects an invalid email', () => {
    expect(contactMessageSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
  })

  it('rejects a too-short message', () => {
    expect(contactMessageSchema.safeParse({ ...valid, message: 'hi' }).success).toBe(false)
  })

  it('rejects a missing name', () => {
    expect(contactMessageSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('turns a topic into the subject, and keeps the topic itself out of the stored values', () => {
    const result = contactMessageSchema.safeParse({ ...valid, topic: 'job' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subject).toBe(CONTACT_TOPIC_SUBJECTS.job)
      expect(result.data).not.toHaveProperty('topic')
    }
  })

  it('prefers an explicit subject over the topic', () => {
    const result = contactMessageSchema.safeParse({ ...valid, topic: 'other', subject: 'Speaking invite' })
    expect(result.success && result.data.subject).toBe('Speaking invite')
  })

  it('rejects an unknown topic', () => {
    expect(contactMessageSchema.safeParse({ ...valid, topic: 'spam' }).success).toBe(false)
  })
})

describe('messageStatusSchema', () => {
  it('accepts known statuses', () => {
    expect(messageStatusSchema.safeParse('replied').success).toBe(true)
  })

  it('rejects unknown statuses', () => {
    expect(messageStatusSchema.safeParse('deleted').success).toBe(false)
  })
})
