import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

/**
 * Browser Supabase client — use in Client Components only.
 * Uses the public anon key and is safe to expose to the browser.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
