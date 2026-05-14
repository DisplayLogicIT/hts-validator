import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scopeId = orgId ?? userId

  const statusParam = req.nextUrl.searchParams.get('status')
  const view = req.nextUrl.searchParams.get('view')
  const supabase = createSupabaseAdminClient()

  if (view === 'jobs') {
    const statuses = statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null

    const { data: jobs, error: jobsError } = await supabase
      .from('validation_jobs')
      .select('id, file_name, input_query, type, created_at, valid_count, not_found_count, row_count, status')
      .eq('org_id', scopeId)
      .order('created_at', { ascending: false })

    if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 })
    if (!jobs?.length) return NextResponse.json({ jobs: [] })

    const jobIds = jobs.map((j) => j.id)

    let partsQuery = supabase
      .from('parts')
      .select('id, part_number, description, hts_code, validation_status, usitc_description, duty_rate, last_validated_at, job_id, lookup_status, lookup_result')
      .eq('org_id', scopeId)
      .in('job_id', jobIds)
      .order('created_at', { ascending: true })

    if (statuses?.length) {
      if (statuses.length === 1) {
        partsQuery = partsQuery.eq('validation_status', statuses[0])
      } else {
        partsQuery = partsQuery.in('validation_status', statuses)
      }
    }

    const { data: parts, error: partsError } = await partsQuery
    if (partsError) return NextResponse.json({ error: partsError.message }, { status: 500 })

    const partsByJob = new Map<string, typeof parts>()
    for (const part of parts ?? []) {
      if (!part.job_id) continue
      const arr = partsByJob.get(part.job_id) ?? []
      arr.push(part)
      partsByJob.set(part.job_id, arr)
    }

    const result = jobs
      .map((job) => ({ ...job, parts: partsByJob.get(job.id) ?? [] }))
      .filter((job) => job.parts.length > 0)

    return NextResponse.json({ jobs: result })
  }

  // Flat list (existing behavior)
  let query = supabase
    .from('parts')
    .select('id, part_number, description, hts_code, validation_status, usitc_description, duty_rate, last_validated_at, updated_at')
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
  description?: string
  hts_code: string
  validation_status: 'valid' | 'not_found' | 'error'
  usitc_description?: string
  duty_rate?: string | null
  job_id?: string
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
    description: p.description ?? null,
    hts_code: p.hts_code,
    validation_status: p.validation_status,
    usitc_description: p.usitc_description ?? null,
    duty_rate: p.duty_rate ?? null,
    job_id: p.job_id ?? null,
    last_validated_at: now,
    updated_at: now,
  }))

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('parts').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
