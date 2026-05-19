import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { runHtsAgent } from '@/lib/agent/validate'
import { jobRepository } from '@/lib/db/jobs'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { query?: string; job_id?: string; row_index?: number }
  const query = body.query?.trim()
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

  const scopeId = orgId ?? userId

  try {
    const result = await runHtsAgent(query)

    const isSingleLookup = !body.job_id
    let jobId = body.job_id ?? null

    if (isSingleLookup) {
      jobId = await jobRepository.createJob({
        orgId:       scopeId,
        userId,
        type:        'single',
        status:      'complete',
        inputQuery:  query,
      })
    }

    if (jobId) {
      await jobRepository.createValidationResult({
        jobId,
        inputText:        query,
        htsCode:          result.hts_code    || null,
        htsDescription:   result.hts_description || null,
        confidenceScore:  result.confidence_score,
        sourceUrl:        result.source_url  || null,
        rawResponse:      result,
        rowIndex:         body.row_index     ?? null,
      })
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
