-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Sprint 3 Database Migration
-- Run in Supabase SQL Editor AFTER sprint2.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── BUSINESS HOURS ───────────────────────────────────────────────────────────
-- One row per region. Defines working days and hours for SLA calculation.

CREATE TABLE IF NOT EXISTS public.business_hours (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   UUID        NOT NULL UNIQUE REFERENCES public.regions(id) ON DELETE CASCADE,
  work_mon    BOOLEAN     NOT NULL DEFAULT TRUE,
  work_tue    BOOLEAN     NOT NULL DEFAULT TRUE,
  work_wed    BOOLEAN     NOT NULL DEFAULT TRUE,
  work_thu    BOOLEAN     NOT NULL DEFAULT TRUE,
  work_fri    BOOLEAN     NOT NULL DEFAULT TRUE,
  work_sat    BOOLEAN     NOT NULL DEFAULT FALSE,
  work_sun    BOOLEAN     NOT NULL DEFAULT FALSE,
  start_time  TIME        NOT NULL DEFAULT '09:00',
  end_time    TIME        NOT NULL DEFAULT '18:00',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT biz_hours_valid_window  CHECK (start_time < end_time),
  CONSTRAINT biz_hours_one_work_day  CHECK (
    work_mon OR work_tue OR work_wed OR work_thu OR work_fri OR work_sat OR work_sun
  )
);

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biz_hours_read ON public.business_hours;
CREATE POLICY biz_hours_read ON public.business_hours
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS biz_hours_admin ON public.business_hours;
CREATE POLICY biz_hours_admin ON public.business_hours
  FOR ALL USING (fn_current_user_role() = 'super_admin');

-- Seed default Mon–Fri 09:00–18:00 for all existing regions
INSERT INTO public.business_hours (region_id)
SELECT id FROM public.regions
ON CONFLICT (region_id) DO NOTHING;

-- updated_at trigger
CREATE TRIGGER trg_biz_hours_updated_at
  BEFORE UPDATE ON public.business_hours
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── HOLIDAYS ─────────────────────────────────────────────────────────────────
-- Public holidays per region. SLA timers pause for full holiday days.

CREATE TABLE IF NOT EXISTS public.holidays (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     UUID        NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  holiday_date  DATE        NOT NULL,
  label         TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT holidays_region_date_uk UNIQUE (region_id, holiday_date)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS holidays_read ON public.holidays;
CREATE POLICY holidays_read ON public.holidays
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS holidays_admin ON public.holidays;
CREATE POLICY holidays_admin ON public.holidays
  FOR ALL USING (fn_current_user_role() = 'super_admin');

CREATE INDEX IF NOT EXISTS idx_holidays_region_date
  ON public.holidays (region_id, holiday_date);

-- ── ESCALATION EVENTS ────────────────────────────────────────────────────────
-- Immutable log of every escalation on a ticket. Supports loop cap (max 2).

CREATE TABLE IF NOT EXISTS public.escalation_events (
  id                     UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id              UUID              NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  escalated_from         UUID              REFERENCES public.users(id) ON DELETE SET NULL,
  escalated_to           UUID              REFERENCES public.users(id) ON DELETE SET NULL,
  escalation_type        TEXT              NOT NULL, -- 'ack_sla_miss' | 'res_sla_miss' | 'manager_inaction' | 'loop_detected'
  miss_duration_minutes  INTEGER,
  created_at             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT esc_miss_positive CHECK (miss_duration_minutes IS NULL OR miss_duration_minutes >= 0)
);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalations_read ON public.escalation_events;
CREATE POLICY escalations_read ON public.escalation_events
  FOR SELECT USING (
    fn_current_user_role() IN ('manager', 'super_admin')
    OR ticket_id IN (SELECT id FROM public.tickets)
  );
DROP POLICY IF EXISTS escalations_insert ON public.escalation_events;
CREATE POLICY escalations_insert ON public.escalation_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_escalations_ticket_created
  ON public.escalation_events (ticket_id, created_at DESC);

-- ── ADD LAST ESCALATED FIELD TO TICKETS ──────────────────────────────────────
-- Track when the last escalation happened to detect manager inaction (4h window).
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

-- ── CRON GUARD TABLE ─────────────────────────────────────────────────────────
-- Prevents overlapping cron runs. Stores last run timestamp per job.
CREATE TABLE IF NOT EXISTS public.cron_runs (
  job_name   TEXT        PRIMARY KEY,
  last_run   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_count INTEGER     NOT NULL DEFAULT 0
);

INSERT INTO public.cron_runs (job_name) VALUES ('sla-scan'), ('auto-close')
ON CONFLICT (job_name) DO NOTHING;
