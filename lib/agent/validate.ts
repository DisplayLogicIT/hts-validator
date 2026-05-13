import Anthropic from '@anthropic-ai/sdk'
import { searchHts, type HtsResult } from '@/lib/hts/usitc'

const client = new Anthropic()

export interface ValidationResult {
  hts_code: string
  hts_description: string
  confidence_score: number // 0.0 – 1.0
  duty_rate: string | null
  source_url: string
  reasoning: string
}

const SYSTEM_PROMPT = `You are an expert in USITC Harmonized Tariff Schedule (HTS) classification for defense and commercial parts.

Your job:
1. Call search_hts ONCE with a SHORT, SPECIFIC product-type keyword (1-3 words). Do NOT use part numbers or brand names. Extract the core product type.
   Good: "connector", "washer", "relay", "capacitor", "gasket", "clamp"
   Bad: "MIL-C-5015 circular connector aluminum shell"
2. Review the search results and select the MOST SPECIFIC matching HTS code.
3. Return a JSON object with: hts_code, hts_description, confidence_score (0.0-1.0), duty_rate, source_url, reasoning.

Rules:
- NEVER invent or assume an HTS code. Only use codes returned by search_hts.
- Prefer full 10-digit codes (e.g. 8536.69.40.30) over partial codes.
- If no good match exists, return confidence_score below 0.5 and explain in reasoning.
- confidence_score: 0.9+ = exact match, 0.7–0.9 = strong match, 0.5–0.7 = possible match, <0.5 = poor match.
- duty_rate: copy the general duty rate string from the matching result (e.g. "Free", "2.6%"). Use null if unavailable.
- Always return JSON even if confidence is low. Never leave the response blank.`

const SEARCH_TOOL: Anthropic.Tool = {
  name: 'search_hts',
  description:
    'Search the USITC HTS schedule by product keyword. Use short specific product-type words (connector, washer, relay). Returns matching HTS codes, descriptions, and duty rates.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Short product-type keyword(s), 1-3 words. Example: "connector" or "flat washer" or "circuit breaker".',
      },
    },
    required: ['query'],
  },
}

function extractJson(response: Anthropic.Message): ValidationResult {
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) throw new Error('Agent returned no text response')
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Agent response did not contain JSON: ${textBlock.text}`)
  const parsed = JSON.parse(jsonMatch[0]) as Partial<ValidationResult>
  return {
    hts_code: parsed.hts_code ?? '',
    hts_description: parsed.hts_description ?? '',
    confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0,
    duty_rate: parsed.duty_rate ?? null,
    source_url: parsed.source_url ?? '',
    reasoning: parsed.reasoning ?? '',
  }
}

export async function runHtsAgent(query: string): Promise<ValidationResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Classify this part for HTS purposes: ${query}` },
  ]

  // Turn 0 — Claude searches (or answers directly if it already knows)
  const turn0 = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SEARCH_TOOL],
    messages,
  })

  if (turn0.stop_reason === 'end_turn') {
    return extractJson(turn0)
  }

  // Process tool results from turn 0
  messages.push({ role: 'assistant', content: turn0.content })

  const toolBlocks = turn0.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )

  const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
    toolBlocks.map(async (block) => {
      const { query: searchQuery } = block.input as { query: string }
      let results: HtsResult[] = []
      try {
        results = await searchHts(searchQuery)
      } catch (err) {
        console.error('USITC search error:', err)
      }
      return {
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content:
          results.length > 0
            ? JSON.stringify(results)
            : 'No relevant results found. Return your best estimate with confidence_score below 0.5 and explain in reasoning.',
      }
    }),
  )

  messages.push({ role: 'user', content: toolResults })

  // Turn 1 — Force a text response; no further tool calls allowed
  const turn1 = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SEARCH_TOOL],
    tool_choice: { type: 'none' },
    messages,
  })

  return extractJson(turn1)
}
