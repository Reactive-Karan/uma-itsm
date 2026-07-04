-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Demo Data Seed
-- Run this in the Supabase SQL Editor (runs as postgres superuser — bypasses RLS)
--
-- PRE-REQUISITES:
--   1. All sprint migrations must be applied first.
--   2. Create 6 demo accounts in Supabase Dashboard →
--      Authentication → Users → Add user (Email + Password):
--
--        demo.requester@uma-itsm.demo     / UmaDemo@2026!   (Requester)
--        demo.deptuser@uma-itsm.demo      / UmaDemo@2026!   (Primary IT Agent — Chidi Nwosu)
--        demo.backup@uma-itsm.demo        / UmaDemo@2026!   (Backup IT Agent — Ngozi Adeyemi)
--        demo.dataanalyst@uma-itsm.demo   / UmaDemo@2026!   (Data Analytics Agent — Kwame Mensah)
--        demo.manager@uma-itsm.demo       / UmaDemo@2026!   (Manager)
--        demo.admin@uma-itsm.demo         / UmaDemo@2026!   (Super Admin)
--
--   NOTE: demo.backup and demo.dataanalyst are required for OOO routing,
--   backup assignee coverage, and the colleague picker in OOO settings.
--
-- IDEMPOTENT: safe to re-run — clears and rebuilds demo data each time.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 0: Ensure the users table exists and has open INSERT policy ──────────
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id             UUID        NOT NULL UNIQUE,
  email               TEXT        NOT NULL UNIQUE,
  full_name           TEXT        NOT NULL,
  role                public.user_role NOT NULL DEFAULT 'requester',
  region_id           UUID        REFERENCES public.regions(id)  ON DELETE SET NULL,
  department_id       UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
  is_ooo              BOOLEAN     NOT NULL DEFAULT FALSE,
  ooo_start_date      DATE,
  ooo_end_date        DATE,
  ooo_backup_user_id  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own profile + staff can read all
DROP POLICY IF EXISTS users_select_own   ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (
    auth_id = auth.uid()
    OR fn_current_user_role() IN ('dept_user', 'manager', 'super_admin')
  );

-- Service role inserts (API routes) and self-update
DROP POLICY IF EXISTS users_insert_open  ON public.users;
CREATE POLICY users_insert_open ON public.users
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE USING (
    auth_id = auth.uid()
    OR fn_current_user_role() = 'super_admin'
  );

-- Auto-update trigger
DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  -- auth IDs
  v_req_auth    UUID;
  v_dept_auth   UUID;
  v_backup_auth UUID;
  v_data_auth   UUID;
  v_mgr_auth    UUID;
  v_adm_auth    UUID;
  -- profile IDs
  v_req_id      UUID;
  v_dept_id     UUID;
  v_backup_id   UUID;
  v_data_id_usr UUID;
  v_mgr_id      UUID;
  v_adm_id      UUID;
  -- lookup IDs
  v_ke_id       UUID;
  v_ng_id       UUID;
  v_za_id       UUID;
  v_hw_id       UUID;
  v_sw_id       UUID;
  v_data_id     UUID;
  -- ticket ID vars
  v_tkt1        UUID;
  v_tkt2        UUID;
  v_tkt3        UUID;
  v_tkt4        UUID;
  v_tkt5        UUID;
  v_tkt6        UUID;
  v_tkt7        UUID;
BEGIN

  -- ── 1. Resolve auth.users IDs ───────────────────────────────────────────────
  SELECT id INTO v_req_auth    FROM auth.users WHERE email = 'demo.requester@uma-itsm.demo';
  SELECT id INTO v_dept_auth   FROM auth.users WHERE email = 'demo.deptuser@uma-itsm.demo';
  SELECT id INTO v_backup_auth FROM auth.users WHERE email = 'demo.backup@uma-itsm.demo';
  SELECT id INTO v_data_auth   FROM auth.users WHERE email = 'demo.dataanalyst@uma-itsm.demo';
  SELECT id INTO v_mgr_auth    FROM auth.users WHERE email = 'demo.manager@uma-itsm.demo';
  SELECT id INTO v_adm_auth    FROM auth.users WHERE email = 'demo.admin@uma-itsm.demo';

  IF v_req_auth    IS NULL THEN RAISE EXCEPTION 'demo.requester@uma-itsm.demo not in auth.users — add it via Supabase Dashboard → Authentication → Users'; END IF;
  IF v_dept_auth   IS NULL THEN RAISE EXCEPTION 'demo.deptuser@uma-itsm.demo not in auth.users — add it via Supabase Dashboard → Authentication → Users'; END IF;
  IF v_backup_auth IS NULL THEN RAISE EXCEPTION 'demo.backup@uma-itsm.demo not in auth.users — add it via Supabase Dashboard → Authentication → Users'; END IF;
  IF v_data_auth   IS NULL THEN RAISE EXCEPTION 'demo.dataanalyst@uma-itsm.demo not in auth.users — add it via Supabase Dashboard → Authentication → Users'; END IF;
  IF v_mgr_auth    IS NULL THEN RAISE EXCEPTION 'demo.manager@uma-itsm.demo not in auth.users — add it via Supabase Dashboard → Authentication → Users'; END IF;
  IF v_adm_auth    IS NULL THEN RAISE EXCEPTION 'demo.admin@uma-itsm.demo not in auth.users — add it via Supabase Dashboard → Authentication → Users'; END IF;

  -- ── 2. Resolve reference IDs ────────────────────────────────────────────────
  SELECT id INTO v_ke_id   FROM public.regions     WHERE code = 'KE';
  SELECT id INTO v_ng_id   FROM public.regions     WHERE code = 'NG';
  SELECT id INTO v_za_id   FROM public.regions     WHERE code = 'ZA';
  SELECT id INTO v_hw_id   FROM public.departments WHERE code = 'HW_SUPPORT';
  SELECT id INTO v_sw_id   FROM public.departments WHERE code = 'SW_SUPPORT';
  SELECT id INTO v_data_id FROM public.departments WHERE code = 'DATA_ANALYTICS';

  -- ── 3. Upsert demo user profiles ────────────────────────────────────────────
  INSERT INTO public.users (auth_id, email, full_name, role, region_id, department_id, is_active)
  VALUES (v_req_auth, 'demo.requester@uma-itsm.demo', 'Amara Osei', 'requester', v_ke_id, NULL, TRUE)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = 'Amara Osei', role = 'requester', region_id = v_ke_id, is_active = TRUE;
  SELECT id INTO v_req_id FROM public.users WHERE auth_id = v_req_auth;

  -- Primary IT/HW support agent
  INSERT INTO public.users (auth_id, email, full_name, role, region_id, department_id, is_active)
  VALUES (v_dept_auth, 'demo.deptuser@uma-itsm.demo', 'Chidi Nwosu', 'dept_user', v_ke_id, v_hw_id, TRUE)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = 'Chidi Nwosu', role = 'dept_user', region_id = v_ke_id, department_id = v_hw_id, is_active = TRUE;
  SELECT id INTO v_dept_id FROM public.users WHERE auth_id = v_dept_auth;

  -- Backup IT/HW+SW support agent (covers OOO for Chidi; can test backup routing)
  INSERT INTO public.users (auth_id, email, full_name, role, region_id, department_id, is_active)
  VALUES (v_backup_auth, 'demo.backup@uma-itsm.demo', 'Ngozi Adeyemi', 'dept_user', v_ke_id, v_hw_id, TRUE)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = 'Ngozi Adeyemi', role = 'dept_user', region_id = v_ke_id, department_id = v_hw_id, is_active = TRUE;
  SELECT id INTO v_backup_id FROM public.users WHERE auth_id = v_backup_auth;

  -- Primary Data Analytics agent (covers data_service tickets)
  INSERT INTO public.users (auth_id, email, full_name, role, region_id, department_id, is_active)
  VALUES (v_data_auth, 'demo.dataanalyst@uma-itsm.demo', 'Kwame Mensah', 'dept_user', v_ke_id, v_data_id, TRUE)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = 'Kwame Mensah', role = 'dept_user', region_id = v_ke_id, department_id = v_data_id, is_active = TRUE;
  SELECT id INTO v_data_id_usr FROM public.users WHERE auth_id = v_data_auth;

  INSERT INTO public.users (auth_id, email, full_name, role, region_id, department_id, is_active)
  VALUES (v_mgr_auth, 'demo.manager@uma-itsm.demo', 'Fatima Al-Rashid', 'manager', v_ke_id, v_hw_id, TRUE)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = 'Fatima Al-Rashid', role = 'manager', region_id = v_ke_id, department_id = v_hw_id, is_active = TRUE;
  SELECT id INTO v_mgr_id FROM public.users WHERE auth_id = v_mgr_auth;

  INSERT INTO public.users (auth_id, email, full_name, role, region_id, department_id, is_active)
  VALUES (v_adm_auth, 'demo.admin@uma-itsm.demo', 'Jomo Kariuki', 'super_admin', v_ke_id, NULL, TRUE)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = 'Jomo Kariuki', role = 'super_admin', region_id = v_ke_id, is_active = TRUE;
  SELECT id INTO v_adm_id FROM public.users WHERE auth_id = v_adm_auth;

  RAISE NOTICE '✓ Users: req=% dept=% backup=% data=% mgr=% adm=%',
    v_req_id, v_dept_id, v_backup_id, v_data_id_usr, v_mgr_id, v_adm_id;

  -- ── 4. Routing rules — with backup assignees ────────────────────────────────
  -- IT Hardware: primary = Chidi, backup = Ngozi
  -- IT Software: primary = Chidi, backup = Ngozi
  -- Data services: primary = Kwame, backup = Chidi (cross-cover)
  INSERT INTO public.routing_rules (region_id, request_type, sub_type, primary_assignee_id, backup_assignee_id, is_active)
  VALUES
    (v_ke_id, 'it_service',   'hardware',    v_dept_id,     v_backup_id,  TRUE),
    (v_ke_id, 'it_service',   'software',    v_dept_id,     v_backup_id,  TRUE),
    (v_ke_id, 'data_service', 'analysis',    v_data_id_usr, v_dept_id,    TRUE),
    (v_ke_id, 'data_service', 'discrepancy', v_data_id_usr, v_dept_id,    TRUE),
    (v_ke_id, 'data_service', 'issues',      v_data_id_usr, v_dept_id,    TRUE)
  ON CONFLICT (region_id, request_type, sub_type)
  DO UPDATE SET
    primary_assignee_id = EXCLUDED.primary_assignee_id,
    backup_assignee_id  = EXCLUDED.backup_assignee_id,
    is_active           = TRUE;

  RAISE NOTICE '✓ Routing rules seeded with backup assignees';

  -- ── 5. Clean demo tickets (idempotency) ─────────────────────────────────────
  -- Remove prior notifications and comments tied to demo tickets, then tickets.
  DELETE FROM public.notifications
  WHERE recipient_id IN (v_req_id, v_dept_id, v_mgr_id, v_adm_id);

  DELETE FROM public.ticket_comments
  WHERE ticket_id IN (SELECT id FROM public.tickets WHERE requester_id = v_req_id);

  DELETE FROM public.escalation_events
  WHERE ticket_id IN (SELECT id FROM public.tickets WHERE requester_id = v_req_id);

  DELETE FROM public.tickets WHERE requester_id = v_req_id;

  RAISE NOTICE '✓ Previous demo tickets cleared';

  -- ── 6. Demo tickets ─────────────────────────────────────────────────────────

  -- TKT-A: New — unassigned, just submitted
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, NULL, v_ke_id, v_hw_id,
    'Laptop screen flickering intermittently during video calls',
    'My laptop screen has been flickering since Monday morning. It happens every 10 to 15 minutes and lasts about 30 seconds each time. I have already tried restarting the laptop and checking the display cable connection but the issue persists. This is affecting my ability to join video calls and present to clients.',
    'it_service', 'hardware', 'medium', 'new',
    NOW() + INTERVAL '6 hours', NOW() + INTERVAL '24 hours',
    NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'
  ) RETURNING id INTO v_tkt1;

  -- TKT-B: In Progress — assigned to dept_user, SLA ticking
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, v_dept_id, v_ke_id, v_hw_id,
    'Microsoft Teams crashes after KB5040529 Windows update',
    'After the Windows security update applied on Friday, Microsoft Teams fails to load completely. It shows a white screen for about two minutes and then crashes with no error message. I have uninstalled and reinstalled Teams twice without success. All other Microsoft Office apps are working normally. I rely on Teams for my daily standups and client meetings.',
    'it_service', 'software', 'high', 'in_progress',
    NOW() - INTERVAL '1 hour', NOW() + INTERVAL '7 hours',
    NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour'
  ) RETURNING id INTO v_tkt2;

  -- TKT-C: Pending Requester — waiting on the user for more info
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, v_dept_id, v_ke_id, v_sw_id,
    'Cannot access ERP system — stuck in password reset loop',
    'When I try to log into Dynamics 365 I am sent to a password reset page. After completing the reset it sends me back to the exact same page in a continuous loop. This has been happening since yesterday afternoon. I need access urgently as month-end reconciliation reports are due this Friday.',
    'it_service', 'software', 'high', 'pending_requester',
    NOW() - INTERVAL '3 hours', NOW() + INTERVAL '5 hours',
    NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours'
  ) RETURNING id INTO v_tkt3;

  -- TKT-D: Escalated — SLA breached, needs manager attention
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    escalation_count, last_escalated_at,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, v_dept_id, v_ke_id, v_data_id,
    'Q2 2026 sales data missing from Power BI executive dashboard',
    'The Power BI executive dashboard is not showing any Q2 2026 data. The ETL pipeline appears to have completed successfully based on the logs but no data is visible in the report. The CIO presentation is in 48 hours and this is blocking our regional performance review. It affects the Kenya, Nigeria and South Africa entity views.',
    'data_service', 'discrepancy', 'high', 'escalated',
    1, NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '8 hours', NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '12 hours', NOW() - INTERVAL '4 hours'
  ) RETURNING id INTO v_tkt4;

  -- TKT-E: Resolved
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    resolution_note, resolved_at,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, v_dept_id, v_ke_id, v_hw_id,
    'External monitor not detected via Dell docking station',
    'My Dell WD19 docking station stopped recognising my external monitor after I moved to a new desk. The monitor works fine when connected directly via HDMI. I have tried different DisplayPort and HDMI cables from the docking station without success.',
    'it_service', 'hardware', 'medium', 'resolved',
    'Replaced the DisplayPort cable on the docking station. The original cable had a bent pin that was not visible to the naked eye. Tested with two external monitors — both are now detected correctly and the docking station is fully functional.',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days'
  ) RETURNING id INTO v_tkt5;

  -- TKT-F: Closed
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    resolution_note, resolved_at, closed_at,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, v_dept_id, v_ke_id, v_hw_id,
    'USB keyboard and mouse unresponsive after laptop sleep mode',
    'My USB keyboard and mouse stop responding every time my laptop wakes from sleep mode. I have to physically unplug and replug both devices each time. This has been happening for about two weeks and is causing significant workflow disruption.',
    'it_service', 'hardware', 'low', 'closed',
    'Disabled USB selective suspend in Windows Power Settings (Control Panel → Power Options → Change Plan Settings → Change Advanced Power Settings → USB Settings). Confirmed with the user over three days — issue has not recurred.',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '12 days', NOW() - INTERVAL '7 days'
  ) RETURNING id INTO v_tkt6;

  -- TKT-G: New — data service request (a second open ticket)
  INSERT INTO public.tickets (
    requester_id, assignee_id, region_id, department_id,
    title, description, request_type, sub_type, priority, status,
    sla_ack_deadline, sla_res_deadline, created_at, updated_at
  ) VALUES (
    v_req_id, NULL, v_ke_id, v_data_id,
    'Monthly GL reconciliation report needed for June 2026',
    'I need the automated monthly GL reconciliation report for the Kenya entity for June 2026. The report should include all general ledger account balances, intercompany transaction details, and variance analysis compared to May 2026 actuals. This is required as an input for the board pack due next Friday morning.',
    'data_service', 'analysis', 'medium', 'new',
    NOW() + INTERVAL '12 hours', NOW() + INTERVAL '48 hours',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'
  ) RETURNING id INTO v_tkt7;

  RAISE NOTICE '✓ Demo tickets seeded: tkt1=% tkt2=% tkt3=% tkt4=%', v_tkt1, v_tkt2, v_tkt3, v_tkt4;

  -- ── 7. Ticket comments / activity ───────────────────────────────────────────

  -- TKT-B (in_progress): dept_user reply to requester
  INSERT INTO public.ticket_comments (ticket_id, author_id, body, is_internal, created_at)
  VALUES (
    v_tkt2, v_dept_id,
    'Hi Amara, I have been able to reproduce the issue on a test machine. It appears to be caused by a compatibility conflict between KB5040529 and the Teams installer cache directory. I am clearing the cache and will test a clean reinstall. I will update you shortly.',
    FALSE, NOW() - INTERVAL '2 hours'
  );

  -- TKT-B: internal note (not visible to requester)
  INSERT INTO public.ticket_comments (ticket_id, author_id, body, is_internal, created_at)
  VALUES (
    v_tkt2, v_mgr_id,
    'Note: KB5040529 is causing widespread Teams failures across three entities. Chidi, coordinate with the NG team who reported the same yesterday. Consider issuing a department advisory with the manual workaround while the permanent fix is tested.',
    TRUE, NOW() - INTERVAL '90 minutes'
  );

  -- TKT-C (pending_requester): dept_user asks for more info
  INSERT INTO public.ticket_comments (ticket_id, author_id, body, is_internal, created_at)
  VALUES (
    v_tkt3, v_dept_id,
    'Hi Amara, I have checked your account in Dynamics 365 admin. Could you please confirm: (1) Are you using SSO or a direct login? (2) Does this happen on all browsers or just one? (3) Have you tried clearing browser cookies and cache? This information will help me pinpoint the exact reset loop cause.',
    FALSE, NOW() - INTERVAL '3 hours'
  );

  -- TKT-D (escalated): manager escalation comment
  INSERT INTO public.ticket_comments (ticket_id, author_id, body, is_internal, created_at)
  VALUES (
    v_tkt4, v_mgr_id,
    'Escalated to my attention due to SLA breach and business criticality. Chidi, this is your top priority today. Check the pipeline run logs for job ID P2-2026-Q2 and coordinate directly with the BI team. Update the ticket every 2 hours until resolved.',
    TRUE, NOW() - INTERVAL '4 hours'
  );

  -- TKT-D: Chidi's reply on escalated ticket
  INSERT INTO public.ticket_comments (ticket_id, author_id, body, is_internal, created_at)
  VALUES (
    v_tkt4, v_dept_id,
    'Acknowledged. I have identified the root cause: the Q2 partition in the data warehouse was not refreshed because the pipeline failed silently at the transformation step. Manual refresh is underway now. ETA for data to appear in Power BI: 2 hours.',
    FALSE, NOW() - INTERVAL '3 hours'
  );

  -- TKT-E (resolved): resolution confirmation
  INSERT INTO public.ticket_comments (ticket_id, author_id, body, is_internal, created_at)
  VALUES (
    v_tkt5, v_dept_id,
    'Issue resolved. The DisplayPort cable had a bent pin that was causing intermittent connection drops. Replaced with a new cable from the IT stockroom and tested both of your external monitors — both are working correctly. Please let me know if you experience any further issues.',
    FALSE, NOW() - INTERVAL '2 days'
  );

  RAISE NOTICE '✓ Demo comments seeded';

  -- ── 8. Notifications for the Requester ────────────────────────────────────
  -- (Giving a realistic mix of read and unread notifications)

  INSERT INTO public.notifications (notification_type, recipient_id, recipient_email, ticket_id, subject, body_html, status, read_at)
  VALUES
    -- Read: ticket received for TKT-A
    ('ticket_received', v_req_id, 'demo.requester@uma-itsm.demo', v_tkt1,
     'Your ticket has been received',
     '<p>Hi Amara,</p><p>Your service request has been logged and is being reviewed. You will be notified once a team member picks it up.</p>',
     'sent', NOW() - INTERVAL '25 minutes'),

    -- Read: TKT-B assigned and in progress
    ('ticket_in_progress', v_req_id, 'demo.requester@uma-itsm.demo', v_tkt2,
     'Your ticket is now in progress',
     '<p>Hi Amara,</p><p>Chidi Nwosu has picked up your Teams issue and is actively working on it. You will be updated shortly.</p>',
     'sent', NOW() - INTERVAL '2 hours'),

    -- UNREAD: TKT-C pending action from requester
    ('pending_requester', v_req_id, 'demo.requester@uma-itsm.demo', v_tkt3,
     'Your input is needed on ticket',
     '<p>Hi Amara,</p><p>Chidi Nwosu has replied to your ERP ticket and needs some additional information before they can continue. Please check the ticket and reply at your earliest convenience.</p>',
     'sent', NULL),

    -- UNREAD: TKT-D escalated
    ('ticket_escalated_req', v_req_id, 'demo.requester@uma-itsm.demo', v_tkt4,
     'Your ticket has been escalated',
     '<p>Hi Amara,</p><p>Your Power BI report ticket has been escalated to the team manager due to an SLA deadline being missed. We sincerely apologise for the delay. The team is working on this as the top priority.</p>',
     'sent', NULL),

    -- Read: TKT-E resolved
    ('ticket_resolved', v_req_id, 'demo.requester@uma-itsm.demo', v_tkt5,
     'Your ticket has been resolved',
     '<p>Hi Amara,</p><p>Your docking station issue has been resolved. Please review the resolution note and confirm if everything is working as expected.</p>',
     'sent', NOW() - INTERVAL '2 days');

  -- Notification for dept_user (new ticket assigned)
  INSERT INTO public.notifications (notification_type, recipient_id, recipient_email, ticket_id, subject, body_html, status, read_at)
  VALUES
    ('ticket_received', v_dept_id, 'demo.deptuser@uma-itsm.demo', v_tkt1,
     'New ticket assigned to your queue',
     '<p>Hi Chidi,</p><p>A new IT hardware ticket has been routed to you. Please review and acknowledge within the SLA window.</p>',
     'sent', NULL),
    ('ticket_received', v_dept_id, 'demo.deptuser@uma-itsm.demo', v_tkt7,
     'New data service request in your queue',
     '<p>Hi Chidi,</p><p>A new data analysis request has been submitted for the Kenya entity. Please review and acknowledge.</p>',
     'sent', NULL);

  -- Notification for manager (escalation)
  INSERT INTO public.notifications (notification_type, recipient_id, recipient_email, ticket_id, subject, body_html, status, read_at)
  VALUES
    ('ticket_escalated_mgr', v_mgr_id, 'demo.manager@uma-itsm.demo', v_tkt4,
     'Ticket escalated to your attention — SLA breach',
     '<p>Hi Fatima,</p><p>Ticket for "Q2 2026 sales data missing from Power BI" has been escalated to you after the resolution SLA was missed. Please review and take action immediately.</p>',
     'sent', NULL);

  RAISE NOTICE '✓ Demo notifications seeded';

  -- ── 9. Escalation event for TKT-D ──────────────────────────────────────────
  INSERT INTO public.escalation_events (ticket_id, escalated_from, escalated_to, escalation_type, miss_duration_minutes, created_at)
  VALUES (v_tkt4, v_dept_id, v_mgr_id, 'res_sla_miss', 120, NOW() - INTERVAL '4 hours');

  RAISE NOTICE '✓ Escalation event seeded';

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  SEED COMPLETE — all 4 demo roles are ready to use';
  RAISE NOTICE '  Requester : Amara Osei      (demo.requester@uma-itsm.demo)';
  RAISE NOTICE '  Dept User : Chidi Nwosu     (demo.deptuser@uma-itsm.demo)';
  RAISE NOTICE '  Manager   : Fatima Al-Rashid(demo.manager@uma-itsm.demo)';
  RAISE NOTICE '  Super Admin: Jomo Kariuki   (demo.admin@uma-itsm.demo)';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';

END $$;

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT
  u.full_name,
  u.email,
  u.role,
  r.code  AS region,
  d.name  AS department,
  u.is_active
FROM  public.users u
LEFT  JOIN public.regions     r ON r.id = u.region_id
LEFT  JOIN public.departments d ON d.id = u.department_id
WHERE u.email LIKE '%@uma-itsm.demo'
ORDER BY u.role;

SELECT COUNT(*) AS demo_tickets FROM public.tickets
WHERE requester_id IN (SELECT id FROM public.users WHERE email LIKE '%@uma-itsm.demo');

SELECT COUNT(*) AS demo_notifications FROM public.notifications
WHERE recipient_id IN (SELECT id FROM public.users WHERE email LIKE '%@uma-itsm.demo');
