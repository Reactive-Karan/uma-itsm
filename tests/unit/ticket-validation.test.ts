import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ─── Reproduce the validation schemas used in the API routes ─────────────────

const CreateTicketSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(150),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000),
  request_type: z.enum(['it_service', 'data_service']),
  sub_type: z.enum(['hardware', 'software', 'analysis', 'discrepancy', 'issues']),
  priority: z.enum(['high', 'medium', 'low']),
}).refine(
  (data) => {
    if (data.request_type === 'it_service') return ['hardware', 'software'].includes(data.sub_type)
    return ['analysis', 'discrepancy', 'issues'].includes(data.sub_type)
  },
  { message: 'Sub-type does not match the selected request type.' },
)

const validTicket = {
  title: 'Laptop screen is not working',
  description: 'My laptop screen has been flickering since yesterday. It affects my ability to work.',
  request_type: 'it_service' as const,
  sub_type: 'hardware' as const,
  priority: 'high' as const,
}

describe('Ticket creation validation', () => {
  it('accepts a valid ticket payload', () => {
    expect(CreateTicketSchema.safeParse(validTicket).success).toBe(true)
  })

  it('rejects a title shorter than 10 characters', () => {
    const result = CreateTicketSchema.safeParse({ ...validTicket, title: 'Short' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/10 characters/)
  })

  it('rejects a description shorter than 20 characters', () => {
    const result = CreateTicketSchema.safeParse({ ...validTicket, description: 'Too short' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/20 characters/)
  })

  it('rejects hardware sub-type for data_service request_type', () => {
    const result = CreateTicketSchema.safeParse({
      ...validTicket,
      request_type: 'data_service',
      sub_type: 'hardware',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/Sub-type does not match/)
  })

  it('accepts analysis sub-type for data_service', () => {
    const result = CreateTicketSchema.safeParse({
      ...validTicket,
      request_type: 'data_service',
      sub_type: 'analysis',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid priority value', () => {
    const result = CreateTicketSchema.safeParse({ ...validTicket, priority: 'critical' })
    expect(result.success).toBe(false)
  })

  it('rejects a title longer than 150 characters', () => {
    const result = CreateTicketSchema.safeParse({ ...validTicket, title: 'A'.repeat(151) })
    expect(result.success).toBe(false)
  })

  it('accepts all valid sub-types for it_service', () => {
    for (const sub of ['hardware', 'software'] as const) {
      const r = CreateTicketSchema.safeParse({ ...validTicket, sub_type: sub })
      expect(r.success).toBe(true)
    }
  })

  it('accepts all valid sub-types for data_service', () => {
    for (const sub of ['analysis', 'discrepancy', 'issues'] as const) {
      const r = CreateTicketSchema.safeParse({ ...validTicket, request_type: 'data_service', sub_type: sub })
      expect(r.success).toBe(true)
    }
  })
})

// ─── Status transition rules ─────────────────────────────────────────────────

describe('Status transition allowed values', () => {
  const UpdateStatusSchema = z.object({
    status: z.enum(['in_progress', 'pending_requester', 'resolved']),
    resolution_note: z.string().min(10).max(2000).optional(),
  })

  it('accepts valid status transitions', () => {
    for (const s of ['in_progress', 'pending_requester', 'resolved'] as const) {
      expect(UpdateStatusSchema.safeParse({ status: s }).success).toBe(true)
    }
  })

  it('rejects invalid status transitions (new, acknowledged, closed)', () => {
    for (const s of ['new', 'acknowledged', 'closed', 'escalated']) {
      expect(UpdateStatusSchema.safeParse({ status: s }).success).toBe(false)
    }
  })
})
