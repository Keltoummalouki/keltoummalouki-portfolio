'use client'

import { ArrowUp } from 'lucide-react'
import { pillOutline } from '@/components/sections/showcase/classes'
import { PACKAGE_EVENT, type PackageEventDetail } from '@/features/freelance/brief'
import { trackClick } from '@/lib/analytics/events'

/** Goes to the form and adds the package to the request. A plain link without JavaScript. */
export default function PackageCta({ title, label }: { title: string; label: string }) {
  const choose = () => {
    window.dispatchEvent(new CustomEvent<PackageEventDetail>(PACKAGE_EVENT, { detail: { title } }))
  }
  return (
    <a href="#request" onClick={choose} className={`${pillOutline} shrink-0`} {...trackClick('contact-cta', { from: 'freelance-package' })}>
      {label}
      <ArrowUp aria-hidden="true" className="size-4" />
    </a>
  )
}
