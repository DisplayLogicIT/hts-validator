import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const report: Record<string, unknown> = {}

  // 1. Env vars present?
  report.env = {
    NEXT_PUBLIC_SUPABASE_URL:    process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    SUPABASE_SERVICE_ROLE_KEY:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    CLERK_SECRET_KEY:            !!process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }

  // 2. Clerk auth
  try {
    const { userId, orgId } = await auth()
    report.auth = { ok: true, userId, orgId }
  } catch (e) {
    report.auth = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // 3. Supabase admin client + simple query
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('validation_jobs')
      .select('id')
      .limit(1)
    if (error) {
      report.supabase = { ok: false, error: JSON.stringify(error) }
    } else {
      report.supabase = { ok: true, rowCount: data?.length ?? 0 }
    }

    // Show actual columns so we can verify migrations
    let cols = null
    try {
      const { data } = await supabase
        .rpc('sql', { query: "SELECT column_name FROM information_schema.columns WHERE table_name='validation_jobs' AND table_schema='public' ORDER BY ordinal_position" })
      cols = data
    } catch {
      // rpc unavailable
    }
    report.columns = cols ?? 'rpc unavailable — check Supabase URL above'
  } catch (e) {
    report.supabase = { ok: false, error: e instanceof Error ? e.message : JSON.stringify(e) }
  }

  return NextResponse.json(report, { status: 200 })
}
