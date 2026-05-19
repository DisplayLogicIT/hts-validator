import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createAnthropicClient, MODELS } from '@/lib/llm'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scopeId = orgId ?? userId

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const { data: part, error: fetchError } = await supabase
    .from('parts')
    .select('id, part_number, description, hts_code, validation_status, org_id')
    .eq('id', id)
    .eq('org_id', scopeId)
    .single()

  if (fetchError || !part) {
    return NextResponse.json({ error: 'Part not found' }, { status: 404 })
  }

  await supabase.from('parts').update({ lookup_status: 'running' }).eq('id', part.id)

  try {
    const client = createAnthropicClient()
    const msg = await client.messages.create({
      model: MODELS.fastLookup,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are a US customs and import classification expert specializing in the Harmonized Tariff Schedule (HTS/HTSUS).

A validation system looked up this part in the USITC schedule but could not find a match:

Part Number: ${part.part_number || '(none)'}
Part Description: ${part.description || '(none)'}
HTS Code Attempted: ${part.hts_code}

Please:
1. Determine if the HTS code is formatted incorrectly, or if it is likely the wrong code
2. Suggest the most likely correct 10-digit HTSUS code for this part
3. Provide the applicable general duty rate
4. Give a concise explanation of your reasoning

Respond ONLY with this exact JSON structure, no other text:
{
  "suggested_hts": "XXXX.XX.XXXX",
  "duty_rate": "Free",
  "confidence": "high",
  "reasoning": "Brief explanation of why the original code failed and how you determined the correct classification."
}`,
        },
      ],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    let result: { suggested_hts: string; duty_rate: string; confidence: string; reasoning: string }
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      result = JSON.parse(match?.[0] ?? raw)
    } catch {
      result = { suggested_hts: '', duty_rate: '', confidence: 'low', reasoning: raw }
    }

    await supabase
      .from('parts')
      .update({ lookup_status: 'complete', lookup_result: result })
      .eq('id', part.id)

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    await supabase.from('parts').update({ lookup_status: 'error' }).eq('id', part.id)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 },
    )
  }
}
