import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import type { Locale } from '@/lib/validation/locale'
import { mapPublicServices, type PublicService, type ServiceRow } from './services'

// Explicit columns: until the packages migration is applied, both queries fail
// loudly (the admin sees why, the freelance page hides the section) instead of
// listing packages without their prices.
const SERVICE_COLUMNS =
  'id, slug, status, sort_order, icon, title, description, includes, price_from, created_at, updated_at'

/** Published packages for the freelance page ([] on any failure: the section is hidden). */
export async function getPublishedServices(locale: Locale): Promise<PublicService[]> {
  try {
    const supabase = createPublicSupabaseClient()
    const { data, error } = await supabase
      .from('services')
      .select(SERVICE_COLUMNS)
      .eq('status', 'published')
      .order('sort_order')
    // PostgREST errors are plain objects, not Error instances: wrap so the log shows the message.
    if (error) throw new Error(error.message)
    return mapPublicServices(data ?? [], locale)
  } catch (error) {
    console.error('services: loading published packages failed:', error instanceof Error ? error.message : error)
    return []
  }
}

/** Every package for the admin editor (admin RLS context). */
export async function getAdminServices(): Promise<{ items: ServiceRow[]; error: string | null }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('services').select(SERVICE_COLUMNS).order('sort_order')
  return { items: data ?? [], error: error ? error.message : null }
}
