# UMA ITSM

**IT Service Management Platform for UMA Group**

A mobile-first, enterprise-grade Progressive Web App (PWA) that replaces fragmented WhatsApp and email-based support channels with a centralised, SLA-driven, auditable service desk — deployed across ten African regional entities on a single shared platform.

---

## Overview

| Dimension | Detail |
|---|---|
| Platform | Next.js 15 · TypeScript · Tailwind CSS · Shadcn UI |
| Backend | Supabase (PostgreSQL 16 · Auth · Storage · Edge Functions) |
| Authentication | Google Workspace SSO (OAuth 2.0) |
| AI | OpenRouter (poolside/laguna-xs-2.1:free) |
| Email | SendGrid v3 REST API |
| Hosting | Vercel (with Cron Jobs) |
| PWA | Manual service worker · Web App Manifest · Installable |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Google Cloud](https://console.cloud.google.com) OAuth 2.0 client
- (Optional) [SendGrid](https://sendgrid.com) account for email delivery
- (Optional) [OpenRouter](https://openrouter.ai) key for AI features

### 1. Clone and install

```bash
git clone <repo-url>
cd uma-itsm
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your values — see `.env.local.example` for detailed instructions on where to find each key.

### 3. Set up the database

Run the migrations in order in your **Supabase SQL Editor**:

```
supabase/migrations/sprint1-users.sql        ← Run first (from auth setup guide)
supabase/migrations/sprint2-sprint3-combined.sql
supabase/migrations/sprint4.sql
supabase/migrations/sprint5.sql
```

Then grant yourself Super Admin access:

```sql
UPDATE public.users SET role = 'super_admin' WHERE email = 'your-email@gmail.com';
```

### 4. Configure Google OAuth

1. Google Cloud Console → Create OAuth 2.0 Web Client
2. Authorised redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-project>.supabase.co/auth/v1/callback`
3. Supabase → Auth → Providers → Google → paste Client ID + Secret

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Google Workspace account.

---

## Project Structure

```
uma-itsm/
├── src/
│   ├── app/                    # Next.js App Router pages + API routes
│   │   ├── (auth)/             # Login page
│   │   ├── requester/          # Requester role pages
│   │   ├── dept-user/          # Dept User role pages
│   │   ├── manager/            # Manager role pages
│   │   ├── admin/              # Super Admin pages
│   │   └── api/                # REST API route handlers
│   ├── features/               # Feature-based UI modules
│   │   ├── tickets/            # Ticket components (forms, cards, timeline)
│   │   ├── auth/               # Auth components (sign-in, profile menu)
│   │   ├── users/              # Role badge, user components
│   │   ├── notifications/      # Notification bell + inbox
│   │   └── pwa/                # PWA install banner, draft recovery
│   ├── services/               # Business logic (ticket, routing, escalation, audit, email)
│   ├── lib/
│   │   ├── supabase/           # Client, server, and proxy Supabase clients
│   │   ├── auth/               # Guards, role helpers, ApiResponse
│   │   ├── ticket/             # SLA engine (business-hours-aware)
│   │   └── email/              # HTML email templates (all 17 NR rules)
│   ├── stores/                 # Zustand stores (session, ticket draft)
│   └── types/                  # TypeScript types (database, user)
├── supabase/migrations/        # Ordered SQL migration files
├── tests/unit/                 # Vitest unit tests
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   └── icons/                  # PWA icons
└── vercel.json                 # Cron job configuration
```

---

## User Roles

| Role | Access | Key Capabilities |
|---|---|---|
| **Requester** | Own tickets only | Submit, track, comment, reopen |
| **Dept User** | Assigned + department | Acknowledge, update status, resolve, add internal notes |
| **Manager** | Full department | Reassign, override priority, manage escalations, view team workload |
| **Super Admin** | All regions + all tickets | User management, routing rules, SLA config, audit log, metrics |

---

## Key Features

### Ticket Lifecycle
Seven-state workflow: `New → Acknowledged → In Progress → Pending Requester → Escalated → Resolved → Closed`

### Routing Engine
Automatic single-owner assignment by request type + sub-type + region. OOO detection with backup assignee fallback. Self-assignment prevention.

### SLA Engine
Business-hours-aware deadline calculation per region timezone (IANA). Holiday exclusions. SLA pause on `Pending Requester` state. Acknowledgment SLA: 4 business hours. Resolution: 8h / 24h / 72h by priority.

### Escalation Engine
Automatic escalation when acknowledgment or resolution SLA is missed. Escalation loop cap (max 2 escalations → Super Admin takeover). Manager inaction detection (4h with no response → Super Admin alert).

### AI Features
- **Description Enhancement** — Rewrites vague descriptions into structured, actionable text
- **Smart Categorization** — Auto-suggests type, sub-type, and priority with confidence scores (debounced)
- **Duplicate Detection** — PostgreSQL full-text search surfaces similar open tickets before submission

### Notifications
17 named notification rules (NR-01 to NR-17). Branded HTML email templates via SendGrid. In-app notification inbox with unread count and mark-read support. Retry logic (max 3 attempts).

### Audit Log
Immutable, append-only log enforced by PostgreSQL database `RULE`s. All critical events captured with actor snapshot, before/after payload, and IP address. CSV export with date-range filter.

### PWA
Installable on desktop and mobile. Manual service worker with network-first caching for pages, cache-first for static assets. Offline fallback page. Ticket draft persistence in localStorage (24h TTL). Install prompt for Chrome/Android and iOS Safari instructions.

---

## API Routes

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/tickets` | Any | Submit a new ticket |
| `GET /api/tickets` | Any | List tickets (RLS-scoped) |
| `GET /api/tickets/[id]` | Any | Ticket detail |
| `PATCH /api/tickets/[id]/acknowledge` | Staff | Acknowledge + start resolution SLA |
| `PATCH /api/tickets/[id]/status` | Staff | Update status (state machine) |
| `PATCH /api/tickets/[id]/reassign` | Manager+ | Reassign to another Dept User |
| `POST /api/tickets/[id]/comments` | Any | Add public reply or internal note |
| `POST /api/ai/enhance-description` | Any | AI description improvement |
| `POST /api/ai/suggest-category` | Any | Type/priority suggestion |
| `POST /api/ai/check-duplicates` | Any | Similar ticket detection |
| `GET /api/admin/audit-log` | Super Admin | Paginated audit log |
| `GET /api/admin/audit-log/export` | Super Admin | CSV download |
| `GET /api/admin/metrics` | Super Admin | Cross-entity metrics |
| `GET /api/admin/search` | Super Admin | Full-text ticket search |
| `GET /api/notifications/inbox` | Any | In-app notifications |
| `POST /api/cron/sla-scan` | Cron | Detect + escalate SLA breaches |
| `POST /api/cron/auto-close` | Cron | Close resolved tickets after 72h |
| `POST /api/cron/notification-processor` | Cron | Process email queue via SendGrid |

---

## Cron Jobs (Vercel)

| Job | Schedule | Purpose |
|---|---|---|
| `/api/cron/notification-processor` | Every minute | Process pending email queue |
| `/api/cron/sla-scan` | Every 15 minutes | Detect SLA breaches and escalate |
| `/api/cron/auto-close` | Every hour | Auto-close resolved tickets at 72h |

Protected by `CRON_SECRET` header. Configure the same secret in your scheduler and in `.env.local`.

---

## Testing

```bash
# Run unit tests
npm run test:unit

# Watch mode
npm run test:watch
```

Tests cover the business-hours SLA engine (including timezone handling, holiday exclusions, weekday rollover) and ticket submission validation rules.

---

## Deployment

### Vercel (recommended)

1. Import this repository in the [Vercel dashboard](https://vercel.com)
2. Add all environment variables from `.env.local.example`
3. Vercel will automatically detect `vercel.json` and configure cron jobs
4. Add `https://<your-deployment-url>/auth/callback` to your Google OAuth client's authorised redirect URIs and to Supabase → Auth → URL Configuration

### Environment Variables

See `.env.local.example` for the full list with descriptions.

---

## Documentation

Full project documentation is in the `/docs` folder:

| File | Contents |
|---|---|
| `01-discovery-report.md` | Business analysis, gaps, risks, edge cases |
| `02-product-design.md` | Problem statement, personas, user journeys |
| `03-functional-specification.md` | User stories, acceptance criteria, business rules, SLA matrix |
| `04-architecture.md` | Architecture diagrams, folder structure, service layer design |
| `05-ux-design.md` | Screen inventory, wireframes, design system |
| `06-data-model.md` | ERD, full DDL, RLS policies, RBAC design |
| `07-ai-enhancements.md` | AI feature roadmap with technical approach |
| `08-development-plan.md` | Sprint-by-sprint implementation plan |

---

## License

Proprietary — UMA Group · Internal Assessment Project
