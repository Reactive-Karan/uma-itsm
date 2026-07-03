/**
 * Business-hours-aware SLA engine.
 *
 * Responsibilities:
 * - Convert UTC timestamps ↔ region local time using IANA timezone identifiers
 * - Calculate SLA deadlines by counting only business hours
 * - Skip non-working days, public holidays, and out-of-hours time
 *
 * Sprint 3 fully replaces the calendar-hour approximation from Sprint 2.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Priority } from '@/types/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessHoursConfig {
  timezone: string
  workdays: boolean[] // index 0=Sun, 1=Mon, …, 6=Sat
  startHour: number  // 0–23 in local time
  endHour: number    // 1–24 in local time (always > startHour)
  holidays: Set<string> // 'YYYY-MM-DD' strings in local date
}

// SLA windows in BUSINESS hours per priority
export const BIZ_SLA_ACK_HOURS = 4
export const BIZ_SLA_RESOLUTION_HOURS: Record<Priority, number> = {
  high: 8,
  medium: 24,
  low: 72,
}

// ─── Timezone utilities ───────────────────────────────────────────────────────

/** Get local date/time components for a UTC date in a given IANA timezone. */
function getLocalParts(utcDate: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'narrow', hour12: false,
  })

  const parts: Record<string, string> = {}
  fmt.formatToParts(utcDate).forEach((p) => { parts[p.type] = p.value })

  const DOW_MAP: Record<string, number> = { S: -1, M: 1, T: -1, W: 3, F: 5 }
  // Use full weekday to get a reliable day of week
  const wdFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short',
  })
  const wd = wdFmt.format(utcDate)
  const dowIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)

  const hour = parseInt(parts.hour) % 24
  const month = parseInt(parts.month)
  const day = parseInt(parts.day)
  const year = parseInt(parts.year)

  return {
    year, month, day, hour,
    minute: parseInt(parts.minute),
    second: parseInt(parts.second),
    dowIndex,           // 0=Sun … 6=Sat
    dateStr: `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    localHourDecimal: hour + parseInt(parts.minute) / 60,
  }
}

/**
 * Convert a local date (year, month, day, hour, minute) in a given timezone
 * back to a UTC Date. Uses a probe-and-correct approach that handles DST.
 */
function localToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number,
  timezone: string,
): Date {
  // Build an ISO string treated as UTC probe
  const iso = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`
  const probeUtc = new Date(iso)

  // Get the local time that this UTC probe maps to in the target timezone
  const probeLocal = getLocalParts(probeUtc, timezone)

  // Difference between what the probe shows locally vs. our target local time.
  // Subtract this offset from probeUtc to get the real UTC equivalent.
  // e.g. Africa/Nairobi (UTC+3): probe 09:00 UTC → 12:00 local
  //   diff = (12-9)*60 = 180 min → corrected = 09:00 UTC − 180 min = 06:00 UTC ✓
  const diffMinutes =
    (probeLocal.hour - hour) * 60 + (probeLocal.minute - minute)

  return new Date(probeUtc.getTime() - diffMinutes * 60_000)
}

// ─── Core business hours algorithm ───────────────────────────────────────────

/**
 * Returns whether a given UTC instant falls within business hours for a region.
 */
export function isWithinBusinessHours(utcDate: Date, config: BusinessHoursConfig): boolean {
  const local = getLocalParts(utcDate, config.timezone)
  if (config.holidays.has(local.dateStr)) return false
  if (!config.workdays[local.dowIndex]) return false
  return local.localHourDecimal >= config.startHour && local.localHourDecimal < config.endHour
}

/**
 * Advance a UTC date to the start of the next business period (inclusive).
 * If already within business hours, returns the same date unchanged.
 * Caps iteration at 14 days to prevent infinite loops on misconfiguration.
 */
function advanceToBusinessStart(date: Date, config: BusinessHoursConfig): Date {
  let current = new Date(date)

  for (let dayAttempts = 0; dayAttempts < 14; dayAttempts++) {
    const local = getLocalParts(current, config.timezone)

    const isHoliday = config.holidays.has(local.dateStr)
    const isWorkday = config.workdays[local.dowIndex]

    if (!isHoliday && isWorkday) {
      const h = local.localHourDecimal

      if (h < config.startHour) {
        // Before business start today — jump to start
        return localToUtc(local.year, local.month, local.day, config.startHour, 0, config.timezone)
      }
      if (h < config.endHour) {
        // Already within business hours
        return current
      }
    }

    // After hours / holiday / non-workday — advance to next calendar day's start
    current = localToUtc(local.year, local.month, local.day + 1, config.startHour, 0, config.timezone)
  }

  return current // fallback (should not happen with valid config)
}

/**
 * Add N business hours to a UTC start time, respecting the region's calendar.
 *
 * Algorithm:
 *   1. If outside business hours, advance to the next business period start.
 *   2. Consume business hours up to end of current business day.
 *   3. If hours remain, advance to the next business day start and repeat.
 */
export function addBusinessHours(startUtc: Date, hoursToAdd: number, config: BusinessHoursConfig): Date {
  if (hoursToAdd <= 0) return startUtc

  let current = advanceToBusinessStart(startUtc, config)
  let remaining = hoursToAdd

  for (let dayAttempts = 0; dayAttempts < 100; dayAttempts++) {
    const local = getLocalParts(current, config.timezone)
    const hoursLeftToday = config.endHour - local.localHourDecimal

    if (hoursLeftToday <= 0) {
      // Shouldn't happen after advanceToBusinessStart, but guard anyway
      current = advanceToBusinessStart(
        localToUtc(local.year, local.month, local.day + 1, 0, 0, config.timezone),
        config,
      )
      continue
    }

    if (remaining <= hoursLeftToday) {
      // Deadline falls within today's business hours
      const minutesToAdd = Math.round(remaining * 60)
      return new Date(current.getTime() + minutesToAdd * 60_000)
    }

    // Consume rest of today and continue to next business day
    remaining -= hoursLeftToday
    current = advanceToBusinessStart(
      localToUtc(local.year, local.month, local.day + 1, 0, 0, config.timezone),
      config,
    )
  }

  return current // safety fallback
}

// ─── Database helpers ─────────────────────────────────────────────────────────

/**
 * Load the BusinessHoursConfig for a region from Supabase.
 * Returns null if the region has no configured business hours.
 */
export async function getRegionConfig(
  supabase: SupabaseClient<Database>,
  regionId: string,
): Promise<BusinessHoursConfig | null> {
  const [{ data: region }, { data: bh }, { data: holidayRows }] = await Promise.all([
    supabase.from('regions').select('timezone').eq('id', regionId).single(),
    supabase.from('business_hours').select('*').eq('region_id', regionId).single(),
    supabase
      .from('holidays')
      .select('holiday_date')
      .eq('region_id', regionId)
      .gte('holiday_date', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
      .lte('holiday_date', new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)),
  ])

  if (!region || !bh) return null

  const [startHour] = bh.start_time.split(':').map(Number)
  const [endHour] = bh.end_time.split(':').map(Number)

  return {
    timezone: region.timezone,
    workdays: [bh.work_sun, bh.work_mon, bh.work_tue, bh.work_wed, bh.work_thu, bh.work_fri, bh.work_sat],
    startHour,
    endHour,
    holidays: new Set((holidayRows ?? []).map((h) => h.holiday_date.slice(0, 10))),
  }
}

/**
 * Calculate the acknowledgment SLA deadline for a ticket.
 * Falls back to calendar hours if no business hours config exists.
 */
export async function calcAckDeadline(
  supabase: SupabaseClient<Database>,
  regionId: string,
  from: Date = new Date(),
): Promise<Date> {
  const config = await getRegionConfig(supabase, regionId)
  if (!config) return new Date(from.getTime() + BIZ_SLA_ACK_HOURS * 3_600_000)
  return addBusinessHours(from, BIZ_SLA_ACK_HOURS, config)
}

/**
 * Calculate the resolution SLA deadline for a ticket.
 * Called at acknowledgment time (not submission time).
 */
export async function calcResDeadline(
  supabase: SupabaseClient<Database>,
  regionId: string,
  priority: Priority,
  from: Date = new Date(),
): Promise<Date> {
  const config = await getRegionConfig(supabase, regionId)
  const hours = BIZ_SLA_RESOLUTION_HOURS[priority]
  if (!config) return new Date(from.getTime() + hours * 3_600_000)
  return addBusinessHours(from, hours, config)
}
