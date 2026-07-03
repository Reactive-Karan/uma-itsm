-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Combined Sprint 2 + Sprint 3 Migration
--
-- Run this ONCE in Supabase SQL Editor, AFTER the Sprint 1 users table setup.
-- This script is fully idempotent — safe to run again if it partially failed.
--
-- Fix: PostgreSQL does NOT support CREATE TYPE IF NOT EXISTS.
--      ENUMs are created using the DO $$ EXCEPTION pattern instead.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: ENUMs (safe idempotent creation) ─────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('requester', 'dept_user', 'manager', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.request_type AS ENUM ('it_service', 'data_service');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sub_type AS ENUM ('hardware', 'software', 'analysis', 'discrepancy', 'issues');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.priority AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM (
    'new', 'acknowledged', 'in_progress', 'pending_requester',
    'escalated', 'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.escalation_reason AS ENUM (
    'ack_sla_miss', 'res_sla_miss', 'manager_inaction', 'loop_detected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── STEP 2: HELPER FUNCTIONS ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_current_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_current_department_id()
RETURNS UUID AS $$
  SELECT department_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── STEP 3: REGIONS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.regions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  code       TEXT        NOT NULL UNIQUE,
  timezone   TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regions_read ON public.regions;
CREATE POLICY regions_read ON public.regions
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

INSERT INTO public.regions (name, code, timezone) VALUES
  ('East Africa — Nairobi',          'KE', 'Africa/Nairobi'),
  ('East Africa — Dar es Salaam',    'TZ', 'Africa/Dar_es_Salaam'),
  ('East Africa — Kampala',          'UG', 'Africa/Kampala'),
  ('West Africa — Lagos',            'NG', 'Africa/Lagos'),
  ('West Africa — Accra',            'GH', 'Africa/Accra'),
  ('North Africa — Casablanca',      'MA', 'Africa/Casablanca'),
  ('North Africa — Cairo',           'EG', 'Africa/Cairo'),
  ('Southern Africa — Johannesburg', 'ZA', 'Africa/Johannesburg'),
  ('Southern Africa — Harare',       'ZW', 'Africa/Harare'),
  ('Indian Ocean — Mauritius',       'MU', 'Indian/Mauritius')
ON CONFLICT (code) DO NOTHING;

-- ── STEP 4: DEPARTMENTS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.departments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  code       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS departments_read ON public.departments;
CREATE POLICY departments_read ON public.departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO public.departments (name, code) VALUES
  ('Hardware Support',  'HW_SUPPORT'),
  ('Software Support',  'SW_SUPPORT'),
  ('Data Analytics',    'DATA_ANALYTICS')
ON CONFLICT (code) DO NOTHING;

-- ── STEP 5: ADD REGION TO USERS (if not already present) ─────────────────────
-- Ensure the users table has region_id linking to regions.
-- This is idempotent — IF NOT EXISTS is safe for ALTER TABLE ADD COLUMN.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region_id     UUID REFERENCES public.regions(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ── STEP 6: ROUTING RULES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.routing_rules (
  id                  UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id           UUID               NOT NULL REFERENCES public.regions(id)  ON DELETE CASCADE,
  request_type        public.request_type NOT NULL,
  sub_type            public.sub_type     NOT NULL,
  primary_assignee_id UUID               NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  backup_assignee_id  UUID               REFERENCES public.users(id) ON DELETE SET NULL,
  is_active           BOOLEAN            NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT routing_rules_unique_combo UNIQUE (region_id, request_type, sub_type),
  CONSTRAINT routing_rules_no_self_backup CHECK (
    backup_assignee_id IS NULL OR backup_assignee_id <> primary_assignee_id
  ),
  CONSTRAINT routing_rules_valid_subtype CHECK (
    (request_type = 'it_service'   AND sub_type IN ('hardware', 'software')) OR
    (request_type = 'data_service' AND sub_type IN ('analysis', 'discrepancy', 'issues'))
  )
);

ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routing_read_admin ON public.routing_rules;
CREATE POLICY routing_read_admin ON public.routing_rules
  FOR SELECT USING (fn_current_user_role() = 'super_admin');
DROP POLICY IF EXISTS routing_modify_admin ON public.routing_rules;
CREATE POLICY routing_modify_admin ON public.routing_rules
  FOR ALL USING (fn_current_user_role() = 'super_admin');

DO $$ BEGIN
  CREATE TRIGGER trg_routing_updated_at
    BEFORE UPDATE ON public.routing_rules
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── STEP 7: TICKETS ───────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1 INCREMENT 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.tickets (
  id                 UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number      TEXT                  NOT NULL UNIQUE
                                            DEFAULT ('TKT-' || LPAD(nextval('ticket_seq')::TEXT, 4, '0')),
  requester_id       UUID                  NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assignee_id        UUID                  REFERENCES public.users(id) ON DELETE SET NULL,
  region_id          UUID                  NOT NULL REFERENCES public.regions(id) ON DELETE RESTRICT,
  department_id      UUID                  REFERENCES public.departments(id) ON DELETE SET NULL,
  title              TEXT                  NOT NULL,
  description        TEXT                  NOT NULL,
  request_type       public.request_type   NOT NULL,
  sub_type           public.sub_type       NOT NULL,
  priority           public.priority       NOT NULL,
  status             public.ticket_status  NOT NULL DEFAULT 'new',
  escalation_count   INTEGER               NOT NULL DEFAULT 0  CHECK (escalation_count >= 0),
  sla_ack_deadline   TIMESTAMPTZ,
  sla_res_deadline   TIMESTAMPTZ,
  sla_paused_at      TIMESTAMPTZ,
  sla_paused_minutes INTEGER               NOT NULL DEFAULT 0  CHECK (sla_paused_minutes >= 0),
  last_escalated_at  TIMESTAMPTZ,
  resolution_note    TEXT,
  resolved_at        TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  CONSTRAINT tickets_title_length CHECK (length(title) BETWEEN 10 AND 150),
  CONSTRAINT tickets_desc_length  CHECK (length(description) BETWEEN 20 AND 2000),
  CONSTRAINT tickets_resolution_required CHECK (
    status <> 'resolved' OR (resolution_note IS NOT NULL AND length(resolution_note) >= 10)
  ),
  CONSTRAINT tickets_valid_subtype CHECK (
    (request_type = 'it_service'   AND sub_type IN ('hardware', 'software')) OR
    (request_type = 'data_service' AND sub_type IN ('analysis', 'discrepancy', 'issues'))
  )
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_select_requester  ON public.tickets;
DROP POLICY IF EXISTS tickets_select_dept_user  ON public.tickets;
DROP POLICY IF EXISTS tickets_select_manager    ON public.tickets;
DROP POLICY IF EXISTS tickets_select_super_admin ON public.tickets;
DROP POLICY IF EXISTS tickets_insert            ON public.tickets;
DROP POLICY IF EXISTS tickets_update_staff      ON public.tickets;

CREATE POLICY tickets_select_requester ON public.tickets
  FOR SELECT USING (fn_current_user_role() = 'requester' AND requester_id = fn_current_user_id());

CREATE POLICY tickets_select_dept_user ON public.tickets
  FOR SELECT USING (
    fn_current_user_role() = 'dept_user'
    AND (assignee_id = fn_current_user_id() OR department_id = fn_current_department_id())
  );

CREATE POLICY tickets_select_manager ON public.tickets
  FOR SELECT USING (
    fn_current_user_role() = 'manager'
    AND department_id = fn_current_department_id()
  );

CREATE POLICY tickets_select_super_admin ON public.tickets
  FOR SELECT USING (fn_current_user_role() = 'super_admin');

CREATE POLICY tickets_insert ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND requester_id = fn_current_user_id());

CREATE POLICY tickets_update_staff ON public.tickets
  FOR UPDATE USING (
    (fn_current_user_role() = 'dept_user'    AND assignee_id   = fn_current_user_id()) OR
    (fn_current_user_role() = 'manager'      AND department_id = fn_current_department_id()) OR
    (fn_current_user_role() = 'super_admin') OR
    (fn_current_user_role() = 'requester'    AND requester_id  = fn_current_user_id())
  );

DO $$ BEGIN
  CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_requester_created  ON public.tickets (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_status    ON public.tickets (assignee_id, status, sla_ack_deadline ASC NULLS LAST) WHERE status NOT IN ('resolved','closed');
CREATE INDEX IF NOT EXISTS idx_tickets_dept_status        ON public.tickets (department_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status             ON public.tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_region_created     ON public.tickets (region_id, created_at DESC);

-- ── STEP 8: TICKET STATUS HISTORY ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_status_history (
  id          UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID                 NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_status public.ticket_status,
  to_status   public.ticket_status NOT NULL,
  changed_by  UUID                 NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason      TEXT,
  created_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tsh_select ON public.ticket_status_history;
CREATE POLICY tsh_select ON public.ticket_status_history
  FOR SELECT USING (ticket_id IN (SELECT id FROM public.tickets));
DROP POLICY IF EXISTS tsh_insert ON public.ticket_status_history;
CREATE POLICY tsh_insert ON public.ticket_status_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tsh_ticket_created ON public.ticket_status_history (ticket_id, created_at DESC);

-- ── STEP 9: TICKET COMMENTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  body        TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  is_internal BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_select ON public.ticket_comments;
CREATE POLICY comments_select ON public.ticket_comments
  FOR SELECT USING (
    (is_internal = FALSE AND ticket_id IN (SELECT id FROM public.tickets)) OR
    (is_internal = TRUE  AND fn_current_user_role() IN ('dept_user','manager','super_admin')
      AND ticket_id IN (SELECT id FROM public.tickets))
  );
DROP POLICY IF EXISTS comments_insert ON public.ticket_comments;
CREATE POLICY comments_insert ON public.ticket_comments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = fn_current_user_id()
    AND (is_internal = FALSE OR fn_current_user_role() IN ('dept_user','manager','super_admin'))
  );

DO $$ BEGIN
  CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON public.ticket_comments
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_comments_ticket_created ON public.ticket_comments (ticket_id, created_at ASC);

-- ── STEP 10: TICKET ATTACHMENTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  uploaded_by     UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  file_name       TEXT        NOT NULL,
  file_size_bytes INTEGER     NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  mime_type       TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attachments_select ON public.ticket_attachments;
CREATE POLICY attachments_select ON public.ticket_attachments
  FOR SELECT USING (ticket_id IN (SELECT id FROM public.tickets));
DROP POLICY IF EXISTS attachments_insert ON public.ticket_attachments;
CREATE POLICY attachments_insert ON public.ticket_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND uploaded_by = fn_current_user_id());

CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON public.ticket_attachments (ticket_id, created_at ASC);

-- ── STEP 11: NOTIFICATIONS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT                       NOT NULL,
  recipient_id      UUID                       REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email   TEXT                       NOT NULL,
  ticket_id         UUID                       REFERENCES public.tickets(id) ON DELETE CASCADE,
  subject           TEXT                       NOT NULL,
  body_html         TEXT                       NOT NULL DEFAULT '',
  status            public.notification_status NOT NULL DEFAULT 'pending',
  attempt_count     INTEGER                    NOT NULL DEFAULT 0 CHECK (attempt_count <= 3),
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_admin ON public.notifications;
CREATE POLICY notifications_admin ON public.notifications
  FOR SELECT USING (fn_current_user_role() = 'super_admin');
-- Service role inserts notifications server-side (bypasses RLS by design)

CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON public.notifications (created_at ASC)
  WHERE status = 'pending';

-- ── STEP 12: BUSINESS HOURS (Sprint 3) ───────────────────────────────────────

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
  CONSTRAINT biz_hours_valid_window CHECK (start_time < end_time),
  CONSTRAINT biz_hours_one_work_day CHECK (
    work_mon OR work_tue OR work_wed OR work_thu OR work_fri OR work_sat OR work_sun
  )
);

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biz_hours_read  ON public.business_hours;
CREATE POLICY biz_hours_read  ON public.business_hours FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS biz_hours_admin ON public.business_hours;
CREATE POLICY biz_hours_admin ON public.business_hours FOR ALL    USING (fn_current_user_role() = 'super_admin');

INSERT INTO public.business_hours (region_id)
SELECT id FROM public.regions
ON CONFLICT (region_id) DO NOTHING;

DO $$ BEGIN
  CREATE TRIGGER trg_biz_hours_updated_at
    BEFORE UPDATE ON public.business_hours
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── STEP 13: HOLIDAYS (Sprint 3) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.holidays (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     UUID        NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  holiday_date  DATE        NOT NULL,
  label         TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT holidays_region_date_uk UNIQUE (region_id, holiday_date)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS holidays_read  ON public.holidays;
CREATE POLICY holidays_read  ON public.holidays FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS holidays_admin ON public.holidays;
CREATE POLICY holidays_admin ON public.holidays FOR ALL    USING (fn_current_user_role() = 'super_admin');

CREATE INDEX IF NOT EXISTS idx_holidays_region_date ON public.holidays (region_id, holiday_date);

-- ── STEP 14: ESCALATION EVENTS (Sprint 3) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.escalation_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  escalated_from        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  escalated_to          UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  escalation_type       TEXT        NOT NULL,
  miss_duration_minutes INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT esc_miss_positive CHECK (miss_duration_minutes IS NULL OR miss_duration_minutes >= 0)
);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalations_read   ON public.escalation_events;
CREATE POLICY escalations_read ON public.escalation_events
  FOR SELECT USING (
    fn_current_user_role() IN ('manager','super_admin')
    OR ticket_id IN (SELECT id FROM public.tickets)
  );
DROP POLICY IF EXISTS escalations_insert ON public.escalation_events;
CREATE POLICY escalations_insert ON public.escalation_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_escalations_ticket_created ON public.escalation_events (ticket_id, created_at DESC);

-- ── STEP 15: CRON GUARD TABLE (Sprint 3) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cron_runs (
  job_name   TEXT        PRIMARY KEY,
  last_run   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_count INTEGER     NOT NULL DEFAULT 0
);

INSERT INTO public.cron_runs (job_name) VALUES ('sla-scan'), ('auto-close')
ON CONFLICT (job_name) DO NOTHING;

-- ── STEP 16: BACKFILL your own user with super_admin (if needed) ──────────────
-- If you already ran the Sprint 1 users backfill, skip this.
-- Uncomment and set your email to give yourself super_admin access:
--
-- UPDATE public.users SET role = 'super_admin' WHERE email = 'your-email@gmail.com';

-- ── DONE ─────────────────────────────────────────────────────────────────────
-- Verify everything was created:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
