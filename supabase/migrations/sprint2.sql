-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Sprint 2 Database Migration
-- Run this in Supabase SQL Editor AFTER the Sprint 1 users table setup.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ENUMs ────────────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS request_type AS ENUM ('it_service', 'data_service');
CREATE TYPE IF NOT EXISTS sub_type     AS ENUM ('hardware', 'software', 'analysis', 'discrepancy', 'issues');
CREATE TYPE IF NOT EXISTS priority     AS ENUM ('high', 'medium', 'low');
CREATE TYPE IF NOT EXISTS ticket_status AS ENUM (
  'new', 'acknowledged', 'in_progress', 'pending_requester',
  'escalated', 'resolved', 'closed'
);
CREATE TYPE IF NOT EXISTS notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE IF NOT EXISTS escalation_reason   AS ENUM (
  'ack_sla_miss', 'res_sla_miss', 'manager_inaction', 'loop_detected'
);

-- ── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

-- Returns the current user's role from the users table.
-- Used inside RLS policies so each policy doesn't need a sub-select.
CREATE OR REPLACE FUNCTION fn_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns the current user's internal UUID.
CREATE OR REPLACE FUNCTION fn_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns the current user's department_id.
CREATE OR REPLACE FUNCTION fn_current_department_id()
RETURNS UUID AS $$
  SELECT department_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-update updated_at on mutable tables.
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── REGIONS ──────────────────────────────────────────────────────────────────

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
  ('East Africa — Nairobi',         'KE', 'Africa/Nairobi'),
  ('East Africa — Dar es Salaam',   'TZ', 'Africa/Dar_es_Salaam'),
  ('East Africa — Kampala',         'UG', 'Africa/Kampala'),
  ('West Africa — Lagos',           'NG', 'Africa/Lagos'),
  ('West Africa — Accra',           'GH', 'Africa/Accra'),
  ('North Africa — Casablanca',     'MA', 'Africa/Casablanca'),
  ('North Africa — Cairo',          'EG', 'Africa/Cairo'),
  ('Southern Africa — Johannesburg','ZA', 'Africa/Johannesburg'),
  ('Southern Africa — Harare',      'ZW', 'Africa/Harare'),
  ('Indian Ocean — Mauritius',      'MU', 'Indian/Mauritius')
ON CONFLICT (code) DO NOTHING;

-- ── DEPARTMENTS ──────────────────────────────────────────────────────────────

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

-- ── ROUTING RULES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.routing_rules (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id           UUID         NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  request_type        request_type NOT NULL,
  sub_type            sub_type     NOT NULL,
  primary_assignee_id UUID         NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  backup_assignee_id  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
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

CREATE TRIGGER trg_routing_updated_at
  BEFORE UPDATE ON public.routing_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── TICKETS ──────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1 INCREMENT 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.tickets (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number      TEXT          NOT NULL UNIQUE
                                   DEFAULT ('TKT-' || LPAD(nextval('ticket_seq')::TEXT, 4, '0')),
  requester_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assignee_id        UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  region_id          UUID          NOT NULL REFERENCES public.regions(id) ON DELETE RESTRICT,
  department_id      UUID          REFERENCES public.departments(id) ON DELETE SET NULL,
  title              TEXT          NOT NULL,
  description        TEXT          NOT NULL,
  request_type       request_type  NOT NULL,
  sub_type           sub_type      NOT NULL,
  priority           priority      NOT NULL,
  status             ticket_status NOT NULL DEFAULT 'new',
  escalation_count   INTEGER       NOT NULL DEFAULT 0 CHECK (escalation_count >= 0),
  sla_ack_deadline   TIMESTAMPTZ,
  sla_res_deadline   TIMESTAMPTZ,
  sla_paused_at      TIMESTAMPTZ,
  sla_paused_minutes INTEGER       NOT NULL DEFAULT 0 CHECK (sla_paused_minutes >= 0),
  resolution_note    TEXT,
  resolved_at        TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
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

-- Requester: own tickets only
DROP POLICY IF EXISTS tickets_select_requester ON public.tickets;
CREATE POLICY tickets_select_requester ON public.tickets
  FOR SELECT USING (
    fn_current_user_role() = 'requester'
    AND requester_id = fn_current_user_id()
  );

-- Dept User: assigned + department
DROP POLICY IF EXISTS tickets_select_dept_user ON public.tickets;
CREATE POLICY tickets_select_dept_user ON public.tickets
  FOR SELECT USING (
    fn_current_user_role() = 'dept_user'
    AND (assignee_id = fn_current_user_id() OR department_id = fn_current_department_id())
  );

-- Manager: all dept tickets
DROP POLICY IF EXISTS tickets_select_manager ON public.tickets;
CREATE POLICY tickets_select_manager ON public.tickets
  FOR SELECT USING (
    fn_current_user_role() = 'manager'
    AND department_id = fn_current_department_id()
  );

-- Super Admin: everything
DROP POLICY IF EXISTS tickets_select_super_admin ON public.tickets;
CREATE POLICY tickets_select_super_admin ON public.tickets
  FOR SELECT USING (fn_current_user_role() = 'super_admin');

-- INSERT: any authenticated user can submit a ticket for themselves
DROP POLICY IF EXISTS tickets_insert ON public.tickets;
CREATE POLICY tickets_insert ON public.tickets
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND requester_id = fn_current_user_id()
  );

-- UPDATE: dept_user (own), manager (dept), super_admin (all), requester (own for close/reopen)
DROP POLICY IF EXISTS tickets_update_staff ON public.tickets;
CREATE POLICY tickets_update_staff ON public.tickets
  FOR UPDATE USING (
    (fn_current_user_role() = 'dept_user'    AND assignee_id = fn_current_user_id()) OR
    (fn_current_user_role() = 'manager'      AND department_id = fn_current_department_id()) OR
    (fn_current_user_role() = 'super_admin') OR
    (fn_current_user_role() = 'requester'    AND requester_id = fn_current_user_id())
  );

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_requester_created
  ON public.tickets (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_status
  ON public.tickets (assignee_id, status, sla_ack_deadline ASC NULLS LAST)
  WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS idx_tickets_dept_status
  ON public.tickets (department_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON public.tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_region_created
  ON public.tickets (region_id, created_at DESC);

-- ── TICKET STATUS HISTORY ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_status_history (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID          NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_status ticket_status,
  to_status   ticket_status NOT NULL,
  changed_by  UUID          NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason      TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tsh_select ON public.ticket_status_history;
CREATE POLICY tsh_select ON public.ticket_status_history
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM public.tickets)
  );
DROP POLICY IF EXISTS tsh_insert ON public.ticket_status_history;
CREATE POLICY tsh_insert ON public.ticket_status_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tsh_ticket_created
  ON public.ticket_status_history (ticket_id, created_at DESC);

-- ── TICKET COMMENTS ──────────────────────────────────────────────────────────

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

-- Public comments: visible to ticket owner; internal: staff only
DROP POLICY IF EXISTS comments_select ON public.ticket_comments;
CREATE POLICY comments_select ON public.ticket_comments
  FOR SELECT USING (
    (is_internal = FALSE AND ticket_id IN (SELECT id FROM public.tickets)) OR
    (is_internal = TRUE  AND fn_current_user_role() IN ('dept_user', 'manager', 'super_admin')
      AND ticket_id IN (SELECT id FROM public.tickets))
  );

DROP POLICY IF EXISTS comments_insert ON public.ticket_comments;
CREATE POLICY comments_insert ON public.ticket_comments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = fn_current_user_id()
    AND (is_internal = FALSE OR fn_current_user_role() IN ('dept_user', 'manager', 'super_admin'))
  );

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_comments_ticket_created
  ON public.ticket_comments (ticket_id, created_at ASC);

-- ── TICKET ATTACHMENTS ───────────────────────────────────────────────────────

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
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND uploaded_by = fn_current_user_id()
  );

CREATE INDEX IF NOT EXISTS idx_attachments_ticket
  ON public.ticket_attachments (ticket_id, created_at ASC);

-- ── NOTIFICATIONS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT               NOT NULL,
  recipient_id      UUID               REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email   TEXT               NOT NULL,
  ticket_id         UUID               REFERENCES public.tickets(id) ON DELETE CASCADE,
  subject           TEXT               NOT NULL,
  body_html         TEXT               NOT NULL DEFAULT '',
  status            notification_status NOT NULL DEFAULT 'pending',
  attempt_count     INTEGER            NOT NULL DEFAULT 0 CHECK (attempt_count <= 3),
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_admin ON public.notifications;
CREATE POLICY notifications_admin ON public.notifications
  FOR SELECT USING (fn_current_user_role() = 'super_admin');

CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON public.notifications (created_at ASC)
  WHERE status = 'pending';

-- ── STORAGE BUCKET (run separately if needed) ────────────────────────────────
-- To create the storage bucket, go to Storage in the Supabase dashboard and create:
--   Bucket name: ticket-attachments
--   Public: false
--   Max file size: 10485760 (10MB)
-- Then add these storage policies:
--   INSERT: (auth.uid() IS NOT NULL)
--   SELECT: Handled via signed URLs (no direct SELECT needed)
