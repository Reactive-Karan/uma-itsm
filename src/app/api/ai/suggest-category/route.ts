import { z } from 'zod'
import OpenAI from 'openai'
import { ApiResponse } from '@/lib/auth/guards'

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(5),
})

const SYSTEM_PROMPT = `You are an IT service management classifier for UMA Group.
Analyse the ticket title and description and return a JSON object with the most likely:
- request_type: "it_service" or "data_service"
- sub_type: one of "hardware", "software" (for it_service) OR "analysis", "discrepancy", "issues" (for data_service)
- priority: "high", "medium", or "low"
- confidence: object with fields request_type, sub_type, priority — each a float 0.0–1.0
- reasoning: one sentence explaining the classification

Priority guide:
- high: system down, cannot work, critical business impact, multiple users affected
- medium: degraded functionality, workaround exists, single user affected
- low: cosmetic issue, enhancement request, non-urgent query

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`

/**
 * POST /api/ai/suggest-category
 * Returns type/sub-type/priority suggestion with confidence scores.
 * Uses OpenRouter (poolside/laguna-xs-2.1:free).
 * Degrades gracefully if OPENROUTER_API_KEY is not configured.
 */
export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return ApiResponse.ok({ suggestion: null, available: false })
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

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'UMA ITSM',
      },
    })

    const completion = await openai.chat.completions.create({
      model: 'poolside/laguna-xs-2.1:free',
      temperature: 0.1,
      max_tokens: 300,
      // Note: response_format json_object dropped — use system prompt to enforce JSON
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Title: ${parsed.data.title}\n\nDescription: ${parsed.data.description}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'

    // Strip any markdown fences if the model wraps output in ```json ... ```
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const suggestion = JSON.parse(cleaned)

    return ApiResponse.ok({ suggestion, available: true })
  } catch (err) {
    console.error('[AI suggest-category] OpenRouter error:', err)
    return ApiResponse.ok({ suggestion: null, available: false })
  }
}
