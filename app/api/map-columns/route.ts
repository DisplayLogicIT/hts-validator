import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { headers, sample } = await req.json() as {
      headers: string[]
      sample: Record<string, string>[]
    }

    if (!Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json({ error: 'headers required' }, { status: 400 })
    }

    const prompt = `You are analyzing a spreadsheet for an HTS (Harmonized Tariff Schedule) validation tool.

Column headers: ${headers.join(', ')}

Sample data (first ${Math.min(sample.length, 5)} rows):
${JSON.stringify(sample.slice(0, 5), null, 2)}

Map these columns to their roles:
- htsCol: the column containing HTS or tariff codes (typically 10 digits, may include dots like 8471.30.0100 or Schedule B numbers)
- labelCol: the column with part numbers, NSN codes, item IDs, or product names — null if no clear match
- descCol: the column with item or part descriptions — null if no clear match

Rules:
- htsCol is required; pick the column whose values look most like numeric tariff codes
- If two columns could be labelCol or descCol, prefer the one that looks like an ID/number for label and free text for desc
- Only use column names exactly as they appear in the headers list

Respond with ONLY valid JSON, no explanation, no markdown:
{"htsCol": "exact header name", "labelCol": "exact header name or null", "descCol": "exact header name or null"}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    let mapping: { htsCol?: string; labelCol?: string | null; descCol?: string | null }
    try {
      mapping = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Validate returned column names actually exist in the file
    const htsCol   = mapping.htsCol   && headers.includes(mapping.htsCol)   ? mapping.htsCol   : headers[0]
    const labelCol = mapping.labelCol && headers.includes(mapping.labelCol) ? mapping.labelCol : null
    const descCol  = mapping.descCol  && headers.includes(mapping.descCol)  ? mapping.descCol  : null

    return NextResponse.json({ htsCol, labelCol, descCol })
  } catch (err) {
    console.error('POST /api/map-columns:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Mapping failed' },
      { status: 500 },
    )
  }
}
