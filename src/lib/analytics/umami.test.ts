import { describe, expect, it } from 'vitest'
import { readUmamiConfig, trackedHostnames } from './umami'

const WEBSITE_ID = '94db1cb1-74f4-4a40-ad6c-962362670409'

describe('readUmamiConfig', () => {
  it('stays off without a website ID', () => {
    expect(readUmamiConfig({})).toBeNull()
    expect(readUmamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: '  ' })).toBeNull()
  })

  it('defaults to Umami Cloud, which collects on its gateway', () => {
    expect(readUmamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: ` ${WEBSITE_ID} ` })).toEqual({
      websiteId: WEBSITE_ID,
      scriptUrl: 'https://cloud.umami.is/script.js',
      scriptOrigin: 'https://cloud.umami.is',
      collectOrigin: 'https://gateway.umami.is',
    })
  })

  it('serves and collects from a self-hosted instance', () => {
    expect(
      readUmamiConfig({
        NEXT_PUBLIC_UMAMI_WEBSITE_ID: WEBSITE_ID,
        NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'https://stats.example.com/script.js',
      }),
    ).toMatchObject({ scriptOrigin: 'https://stats.example.com', collectOrigin: 'https://stats.example.com' })
  })

  it('refuses a script URL that is not https', () => {
    expect(readUmamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: WEBSITE_ID, NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'http://stats.example.com/script.js' })).toBeNull()
    expect(readUmamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: WEBSITE_ID, NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'not a url' })).toBeNull()
  })
})

describe('trackedHostnames', () => {
  it('lists the site hostname with and without www', () => {
    expect(trackedHostnames('https://www.keltoummalouki.com')).toBe('www.keltoummalouki.com,keltoummalouki.com')
    expect(trackedHostnames('https://keltoummalouki.com')).toBe('keltoummalouki.com')
  })
})
