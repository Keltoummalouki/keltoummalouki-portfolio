import { describe, expect, it } from 'vitest'
import { SIDEBAR_COOKIE, isSidebarCollapsed, sidebarCookie } from './sidebar-state'

describe('isSidebarCollapsed', () => {
  it('is collapsed only for the exact stored value', () => {
    expect(isSidebarCollapsed('collapsed')).toBe(true)
    expect(isSidebarCollapsed('expanded')).toBe(false)
    expect(isSidebarCollapsed(undefined)).toBe(false)
    expect(isSidebarCollapsed('COLLAPSED')).toBe(false)
  })
})

describe('sidebarCookie', () => {
  it('scopes the preference to the dashboard for a year', () => {
    const cookie = sidebarCookie(true, false)
    expect(cookie.startsWith(`${SIDEBAR_COOKIE}=collapsed;`)).toBe(true)
    expect(cookie).toContain('Path=/admin')
    expect(cookie).toContain('Max-Age=31536000')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
  })

  it('round-trips through the parser and adds Secure over https', () => {
    const cookie = sidebarCookie(false, true)
    const value = cookie.split(';')[0].split('=')[1]
    expect(isSidebarCollapsed(value)).toBe(false)
    expect(cookie.endsWith('; Secure')).toBe(true)
  })
})
