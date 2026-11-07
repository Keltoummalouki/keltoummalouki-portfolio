import { z } from 'zod'

// Next.js runs this file in the browser before the app hydrates, so it is in
// place before any client component builds a Zod schema.
//
// Zod compiles object parsers with `new Function` when eval is allowed, and the
// check for that is itself an eval call. The production CSP forbids eval
// (next.config.ts), so that check would log a CSP violation on every page load.
// Browser-side validation only covers small forms, so turn the compiler off.
z.config({ jitless: true })
