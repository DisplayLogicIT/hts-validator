import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

const COLS = 'id, job_id, input_text, hts_code, hts_description, confidence_score, source_url, raw_response, created_at'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') ?? 'valid'
  const scopeId = orgId ?? userId
  const supabase = createSupabaseAdminClient()

  const { data: jobs, error: jobsError } = await supabase
    .from('validation_jobs')
    .select('id, file_name, input_query, type, created_at')
    .eq('org_id', scopeId)
    .order('created_at', { ascending: false })

  if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 })
  if (!jobs?.length) return NextResponse.json({ jobs: [] })

  const jobIds = jobs.map((j) => j.id)

  const { data: results, error: resultsError } = status === 'valid'
    ? await supabase.from('validation_results').select(COLS).in('job_id', jobIds).not('hts_code', 'is', null)
    : await supabase.from('validation_results').select(COLS).in('job_id', jobIds).is('hts_code', null)

  if (resultsError) return NextResponse.json({ error: resultsError.message }, { status: 500 })

  const byJob = new Map<string, typeof results>()
  for (const r of results ?? []) {
    if (!byJob.has(r.job_id)) byJob.set(r.job_id, [])
    byJob.get(r.job_id)!.push(r)
  }

  const out = jobs
    .filter((j) => (byJob.get(j.id)?.length ?? 0) > 0)
    .map((j) => ({ ...j, results: byJob.get(j.id) ?? [] }))

  return NextResponse.json({ jobs: out })
}
