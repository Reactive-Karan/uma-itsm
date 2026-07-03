import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

/**
 * Server Supabase client — use in Server Components, Route Handlers, and Server Actions.
 * Reads and writes session cookies server-side.
 * Never expose the service role key from this client — use the anon key here.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component read-only context — session refresh handled by middleware
          }
        },
      },
    },
  )
}

/**
 * Service role client — bypasses RLS entirely. Use ONLY for admin operations
 * in server-side Route Handlers (e.g. user provisioning, cron jobs, audit writes).
 *
 * Uses @supabase/supabase-js createClient directly (NOT createServerClient)
 * so that cookie-based user JWTs cannot interfere with the service role context.
 * Without this separation the user's session JWT can override the service role
 * key and cause "row-level security policy" errors on admin INSERT/UPDATE calls.
 *
 * NEVER import this in Client Components or expose it to the browser.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
