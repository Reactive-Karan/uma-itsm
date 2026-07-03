/**
 * Email Delivery Service
 *
 * Wraps SendGrid's v3 Mail Send API.
 * Degrades gracefully in development: if SENDGRID_API_KEY is not set,
 * emails are logged to the console and treated as delivered.
 */

export interface EmailPayload {
  to: string
  subject: string
  bodyHtml: string
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@uma-itsm.network'
const FROM_NAME  = 'UMA ITSM'

/**
 * Sends a single transactional email via SendGrid.
 * Returns `{ ok: true }` on success, `{ ok: false, error }` on failure.
 */
export async function sendEmail(
  payload: EmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  // Dev mode: no API key configured — log and treat as sent
  if (!process.env.SENDGRID_API_KEY) {
    console.log(
      `[EmailService][DEV] Would send email to ${payload.to}\n` +
      `  Subject: ${payload.subject}`,
    )
    return { ok: true }
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: payload.subject,
        content: [{ type: 'text/html', value: payload.bodyHtml }],
        tracking_settings: {
          click_tracking: { enable: false },
          open_tracking: { enable: false },
        },
      }),
    })

    if (response.ok || response.status === 202) {
      return { ok: true }
    }

    const errorBody = await response.text()
    return { ok: false, error: `SendGrid ${response.status}: ${errorBody}` }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
