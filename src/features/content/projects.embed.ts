// Can a project's demo be shown in an <iframe> on this site? Mirrors what
// browsers enforce: an enforced CSP `frame-ancestors` directive wins over
// X-Frame-Options; DENY / SAMEORIGIN block other origins; ALLOW-FROM and
// unknown X-Frame-Options values are ignored. Pure, so it is unit-tested; the
// server check that fetches the headers lives in projects.queries.ts.

export interface FramingResponse {
  /** Final URL of the framed page (after redirects). */
  url: string
  xFrameOptions: string | null
  contentSecurityPolicy: string | null
}

interface Origin {
  origin: string
  scheme: string
  host: string
  /** '' for the scheme's default port (URL API convention). */
  port: string
}

function parseOrigin(value: string): Origin | null {
  try {
    const url = new URL(value)
    return { origin: url.origin, scheme: url.protocol.slice(0, -1), host: url.hostname, port: url.port }
  } catch {
    return null
  }
}

/** Source list of the policy's `frame-ancestors` directive, or null when it has none. */
function frameAncestors(policy: string): string[] | null {
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (name?.toLowerCase() === 'frame-ancestors') return sources
  }
  return null
}

function hostMatches(pattern: string, host: string): boolean {
  if (pattern === '*') return true
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1))
  return pattern === host
}

/** One frame-ancestors source against the parent page's origin. */
function sourceMatches(raw: string, parent: Origin, frameOrigin: string): boolean {
  const source = raw.toLowerCase()
  if (source === "'self'") return parent.origin === frameOrigin
  if (source === '*') return parent.scheme === 'https' || parent.scheme === 'http'
  // 'none' (and keywords that mean nothing for frame-ancestors) never match.
  if (source.startsWith("'")) return false
  const upgrades = (scheme: string) => scheme === parent.scheme || (scheme === 'http' && parent.scheme === 'https')
  const schemeOnly = /^([a-z][a-z0-9+.-]*):$/.exec(source)
  if (schemeOnly) return upgrades(schemeOnly[1])
  const hostSource = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/:]+)(?::(\d+|\*))?(?:\/.*)?$/.exec(source)
  if (!hostSource) return false
  const [, scheme, host, port] = hostSource
  if (scheme && !upgrades(scheme)) return false
  if (!hostMatches(host, parent.host)) return false
  if (port === '*') return true
  return port ? port === (parent.port || (parent.scheme === 'https' ? '443' : '80')) : parent.port === ''
}

/** Whether the page in `response` lets `parentOrigin` frame it. */
export function framingAllowed(response: FramingResponse, parentOrigin: string): boolean {
  const frame = parseOrigin(response.url)
  const parent = parseOrigin(parentOrigin)
  if (!frame || !parent) return false

  // Several CSP headers arrive comma-joined: every policy that sets
  // frame-ancestors must allow the parent.
  const policies = (response.contentSecurityPolicy ?? '')
    .split(',')
    .map(frameAncestors)
    .filter((sources): sources is string[] => sources !== null)
  if (policies.length > 0) {
    return policies.every((sources) => sources.some((source) => sourceMatches(source, parent, frame.origin)))
  }

  const options = (response.xFrameOptions ?? '').split(',').map((value) => value.trim().toLowerCase())
  if (options.includes('deny')) return false
  if (options.includes('sameorigin')) return frame.origin === parent.origin
  return true
}
