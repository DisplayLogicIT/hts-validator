import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { lookupHtsCode } from '@/lib/hts/usitc'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { hts_code?: string; job_id?: string; row_index?: number }
  const htsCode = body.hts_code?.trim()
  if (!htsCode) return NextResponse.json({ error: 'hts_code is required' }, { status: 400 })

  try {
    const result = await lookupHtsCode(htsCode)

    if (body.job_id) {
      const supabase = createSupabaseAdminClient()
      const { error } = await supabase.from('validation_results').insert({
        job_id: body.job_id,
        input_text: htsCode,
        hts_code: result.valid ? result.hts_code : null,
        hts_description: result.description,
        confidence_score: result.valid ? 1.0 : 0.0,
        source_url: result.source_url,
        raw_response: result,
        row_index: body.row_index ?? null,
      })
      if (error) console.error('Failed to insert validation_result:', error.message)
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
