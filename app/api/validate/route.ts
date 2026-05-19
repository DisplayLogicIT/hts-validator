import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { runHtsAgent } from '@/lib/agent/validate'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { query?: string; job_id?: string; row_index?: number }
  const query = body.query?.trim()
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const scopeId = orgId ?? userId

  try {
    const result = await runHtsAgent(query)
    const supabase = createSupabaseAdminClient()

    const isSingleLookup = !body.job_id
    const validationStatus = result.confidence_score >= 0.5 ? 'valid' : 'not_found'
    let jobId = body.job_id ?? null

    // Only create a new job for single lookups (no job_id provided)
    if (isSingleLookup) {
      const { data: job, error: jobError } = await supabase
        .from('validation_jobs')
        .insert({
          org_id: scopeId,
          user_id: userId,
          type: 'single',
          status: 'complete',
          input_query: query,
          valid_count: validationStatus === 'valid' ? 1 : 0,
          not_found_count: validationStatus === 'not_found' ? 1 : 0,
        })
        .select('id')
        .single()

      if (jobError) {
        console.error('Failed to insert validation_job:', jobError.message)
      }
      jobId = job?.id ?? null
    }

    if (jobId) {
      const { error: resultError } = await supabase.from('validation_results').insert({
        job_id: jobId,
        input_text: query,
        hts_code: result.hts_code,
        hts_description: result.hts_description,
        confidence_score: result.confidence_score,
        source_url: result.source_url,
        raw_response: result,
        row_index: body.row_index ?? null,
      })
      if (resultError) console.error('Failed to insert validation_result:', resultError.message)

      const now = new Date().toISOString()
      const { error: partError } = await supabase.from('parts').insert({
        org_id: scopeId,
        part_number: query,
        description: query,
        hts_code: result.hts_code || query,
        validation_status: validationStatus,
        usitc_description: result.hts_description || null,
        duty_rate: result.duty_rate,
        job_id: jobId,
        last_validated_at: now,
        updated_at: now,
      })
      if (partError) console.error('Failed to insert part:', partError.message)
    }

    return NextResponse.json({ ...result, job_id: jobId })
  } catch (err) {
    console.error('Validation error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Validation failed' },
      { status: 500 },
    )
  }
}
