import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'
import { searchHts } from '@/lib/hts/usitc'

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

    // Extract the original CSV description stored at save time
    const description = (result.raw_response?.csv_desc ?? result.raw_response?.description) as string | undefined
    if (!description || description.trim().length < 4) {
      return NextResponse.json({ valid: false, reason: 'no_description' })
    }

    // Search USITC by description — if it's there, it will match
    const candidates = await searchHts(description.trim())
    if (!candidates.length) {
      return NextResponse.json({ valid: false, reason: 'no_match' })
    }

    const best = candidates[0]
    await jobRepository.patchValidationResult(id, {
      hts_code:         best.hts_code,
      hts_description:  best.description,
      confidence_score: 1.0,
      source_url:       best.source_url,
    })

    return NextResponse.json({
      valid:       true,
      hts_code:    best.hts_code,
      description: best.description,
      duty_rate:   best.duty_rate,
      source_url:  best.source_url,
    })
  } catch (err) {
    console.error('POST /api/results/[id]/scan:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500 })
  }
}
