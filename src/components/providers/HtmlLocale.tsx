'use client'

import { useEffect } from 'react'

/**
 * Keeps <html lang/dir> in step with the locale after client-side language
 * switches. The root layout sets both on the server, but it is not re-rendered
 * when the [locale] segment changes, so without this an in-app switch to Arabic
 * would stay `dir="ltr"` (and screen readers would keep the old language)
 * until a full reload.
 */
export default function HtmlLocale({ locale, dir }: { locale: string; dir: 'ltr' | 'rtl' }) {
  useEffect(() => {
    const html = document.documentElement
    html.lang = locale
    html.dir = dir
  }, [locale, dir])

  return null
}
