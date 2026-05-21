import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'
import { lookupHtsCode } from '@/lib/hts/usitc'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const scopeId = orgId ?? userId

    const result = await jobRepository.getValidationResult(id)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.org_id !== scopeId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const lookup = await lookupHtsCode(result.input_text)

    if (lookup.valid) {
      await jobRepository.patchValidationResult(id, {
        hts_code:         lookup.hts_code,
        hts_description:  lookup.description,
        confidence_score: 1.0,
        source_url:       lookup.source_url,
      })
    }

    return NextResponse.json({
      valid:       lookup.valid,
      hts_code:    lookup.hts_code,
      description: lookup.description,
      duty_rate:   lookup.duty_rate,
      source_url:  lookup.source_url,
    })
  } catch (err) {
    console.error('POST /api/results/[id]/scan:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500 })
  }
}
