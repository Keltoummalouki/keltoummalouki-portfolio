import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getSupabaseAnonKey, getSupabaseUrl } from './env'

// Cookie-less Supabase client for PUBLIC reads (published content only).
//
// It never reads the request's cookies, so pages built on it can be cached and
// shared between visitors (ISR) instead of rendering on every request. Queries
// run as the anonymous role: RLS only exposes published rows, and public
// queries also filter on `status = 'published'` explicitly. Never use it for
// admin reads or any write; those go through `server.ts` (the user's session).
export function createPublicSupabaseClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
