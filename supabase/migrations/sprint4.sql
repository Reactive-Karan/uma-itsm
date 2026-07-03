-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Sprint 4 Migration
-- Run AFTER sprint2-sprint3-combined.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── AUDIT LOG ────────────────────────────────────────────────────────────────
-- Append-only, immutable record of all platform activity.
-- RULE-based protection is stronger than RLS alone.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  actor_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name  TEXT        NOT NULL DEFAULT 'System',
  actor_role  TEXT        NOT NULL DEFAULT 'system',
  entity_type TEXT        NOT NULL,
  entity_id   UUID        NOT NULL,
  entity_ref  TEXT        NOT NULL DEFAULT '',
  payload     JSONB       NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_log_event_not_empty  CHECK (event_type  <> ''),
  CONSTRAINT audit_log_entity_not_empty CHECK (entity_type <> '')
);

-- Append-only enforcement at database level (stronger than RLS)
CREATE OR REPLACE RULE audit_log_no_update
  AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_delete
  AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Super Admin: read-only (write is always via service role)
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log
  FOR SELECT USING (fn_current_user_role() = 'super_admin');

-- Any authenticated server-side insert (API routes use service role)
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (TRUE);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON public.audit_log (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type
  ON public.audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created
  ON public.audit_log (created_at DESC);

-- ── ADD read_at TO NOTIFICATIONS ──────────────────────────────────────────────
-- Tracks when a recipient has read an in-app notification.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Add policy for recipients to read their own notifications
DROP POLICY IF EXISTS notifications_recipient_read ON public.notifications;
CREATE POLICY notifications_recipient_read ON public.notifications
  FOR SELECT USING (recipient_id = fn_current_user_id());

-- Recipients can mark their own notifications as read
DROP POLICY IF EXISTS notifications_recipient_update ON public.notifications;
CREATE POLICY notifications_recipient_update ON public.notifications
  FOR UPDATE USING (recipient_id = fn_current_user_id())
  WITH CHECK (recipient_id = fn_current_user_id());

-- Index for unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL AND status = 'sent';

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
