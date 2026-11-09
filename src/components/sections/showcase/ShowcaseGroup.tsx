import type { ReactNode } from 'react'

/**
 * Shared rhythm for the numbered sections (projects, reviews): one container,
 * with hairline dividers between rows.
 */
export default function ShowcaseGroup({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background">
      <div className="container-main divide-y divide-border/70 py-6 md:py-10">{children}</div>
    </div>
  )
}
