import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scanAckBreaches, scanResBreaches, scanManagerInaction } from '@/services/escalation.service'

/**
 * POST /api/cron/sla-scan
 *
 * SLA breach scanner — runs every 15 minutes via an external scheduler.
 * Protected by CRON_SECRET header to prevent unauthorised invocation.
 *
 * Vercel Cron example (vercel.json):
 * { "crons": [{ "path": "/api/cron/sla-scan", "schedule": "every 15 minutes" }] }
 *
 * The route uses the service role client to bypass RLS, as it acts on behalf
 * of the system (not a specific authenticated user).
 */
export async function POST(request: Request) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const started = Date.now()

  const [ack, res, inaction] = await Promise.all([
    scanAckBreaches(supabase),
    scanResBreaches(supabase),
    scanManagerInaction(supabase),
  ])

  // Update cron run log
  await supabase
    .from('cron_runs')
    .update({
      last_run: new Date().toISOString(),
      last_count: ack.escalated + res.escalated + inaction.notified,
    })
    .eq('job_name', 'sla-scan')

  const elapsed = Date.now() - started

  return NextResponse.json({
    ok: true,
    elapsed_ms: elapsed,
    ack_breaches: ack,
    res_breaches: res,
    manager_inaction: inaction,
  })
}

// Also support GET so Vercel Cron can call it (Vercel Cron uses GET by default)
export { POST as GET }
