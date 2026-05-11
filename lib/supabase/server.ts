import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client.
 *
 * Uses the anon key by default. For privileged operations (running migrations,
 * bypassing RLS), use `createSupabaseAdminClient()` below, which is gated on
 * SUPABASE_SERVICE_ROLE_KEY and must never be called from client code.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Admin (service-role) Supabase client. Bypasses RLS — server-only.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase admin env vars: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Lightweight health check used by /api/health and the dashboard.
 * Confirms env vars are set and the Supabase Auth endpoint is reachable.
 * We deliberately avoid table queries here — no schema exists yet.
 */
export async function pingSupabase(): Promise<
  { ok: true; supabase: 'reachable' } | { ok: false; error: string }
> {
  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.getSession()
    if (error) throw error
    return { ok: true, supabase: 'reachable' }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}
