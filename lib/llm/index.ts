import Anthropic from '@anthropic-ai/sdk'

export const MODELS = {
  agent:       'claude-sonnet-4-6',
  fastLookup:  'claude-haiku-4-5-20251001',
} as const

export type Model = typeof MODELS[keyof typeof MODELS]

export function createAnthropicClient(): Anthropic {
  return new Anthropic()
}
