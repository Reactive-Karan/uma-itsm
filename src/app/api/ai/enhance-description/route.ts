import { z } from 'zod'
import OpenAI from 'openai'
import { ApiResponse } from '@/lib/auth/guards'

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  request_type: z.enum(['it_service', 'data_service']).optional(),
  sub_type: z.string().optional(),
})

const SYSTEM_PROMPT = `You are an IT service management assistant for UMA Group, an enterprise operating across ten African regions.
Your task is to improve a support ticket description for clarity and actionability.

Rewrite the description to include ALL of the following that can be reasonably inferred:
1. A clear statement of what is not working or what is needed
2. When the issue started (if mentioned or inferable)
3. What the user has already tried (if mentioned)
4. The business impact if left unresolved
5. Any relevant system, device, or data reference

Rules:
- Preserve all factual content exactly. Do not add invented specifics.
- Use professional, clear English.
- Return ONLY the improved description text — no preamble, no explanation.
- Maximum 400 words.
- If the input is already well-structured and high quality, return it unchanged.`

/**
 * POST /api/ai/enhance-description
 * Uses OpenRouter (poolside/laguna-xs-2.1:free) to improve a ticket description.
 * Degrades gracefully if OPENROUTER_API_KEY is not configured.
 */
export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return ApiResponse.ok({ enhanced: null, available: false })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return ApiResponse.badRequest('Request body must be valid JSON.')
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')
  }

  const { title, description, request_type, sub_type } = parsed.data

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'UMA ITSM',
      },
    })

    const userMessage = [
      `Ticket title: ${title}`,
      request_type ? `Request type: ${request_type.replace('_', ' ')}` : '',
      sub_type ? `Sub-type: ${sub_type}` : '',
      ``,
      `Current description:`,
      description,
    ]
      .filter(Boolean)
      .join('\n')

    const completion = await openai.chat.completions.create({
      model: 'poolside/laguna-xs-2.1:free',
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })

    const enhanced = completion.choices[0]?.message?.content?.trim() ?? null

    return ApiResponse.ok({ enhanced, available: true })
  } catch (err) {
    console.error('[AI enhance-description] OpenRouter error:', err)
    return ApiResponse.ok({ enhanced: null, available: false })
  }
}
