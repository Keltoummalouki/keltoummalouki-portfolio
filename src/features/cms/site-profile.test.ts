import { describe, expect, it } from 'vitest'
import { readSiteProfile } from './site-profile'

describe('readSiteProfile', () => {
  it('reads the booking link', () => {
    expect(readSiteProfile({ bookingUrl: 'https://cal.com/keltoum/30min' }).bookingUrl).toBe('https://cal.com/keltoum/30min')
  })

  it('never returns a booking link that is not https', () => {
    expect(readSiteProfile({ bookingUrl: 'javascript:alert(1)' }).bookingUrl).toBe('')
    expect(readSiteProfile({ bookingUrl: 'http://cal.com/keltoum' }).bookingUrl).toBe('')
    expect(readSiteProfile({ bookingUrl: null }).bookingUrl).toBe('')
    expect(readSiteProfile(null).bookingUrl).toBe('')
  })
})
