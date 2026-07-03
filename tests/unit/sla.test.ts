import { describe, it, expect } from 'vitest'
import {
  addBusinessHours,
  isWithinBusinessHours,
  type BusinessHoursConfig,
} from '@/lib/ticket/sla-business'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Standard Mon–Fri 09:00–18:00 config for Africa/Nairobi (UTC+3) */
const nairobiConfig: BusinessHoursConfig = {
  timezone: 'Africa/Nairobi',
  workdays: [false, true, true, true, true, true, false], // Sun=0…Sat=6
  startHour: 9,
  endHour: 18,
  holidays: new Set(),
}

/** Wed 10:00 AM Nairobi = Wed 07:00 UTC */
function wed10am(): Date { return new Date('2026-07-08T07:00:00Z') }
/** Fri 16:00 Nairobi = Fri 13:00 UTC */
function fri4pm(): Date  { return new Date('2026-07-10T13:00:00Z') }
/** Sat 10:00 Nairobi = Sat 07:00 UTC */
function sat10am(): Date { return new Date('2026-07-11T07:00:00Z') }
/** Fri 17:00 Nairobi = Fri 14:00 UTC */
function fri5pm(): Date  { return new Date('2026-07-10T14:00:00Z') }

// ─── isWithinBusinessHours ────────────────────────────────────────────────────

describe('isWithinBusinessHours', () => {
  it('returns true during business hours on a workday', () => {
    expect(isWithinBusinessHours(wed10am(), nairobiConfig)).toBe(true)
  })

  it('returns false on Saturday', () => {
    expect(isWithinBusinessHours(sat10am(), nairobiConfig)).toBe(false)
  })

  it('returns false before start hour', () => {
    const wed7am = new Date('2026-07-08T04:00:00Z') // 07:00 Nairobi
    expect(isWithinBusinessHours(wed7am, nairobiConfig)).toBe(false)
  })

  it('returns false after end hour', () => {
    const wed7pm = new Date('2026-07-08T16:00:00Z') // 19:00 Nairobi
    expect(isWithinBusinessHours(wed7pm, nairobiConfig)).toBe(false)
  })

  it('returns false on a holiday', () => {
    const configWithHoliday = {
      ...nairobiConfig,
      holidays: new Set(['2026-07-08']), // Wed is a holiday
    }
    expect(isWithinBusinessHours(wed10am(), configWithHoliday)).toBe(false)
  })
})

// ─── addBusinessHours ─────────────────────────────────────────────────────────

describe('addBusinessHours', () => {
  it('adds 4 business hours within the same day', () => {
    // Start: Wed 10:00 AM Nairobi → End: Wed 14:00 Nairobi
    const deadline = addBusinessHours(wed10am(), 4, nairobiConfig)
    const localHour = deadline.toLocaleString('en-US', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false })
    expect(parseInt(localHour)).toBe(14)
  })

  it('rolls over to next business day when hours exceed end-of-day', () => {
    // Start: Fri 16:00 (2h left today) + 4h = 2h today + 2h Mon
    const deadline = addBusinessHours(fri4pm(), 4, nairobiConfig)
    const day = deadline.toLocaleString('en-US', { timeZone: 'Africa/Nairobi', weekday: 'short' })
    expect(day).toBe('Mon')
  })

  it('skips weekends when rolling over', () => {
    // Start: Fri 17:00 (1h left) + 8h resolution → Mon morning
    const deadline = addBusinessHours(fri5pm(), 8, nairobiConfig)
    const day = deadline.toLocaleString('en-US', { timeZone: 'Africa/Nairobi', weekday: 'short' })
    expect(day).toBe('Mon')
  })

  it('advances to business start when starting outside hours', () => {
    // Start: Sat 10:00 + 1h → Mon 10:00 (advances to Mon start 09:00, adds 1h)
    const deadline = addBusinessHours(sat10am(), 1, nairobiConfig)
    const day  = deadline.toLocaleString('en-US', { timeZone: 'Africa/Nairobi', weekday: 'short' })
    const hour = parseInt(deadline.toLocaleString('en-US', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false }))
    expect(day).toBe('Mon')
    expect(hour).toBe(10)
  })

  it('skips holidays when calculating deadline', () => {
    const configWithHoliday = {
      ...nairobiConfig,
      holidays: new Set(['2026-07-09']), // Thu is a holiday
    }
    // Wed 16:00 + 4h (2h today + 2h remaining) → skip Thu → Fri 11:00
    const start = new Date('2026-07-08T13:00:00Z') // Wed 16:00 Nairobi
    const deadline = addBusinessHours(start, 4, configWithHoliday)
    const day = deadline.toLocaleString('en-US', { timeZone: 'Africa/Nairobi', weekday: 'short' })
    expect(day).toBe('Fri')
  })

  it('handles zero hours — returns input unchanged', () => {
    const start = wed10am()
    const deadline = addBusinessHours(start, 0, nairobiConfig)
    expect(deadline.getTime()).toBe(start.getTime())
  })
})

// ─── SLA window constants ─────────────────────────────────────────────────────

describe('SLA windows', () => {
  it('High priority resolves in 8 business hours', async () => {
    const { BIZ_SLA_RESOLUTION_HOURS } = await import('@/lib/ticket/sla-business')
    expect(BIZ_SLA_RESOLUTION_HOURS.high).toBe(8)
  })

  it('Medium priority resolves in 24 business hours', async () => {
    const { BIZ_SLA_RESOLUTION_HOURS } = await import('@/lib/ticket/sla-business')
    expect(BIZ_SLA_RESOLUTION_HOURS.medium).toBe(24)
  })

  it('Low priority resolves in 72 business hours', async () => {
    const { BIZ_SLA_RESOLUTION_HOURS } = await import('@/lib/ticket/sla-business')
    expect(BIZ_SLA_RESOLUTION_HOURS.low).toBe(72)
  })

  it('Acknowledgment SLA is 4 business hours for all priorities', async () => {
    const { BIZ_SLA_ACK_HOURS } = await import('@/lib/ticket/sla-business')
    expect(BIZ_SLA_ACK_HOURS).toBe(4)
  })
})
