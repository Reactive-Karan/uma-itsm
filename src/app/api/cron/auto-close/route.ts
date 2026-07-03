import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { autoCloseResolvedTickets } from '@/services/escalation.service'

/**
 * POST /api/cron/auto-close
 *
 * Auto-closes tickets that have been in Resolved state for more than 72 hours.
 * Runs every hour via external scheduler.
 *
 * Business Rule BR-CLO-01: Resolved tickets with no requester response are
 * automatically closed after 72 calendar hours, with a notification sent.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const result = await autoCloseResolvedTickets(supabase)

  await supabase
    .from('cron_runs')
    .update({ last_run: new Date().toISOString(), last_count: result.closed })
    .eq('job_name', 'auto-close')

  return NextResponse.json({ ok: true, ...result })
}

export { POST as GET }
