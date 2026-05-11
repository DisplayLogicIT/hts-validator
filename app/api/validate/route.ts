import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { runHtsAgent } from '@/lib/agent/validate'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { query?: string }
  const query = body.query?.trim()
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  // Teams model: key on org when present, fall back to user
  const scopeId = orgId ?? userId

  try {
    const result = await runHtsAgent(query)

    // Persist to Supabase using admin client (bypasses RLS for PR 2)
    const supabase = createSupabaseAdminClient()

    const { data: job, error: jobError } = await supabase
      .from('validation_jobs')
      .insert({ org_id: scopeId, user_id: userId, type: 'single', status: 'complete', input_query: query })
      .select('id')
      .single()

    if (jobError) {
      // Log but don't fail the request — the result is still useful to the user
      console.error('Failed to insert validation_job:', jobError.message)
    }

    if (job?.id) {
      const { error: resultError } = await supabase.from('validation_results').insert({
        job_id: job.id,
        input_text: query,
        hts_code: result.hts_code,
        hts_description: result.hts_description,
        confidence_score: result.confidence_score,
        source_url: result.source_url,
        raw_response: result,
      })
      if (resultError) console.error('Failed to insert validation_result:', resultError.message)
    }

    return NextResponse.json({ ...result, job_id: job?.id ?? null })
  } catch (err) {
    console.error('Validation error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Validation failed' },
      { status: 500 },
    )
  }
}
