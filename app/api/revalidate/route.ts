import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { lookupHtsCode } from '@/lib/hts/usitc'

export const dynamic = 'force-dynamic'

const CONCURRENCY = 10

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('parts')
    .select('id, hts_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const parts = data ?? []
  if (parts.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  let nextIdx = 0
  let updated = 0

  async function worker() {
    while (nextIdx < parts.length) {
      const part = parts[nextIdx++]
      try {
        const result = await lookupHtsCode(part.hts_code)
        const now = new Date().toISOString()
        await supabase
          .from('parts')
          .update({
            validation_status: result.valid ? 'valid' : 'not_found',
            usitc_description: result.description || null,
            duty_rate: result.duty_rate || null,
            last_validated_at: now,
            updated_at: now,
          })
          .eq('id', part.id)
        updated++
      } catch {
        // skip on transient error — will retry on next scheduled run
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, parts.length) }, worker))
  return NextResponse.json({ ok: true, updated })
}
