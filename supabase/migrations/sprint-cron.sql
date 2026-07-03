-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Supabase Cron Jobs
--
-- Run this in the Supabase SQL Editor to set up scheduled background jobs.
-- These replace Vercel Cron (which requires the Pro plan).
--
-- BEFORE RUNNING:
--   1. Enable extensions (run once):
--        CREATE EXTENSION IF NOT EXISTS pg_cron;
--        CREATE EXTENSION IF NOT EXISTS pg_net;
--      Alternatively, go to Supabase Dashboard → Database → Extensions
--      and enable "pg_cron" and "pg_net" from the UI.
--
--   2. Replace the two placeholder values below:
--        YOUR_APP_URL   → your deployed Vercel URL, e.g. https://uma-itsm.vercel.app
--        YOUR_CRON_SECRET → the same value as CRON_SECRET in your .env.local
--
-- TO VIEW RUNNING JOBS:
--        SELECT * FROM cron.job;
--
-- TO REMOVE A JOB:
--        SELECT cron.unschedule('job-name');
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Enable extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Step 2: Remove any existing jobs to avoid duplicates on re-run ────────────
SELECT cron.unschedule('uma-notification-processor') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uma-notification-processor');
SELECT cron.unschedule('uma-sla-scan')               WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uma-sla-scan');
SELECT cron.unschedule('uma-auto-close')             WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uma-auto-close');

-- ── Step 3: Schedule the three cron jobs ─────────────────────────────────────

-- ── Job 1: Notification Processor — every 1 minute ──────────────────────────
-- Picks up pending email notifications and delivers via SendGrid.
SELECT cron.schedule(
  'uma-notification-processor',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'YOUR_APP_URL/api/cron/notification-processor',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  'YOUR_CRON_SECRET'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ── Job 2: SLA Scan — every 15 minutes ───────────────────────────────────────
-- Detects acknowledgment and resolution SLA breaches.
-- Escalates overdue tickets to the Manager or Super Admin.
-- Also checks for manager inaction (>4h on escalated tickets).
SELECT cron.schedule(
  'uma-sla-scan',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := 'YOUR_APP_URL/api/cron/sla-scan',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  'YOUR_CRON_SECRET'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ── Job 3: Auto-Close — every hour ───────────────────────────────────────────
-- Automatically closes tickets that have been in Resolved status for 72+ hours
-- with no requester response. Sends NR-12 notification.
SELECT cron.schedule(
  'uma-auto-close',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'YOUR_APP_URL/api/cron/auto-close',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  'YOUR_CRON_SECRET'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ── Step 4: Verify jobs were created ─────────────────────────────────────────
SELECT jobname, schedule, active, jobid
FROM cron.job
WHERE jobname LIKE 'uma-%'
ORDER BY jobname;
