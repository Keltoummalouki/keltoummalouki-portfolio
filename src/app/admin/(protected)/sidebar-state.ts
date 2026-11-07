// Desktop sidebar fold state (expanded sidebar vs. icon rail). It lives in a
// cookie rather than localStorage so the protected layout can render the right
// width on the server, with no flash of the wrong state on reload. Admin pages
// are rendered per request anyway, and Path=/admin keeps the cookie off the
// public site.
export const SIDEBAR_COOKIE = 'admin-sidebar'

const ONE_YEAR = 60 * 60 * 24 * 365

export function isSidebarCollapsed(value: string | undefined): boolean {
  return value === 'collapsed'
}

export function sidebarCookie(collapsed: boolean, secure: boolean): string {
  const value = collapsed ? 'collapsed' : 'expanded'
  return `${SIDEBAR_COOKIE}=${value}; Path=/admin; Max-Age=${ONE_YEAR}; SameSite=Lax${secure ? '; Secure' : ''}`
}
