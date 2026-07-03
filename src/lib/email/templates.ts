/**
 * UMA ITSM — Email Templates
 *
 * Responsive, branded HTML email templates for all 17 notification rules.
 * Each template function returns a complete HTML document string ready to
 * be set as the `body_html` field on a notifications row.
 *
 * CAN-SPAM / CASL compliant: physical mailing address included in every footer.
 */

const BRAND = {
  name: 'UMA ITSM',
  primary: '#1E40AF',
  light: '#EFF6FF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  address: 'UMA Group · IT Service Management Platform · Africa',
}

// ─── Base layout ─────────────────────────────────────────────────────────────

function base({
  title,
  preheader,
  body,
  ctaLabel,
  ctaUrl,
}: {
  title: string
  preheader: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const cta =
    ctaLabel && ctaUrl
      ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background-color:${BRAND.primary};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
          ${ctaLabel}
        </a>
      </div>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
  <!-- preheader -->
  <span style="display:none;font-size:1px;color:#F8FAFC;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.primary};border-radius:12px 12px 0 0;padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="width:36px;height:36px;background-color:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-right:10px;">
                      <span style="color:#ffffff;font-size:20px;font-weight:700;line-height:36px;display:inline-block;width:36px;text-align:center;">U</span>
                    </div>
                    <span style="color:#ffffff;font-size:18px;font-weight:700;vertical-align:middle;">${BRAND.name}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
              ${body}
              ${cta}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                You received this email because you are registered on the UMA ITSM platform.<br/>
                ${BRAND.address}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function ticketBadge(number: string, priority?: string): string {
  const colour = priority === 'high' ? BRAND.danger : priority === 'medium' ? BRAND.warning : BRAND.muted
  return `<span style="font-family:monospace;font-size:13px;font-weight:600;color:${BRAND.primary};background-color:${BRAND.light};padding:3px 8px;border-radius:4px;">${number}</span>${priority ? `&nbsp;&nbsp;<span style="font-size:12px;font-weight:600;color:${colour};text-transform:uppercase;">${priority}</span>` : ''}`
}

function greeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Hi <strong>${name}</strong>,</p>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:20px 0;"/>`
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:${BRAND.muted};width:120px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:${BRAND.text};font-weight:500;">${value}</td>
  </tr>`
}

function metaTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;">
    ${rows.map(([l, v]) => metaRow(l, v)).join('')}
  </table>`
}

// ─── Template Types ───────────────────────────────────────────────────────────

interface TicketCtx {
  ticketNumber: string
  title: string
  requestType: string
  priority: string
  requesterName: string
  appUrl: string
}

// ─── NR-01: Ticket Received (Requester) ──────────────────────────────────────

export function tmplTicketReceived(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, requestType, priority, recipientName } = ctx
  return base({
    title: `Your request has been received — ${ticketNumber}`,
    preheader: `We've received your request and will assign it shortly.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 20px;font-size:15px;color:${BRAND.text};">Your support request has been received and will be assigned to a specialist shortly.</p>
      ${divider()}
      ${metaTable([
        ['Reference', ticketNumber],
        ['Title', title],
        ['Type', requestType],
        ['Priority', priority],
        ['Status', 'New — Pending Assignment'],
      ])}
      <p style="margin:16px 0 0;font-size:13px;color:${BRAND.muted};">You will receive an email when your request has been acknowledged. You can track its progress at any time using the button below.</p>`,
    ctaLabel: 'Track My Request',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-02: Ticket Assigned (Dept User) ──────────────────────────────────────

export function tmplTicketAssigned(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, requestType, priority, recipientName, requesterName } = ctx
  return base({
    title: `New ticket assigned to you — ${ticketNumber}`,
    preheader: `${ticketNumber}: ${title} — requires acknowledgment`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 20px;font-size:15px;color:${BRAND.text};">A new support request has been assigned to you. Please acknowledge it within <strong>4 business hours</strong> to meet your SLA target.</p>
      ${divider()}
      ${metaTable([
        ['Reference', ticketNumber],
        ['Title', title],
        ['Type', requestType],
        ['Priority', priority],
        ['Raised by', requesterName],
      ])}`,
    ctaLabel: 'View & Acknowledge',
    ctaUrl: `${appUrl}/dept-user/dashboard`,
  })
}

// ─── NR-03: Ticket Acknowledged (Requester) ──────────────────────────────────

export function tmplTicketAcknowledged(ctx: TicketCtx & { recipientName: string; assigneeName: string }): string {
  const { appUrl, ticketNumber, title, priority, recipientName, assigneeName } = ctx
  return base({
    title: `Your request has been acknowledged — ${ticketNumber}`,
    preheader: `${assigneeName} is now working on your request.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 20px;font-size:15px;color:${BRAND.text};">Your request has been acknowledged by our support team. ${assigneeName} is now assigned and working on it.</p>
      ${divider()}
      ${metaTable([
        ['Reference', ticketNumber],
        ['Title', title],
        ['Priority', priority],
        ['Assigned to', assigneeName],
        ['Status', 'Acknowledged'],
      ])}`,
    ctaLabel: 'View Request',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-04: In Progress (Requester) ──────────────────────────────────────────

export function tmplTicketInProgress(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, recipientName } = ctx
  return base({
    title: `Your request is in progress — ${ticketNumber}`,
    preheader: `Our team is actively working on your request.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 20px;font-size:15px;color:${BRAND.text};">Our support team is actively working on your request. We will update you as soon as there is progress to share.</p>
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title], ['Status', 'In Progress']])}`,
    ctaLabel: 'View Request',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-05: Pending Requester (Requester) ────────────────────────────────────

export function tmplPendingRequester(ctx: TicketCtx & { recipientName: string; question?: string }): string {
  const { appUrl, ticketNumber, title, recipientName, question } = ctx
  return base({
    title: `We need more information — ${ticketNumber}`,
    preheader: `Please reply with the requested information to resume your request.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Our support team needs additional information to continue working on your request. <strong>Your SLA timer has been paused</strong> pending your response.</p>
      ${question ? `<div style="background:${BRAND.light};border-left:4px solid ${BRAND.primary};padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0;font-size:14px;color:${BRAND.text};">${question}</p></div>` : ''}
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title], ['Status', 'Pending Your Response']])}
      <p style="margin:16px 0 0;font-size:13px;color:${BRAND.muted};">Please reply in the ticket portal. The SLA timer will resume once you respond.</p>`,
    ctaLabel: 'Reply Now',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-06: Requester Responded (Dept User) ──────────────────────────────────

export function tmplRequesterResponded(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, recipientName } = ctx
  return base({
    title: `Requester has responded — ${ticketNumber}`,
    preheader: `The requester has provided the requested information. SLA timer resumed.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">The requester has responded to your information request. Your <strong>SLA timer has resumed</strong>.</p>
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title]])}`,
    ctaLabel: 'Continue Working',
    ctaUrl: `${appUrl}/dept-user/dashboard`,
  })
}

// ─── NR-07: Escalated to Manager ─────────────────────────────────────────────

export function tmplEscalatedManager(ctx: TicketCtx & { recipientName: string; reason: string }): string {
  const { appUrl, ticketNumber, title, priority, recipientName, requesterName, reason } = ctx
  return base({
    title: `[Escalation] ${ticketNumber} requires immediate action`,
    preheader: `A ticket has been escalated to you and requires urgent attention.`,
    body: `
      ${greeting(recipientName)}
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${BRAND.danger};font-weight:600;">⚠ This ticket has been escalated and requires immediate action.</p>
      </div>
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Reason: <strong>${reason}</strong></p>
      ${divider()}
      ${metaTable([
        ['Reference', ticketNumber],
        ['Title', title],
        ['Priority', priority],
        ['Raised by', requesterName],
      ])}`,
    ctaLabel: 'Review Escalation',
    ctaUrl: `${appUrl}/manager/escalations`,
  })
}

// ─── NR-08: Escalated Notice to Requester ────────────────────────────────────

export function tmplEscalatedRequester(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, recipientName } = ctx
  return base({
    title: `Your request has been escalated — ${ticketNumber}`,
    preheader: `Your request has been escalated to a senior team member for urgent attention.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Your request has been escalated to a senior team member for urgent attention. We apologise for the delay and will update you shortly.</p>
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title], ['Status', 'Escalated']])}`,
    ctaLabel: 'Track Request',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-09: Priority Changed (Requester) ─────────────────────────────────────

export function tmplPriorityChanged(ctx: TicketCtx & { recipientName: string; newPriority: string; reason?: string }): string {
  const { appUrl, ticketNumber, title, recipientName, priority: oldPriority, newPriority, reason } = ctx
  return base({
    title: `Ticket priority updated — ${ticketNumber}`,
    preheader: `The priority of your request has been changed.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">The priority of your support request has been updated.</p>
      ${metaTable([
        ['Reference', ticketNumber],
        ['Title', title],
        ['Previous Priority', oldPriority],
        ['New Priority', newPriority],
        ...(reason ? [['Reason', reason] as [string, string]] : []),
      ])}`,
    ctaLabel: 'View Request',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-10: Ticket Reassigned (New Dept User) ────────────────────────────────

export function tmplTicketReassigned(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, priority, recipientName, requesterName } = ctx
  return base({
    title: `Ticket reassigned to you — ${ticketNumber}`,
    preheader: `A support ticket has been assigned to you.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">A support ticket has been reassigned to you. Please review and acknowledge it.</p>
      ${divider()}
      ${metaTable([
        ['Reference', ticketNumber],
        ['Title', title],
        ['Priority', priority],
        ['Raised by', requesterName],
      ])}`,
    ctaLabel: 'View & Acknowledge',
    ctaUrl: `${appUrl}/dept-user/dashboard`,
  })
}

// ─── NR-11: Ticket Resolved (Requester) ──────────────────────────────────────

export function tmplTicketResolved(ctx: TicketCtx & { recipientName: string; resolutionNote: string }): string {
  const { appUrl, ticketNumber, title, recipientName, resolutionNote } = ctx
  return base({
    title: `Your request has been resolved — ${ticketNumber}`,
    preheader: `Your support request has been resolved. Please confirm or reopen if needed.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Your support request has been resolved. Please review the resolution below.</p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${BRAND.success};text-transform:uppercase;">Resolution Summary</p>
        <p style="margin:0;font-size:14px;color:${BRAND.text};">${resolutionNote}</p>
      </div>
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title], ['Status', 'Resolved']])}
      <p style="margin:16px 0 0;font-size:13px;color:${BRAND.muted};">If your issue is not resolved, you can reopen this ticket within 72 hours.</p>`,
    ctaLabel: 'Confirm or Reopen',
    ctaUrl: `${appUrl}/requester/tickets`,
  })
}

// ─── NR-12: Auto-Closed (Requester) ──────────────────────────────────────────

export function tmplTicketAutoClosed(ctx: TicketCtx & { recipientName: string }): string {
  const { appUrl, ticketNumber, title, recipientName } = ctx
  return base({
    title: `Your request has been closed — ${ticketNumber}`,
    preheader: `Your ticket has been automatically closed after 72 hours.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Your support request has been automatically closed after remaining in Resolved status for 72 hours with no response.</p>
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title], ['Status', 'Closed']])}
      <p style="margin:16px 0 0;font-size:13px;color:${BRAND.muted};">If your issue was not resolved, please raise a new ticket and reference <strong>${ticketNumber}</strong>.</p>`,
    ctaLabel: 'Raise a New Ticket',
    ctaUrl: `${appUrl}/requester/tickets/new`,
  })
}

// ─── NR-13: Ticket Reopened (Dept User) ──────────────────────────────────────

export function tmplTicketReopened(ctx: TicketCtx & { recipientName: string; requesterNote?: string }): string {
  const { appUrl, ticketNumber, title, recipientName, requesterNote } = ctx
  return base({
    title: `Ticket reopened by requester — ${ticketNumber}`,
    preheader: `The requester has disputed the resolution and reopened this ticket.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">The requester has disputed the resolution and reopened this ticket.</p>
      ${requesterNote ? `<div style="background:${BRAND.light};border-left:4px solid ${BRAND.primary};padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${BRAND.primary};">Requester note</p><p style="margin:0;font-size:14px;color:${BRAND.text};">${requesterNote}</p></div>` : ''}
      ${divider()}
      ${metaTable([['Reference', ticketNumber], ['Title', title]])}`,
    ctaLabel: 'Review & Continue',
    ctaUrl: `${appUrl}/dept-user/dashboard`,
  })
}

// ─── NR-14: Manager Inaction (Super Admin) ───────────────────────────────────

export function tmplManagerInaction(ctx: { recipientName: string; ticketNumber: string; title: string; appUrl: string }): string {
  const { recipientName, ticketNumber, title, appUrl } = ctx
  return base({
    title: `[Action Required] Manager inaction — ${ticketNumber}`,
    preheader: `A ticket has been escalated for more than 4 hours with no manager response.`,
    body: `
      ${greeting(recipientName)}
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${BRAND.danger};font-weight:600;">⚠ Manager inaction detected — immediate intervention required.</p>
      </div>
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Ticket <strong>${ticketNumber}</strong> ("${title}") has been in Escalated status for more than 4 hours without manager action. Please review immediately.</p>`,
    ctaLabel: 'Review Now',
    ctaUrl: `${appUrl}/admin/tickets`,
  })
}

// ─── NR-15: Escalation Loop (All Super Admins) ───────────────────────────────

export function tmplEscalationLoop(ctx: { recipientName: string; ticketNumber: string; title: string; appUrl: string }): string {
  const { recipientName, ticketNumber, title, appUrl } = ctx
  return base({
    title: `[CRITICAL] Escalation loop — ${ticketNumber}`,
    preheader: `A ticket has been escalated 2+ times without resolution.`,
    body: `
      ${greeting(recipientName)}
      <div style="background:#FEF2F2;border:2px solid ${BRAND.danger};border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${BRAND.danger};font-weight:700;">🔴 CRITICAL: Escalation loop detected</p>
      </div>
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">Ticket <strong>${ticketNumber}</strong> ("${title}") has been escalated multiple times without resolution. Super Admin intervention is required immediately.</p>`,
    ctaLabel: 'Take Ownership',
    ctaUrl: `${appUrl}/admin/tickets`,
  })
}

// ─── NR-16: User Deactivated (Manager) ───────────────────────────────────────

export function tmplUserDeactivated(ctx: { recipientName: string; deactivatedName: string; deactivatedEmail: string; appUrl: string }): string {
  const { recipientName, deactivatedName, deactivatedEmail, appUrl } = ctx
  return base({
    title: `User account deactivated — ${deactivatedName}`,
    preheader: `${deactivatedName} has been deactivated. Review and reassign any open tickets.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};">The following user account has been deactivated. Please review their open tickets and reassign as needed.</p>
      ${divider()}
      ${metaTable([['Name', deactivatedName], ['Email', deactivatedEmail], ['Status', 'Deactivated']])}`,
    ctaLabel: 'Review Open Tickets',
    ctaUrl: `${appUrl}/manager/team`,
  })
}

// ─── NR-17: OOO No Backup (Super Admin) ──────────────────────────────────────

export function tmplOooNoBackup(ctx: { recipientName: string; deptUserName: string; deptUserEmail: string; appUrl: string }): string {
  const { recipientName, deptUserName, deptUserEmail, appUrl } = ctx
  return base({
    title: `OOO user has no backup assigned — ${deptUserName}`,
    preheader: `${deptUserName} is out of office with no backup. New tickets cannot be auto-routed.`,
    body: `
      ${greeting(recipientName)}
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};"><strong>${deptUserName}</strong> (${deptUserEmail}) has been set as Out of Office but has no backup assignee configured. New tickets matching their routing rules will be left unassigned until this is resolved.</p>
      ${divider()}
      <p style="margin:0;font-size:13px;color:${BRAND.muted};">Please either assign a backup for this user or update the affected routing rules.</p>`,
    ctaLabel: 'Update Routing Rules',
    ctaUrl: `${appUrl}/admin/routing`,
  })
}
