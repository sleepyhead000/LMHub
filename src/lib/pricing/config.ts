export const MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' }
]

// Cost per 1k tokens
export const PRICING = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 }
}
