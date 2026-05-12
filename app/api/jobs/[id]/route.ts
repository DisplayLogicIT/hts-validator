import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const scopeId = orgId ?? userId
  const supabase = createSupabaseAdminClient()

  const { data: job } = await supabase
    .from('validation_jobs')
    .select('org_id')
    .eq('id', id)
    .single()

  if (!job || job.org_id !== scopeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { status?: string; rows_done?: number }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.rows_done !== undefined) updates.rows_done = body.rows_done

  const { error } = await supabase
    .from('validation_jobs')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
