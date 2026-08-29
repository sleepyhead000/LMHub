import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { streamText, type CoreMessage } from 'ai'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { PRICING } from '@/lib/pricing/config'
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Initialize Upstash Redis & Ratelimit
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Allow 20 requests per day for free users
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(20, '1 d'),
})

export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages, model, conversationId }: { messages: CoreMessage[], model: string, conversationId?: string } = await req.json()

    // Rate limiting
    const { success, limit, reset, remaining } = await ratelimit.limit(userId)
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Limit': limit.toString(), 'X-RateLimit-Remaining': remaining.toString(), 'X-RateLimit-Reset': reset.toString() } }
      )
    }

    // Check credits
    const { rows: profileRows } = await query('SELECT credit_balance FROM profiles WHERE id = $1', [userId])
    const profile = profileRows[0]

    if (!profile || profile.credit_balance <= 0) {
      return NextResponse.json({ error: 'Insufficient credits. Please top up.' }, { status: 402 })
    }

    // Select provider
    let aiModel;
    if (model.startsWith('gpt')) {
      aiModel = openai(model)
    } else if (model.startsWith('claude')) {
      aiModel = anthropic(model)
    } else if (model.startsWith('gemini')) {
      aiModel = google(model)
    } else {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 })
    }

    let currentConversationId = conversationId

    // Create conversation if it doesn't exist
    if (!currentConversationId) {
      let title = 'New Conversation'
      if (typeof messages[0].content === 'string') {
        title = messages[0].content.substring(0, 50)
      }
      const { rows: convRows } = await query(
        'INSERT INTO conversations (user_id, title, model) VALUES ($1, $2, $3) RETURNING id',
        [userId, title, model]
      )

      if (convRows[0]) currentConversationId = convRows[0].id
    } else {
        // Update conversation model and updated_at
        await query(
            'UPDATE conversations SET model = $1 WHERE id = $2 AND user_id = $3',
            [model, currentConversationId, userId]
        )
    }

    const result = streamText({
      model: aiModel,
      messages,
      async onFinish({ text, usage }) {
        const inputTokens = usage.promptTokens || 0
        const outputTokens = usage.completionTokens || 0

        const priceConfig = PRICING[model as keyof typeof PRICING]
        let cost = 0
        if (priceConfig) {
             cost = (inputTokens / 1000) * priceConfig.input + (outputTokens / 1000) * priceConfig.output
        }

        // Save messages and deduct credits
        if (currentConversationId) {
            const userMessage = messages[messages.length - 1]
            let userContent = '';
            if (typeof userMessage.content === 'string') {
                userContent = userMessage.content;
            }

            await query(
                'INSERT INTO messages (conversation_id, user_id, role, content, model) VALUES ($1, $2, $3, $4, $5)',
                [currentConversationId, userId, 'user', userContent, model]
            )

            await query(
                'INSERT INTO messages (conversation_id, user_id, role, content, model, input_tokens, output_tokens, cost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [currentConversationId, userId, 'assistant', text, model, inputTokens, outputTokens, cost]
            )

            // Deduct credits
            await query(
                'UPDATE profiles SET credit_balance = credit_balance - $1 WHERE id = $2',
                [cost, userId]
            )
        }
      },
    })

    const finalResult = await result;
    return finalResult.toAIStreamResponse({
        headers: {
            'x-conversation-id': currentConversationId || ''
        }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
