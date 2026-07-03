import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/services/email.service'

const BATCH_SIZE = 50
const MAX_RETRIES = 3

/**
 * POST /api/cron/notification-processor
 *
 * Processes the notification queue — picks up pending rows, sends via SendGrid,
 * and updates delivery status. Runs every 60 seconds via external scheduler.
 *
 * Also retries failed notifications that haven't exhausted their retry budget.
 *
 * Vercel Cron (vercel.json):
 * { "crons": [{ "path": "/api/cron/notification-processor", "schedule": "every 1 minute" }] }
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const started = Date.now()

  // Fetch pending + retryable notifications
  const { data: pending } = await supabase
    .from('notifications')
    .select('id, recipient_email, subject, body_html, attempt_count, notification_type')
    .or(`status.eq.pending,and(status.eq.failed,attempt_count.lt.${MAX_RETRIES})`)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (!pending?.length) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0, elapsed_ms: Date.now() - started })
  }

  let sent = 0
  let failed = 0
  const now = new Date().toISOString()

  for (const notif of pending) {
    const result = await sendEmail({
      to: notif.recipient_email,
      subject: notif.subject,
      bodyHtml: notif.body_html,
    })

    if (result.ok) {
      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: now, attempt_count: notif.attempt_count + 1 })
        .eq('id', notif.id)
      sent++
    } else {
      const newCount = notif.attempt_count + 1
      await supabase
        .from('notifications')
        .update({
          status: newCount >= MAX_RETRIES ? 'failed' : 'pending',
          attempt_count: newCount,
          error_message: result.error?.slice(0, 500) ?? 'Unknown error',
        })
        .eq('id', notif.id)
      failed++
      console.error(`[NotificationProcessor] Failed to send ${notif.id} (${notif.notification_type}):`, result.error)
    }
  }

  return NextResponse.json({
    ok: true,
    processed: pending.length,
    sent,
    failed,
    elapsed_ms: Date.now() - started,
  })
}

export { POST as GET }
