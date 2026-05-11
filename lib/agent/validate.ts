import Anthropic from '@anthropic-ai/sdk'
import { searchHts, type HtsResult } from '@/lib/hts/usitc'

const client = new Anthropic()

export interface ValidationResult {
  hts_code: string
  hts_description: string
  confidence_score: number // 0.0 – 1.0
  source_url: string
  reasoning: string
}

const SYSTEM_PROMPT = `You are an expert in USITC Harmonized Tariff Schedule (HTS) classification for defense and commercial parts.

Your job:
1. Call the search_hts tool with relevant keywords from the user's part number or description.
2. Review the results and select the MOST SPECIFIC matching HTS code.
3. Return a JSON object with: hts_code, hts_description, confidence_score (0.0-1.0), source_url, and reasoning.

Rules:
- NEVER invent or assume an HTS code. Only use codes returned by search_hts.
- If search results are ambiguous, call search_hts again with refined terms.
- If no good match exists, return confidence_score below 0.5 and explain why in reasoning.
- confidence_score 0.9+ = exact match. 0.7-0.9 = strong match. 0.5-0.7 = possible match. Below 0.5 = poor match.`

export async function runHtsAgent(query: string): Promise<ValidationResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Classify this part: ${query}` },
  ]

  // Agentic loop — Claude calls search_hts until it has enough to answer
  for (let turn = 0; turn < 5; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'search_hts',
          description: 'Search the USITC Harmonized Tariff Schedule by keyword. Returns matching HTS codes and descriptions.',
          input_schema: {
            type: 'object' as const,
            properties: {
              query: { type: 'string', description: 'Keywords describing the product (e.g. "electronic circuit breaker 600V")' },
            },
            required: ['query'],
          },
        },
      ],
      messages,
    })

    // Collect tool calls (if any)
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Claude is done — extract JSON from the final text block
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      if (!textBlock) throw new Error('Agent returned no text response')

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error(`Agent response did not contain JSON: ${textBlock.text}`)

      const parsed = JSON.parse(jsonMatch[0]) as Partial<ValidationResult>
      return {
        hts_code: parsed.hts_code ?? '',
        hts_description: parsed.hts_description ?? '',
        confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0,
        source_url: parsed.source_url ?? '',
        reasoning: parsed.reasoning ?? '',
      }
    }

    // Execute all tool calls and add results back to the conversation
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const input = block.input as { query: string }
        let results: HtsResult[]
        try {
          results = await searchHts(input.query)
        } catch (err) {
          results = []
          console.error('USITC search error:', err)
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: results.length > 0
            ? JSON.stringify(results)
            : 'No results found. Try different search terms.',
        }
      }),
    )

    messages.push({ role: 'user', content: toolResults })
  }

  throw new Error('Agent did not converge after 5 turns')
}
