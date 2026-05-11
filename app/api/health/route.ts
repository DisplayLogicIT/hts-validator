import { NextResponse } from 'next/server'
import { pingSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await pingSupabase()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
