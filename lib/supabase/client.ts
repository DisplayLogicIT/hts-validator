'use client'

import { createClient } from '@supabase/supabase-js'

/**
 * Browser-side Supabase client. Uses the public anon key only.
 * Never import the service-role key from client code.
 */
export function createSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
