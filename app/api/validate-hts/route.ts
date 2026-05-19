import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { lookupHtsCode } from '@/lib/hts/usitc'
import { jobRepository } from '@/lib/db/jobs'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { hts_code?: string; job_id?: string; row_index?: number }
    const htsCode = body.hts_code?.trim()
    if (!htsCode) return NextResponse.json({ error: 'hts_code is required' }, { status: 400 })

    const result = await lookupHtsCode(htsCode)

    if (body.job_id) {
      await jobRepository.createValidationResult({
        jobId:            body.job_id,
        inputText:        htsCode,
        htsCode:          result.valid ? result.hts_code : null,
        htsDescription:   result.description  || null,
        confidenceScore:  result.valid ? 1.0 : 0.0,
        sourceUrl:        result.source_url   || null,
        rawResponse:      result,
        rowIndex:         body.row_index      ?? null,
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('HTS lookup error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 },
    )
  }
}
