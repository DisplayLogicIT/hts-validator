import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scopeId = orgId ?? userId

  const statusParam = req.nextUrl.searchParams.get('status')
  const supabase = createSupabaseAdminClient()
  let query = supabase
    .from('parts')
    .select('id, part_number, hts_code, validation_status, usitc_description, duty_rate, last_validated_at, updated_at')
    .eq('org_id', scopeId)
    .order('updated_at', { ascending: false })

  if (statusParam) {
    const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (statuses.length === 1) {
      query = query.eq('validation_status', statuses[0])
    } else {
      query = query.in('validation_status', statuses)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ parts: data ?? [] })
}

interface PartInput {
  part_number?: string
  hts_code: string
  validation_status: 'valid' | 'not_found' | 'error'
  usitc_description?: string
  duty_rate?: string | null
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scopeId = orgId ?? userId

  const body = (await req.json()) as { parts: PartInput[] }
  if (!Array.isArray(body.parts) || body.parts.length === 0) {
    return NextResponse.json({ error: 'parts array required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const rows = body.parts.map((p) => ({
    org_id: scopeId,
    part_number: p.part_number || p.hts_code,
    hts_code: p.hts_code,
    validation_status: p.validation_status,
    usitc_description: p.usitc_description ?? null,
    duty_rate: p.duty_rate ?? null,
    last_validated_at: now,
    updated_at: now,
  }))

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('parts').upsert(rows, { onConflict: 'org_id,hts_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
