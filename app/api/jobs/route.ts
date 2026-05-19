import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { file_name, row_count } = await req.json() as {
    file_name: string
    row_count: number
  }

  const scopeId = orgId ?? userId
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('validation_jobs')
    .insert({
      org_id: scopeId,
      user_id: userId,
      type: 'batch',
      status: 'processing',
      file_name,
      row_count,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeId = orgId ?? userId
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('validation_jobs')
    .select('id, type, status, file_name, row_count, rows_done, input_query, created_at')
    .eq('org_id', scopeId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}
