# MediKlaim MDS

**Sistem Tuntutan Perubatan Majlis Daerah Setiu**

Full-stack medical claims management system for Malaysian local government staff. Handles the complete lifecycle from receipt upload through AI-assisted OCR extraction, multi-step approval workflow, and payment tracking — with audit trails, real-time notifications, and a comprehensive admin panel.

---

## Features

### Claims & Receipts

- **Receipt upload** — photo or PDF, SHA-256 dedup, per-receipt beneficiary (self / spouse / child), size limit configurable from DB
- **AI OCR extraction** — Ollama (local) or Gemini; extracts vendor, date, line items, total; all settings DB-configurable
- **AI eligibility reasoning** — second-pass LLM flags non-medical items after blacklist check
- **OCR confidence indicator** — visual warning when AI confidence is below DB-configured threshold
- **Multi-step approval workflow** — DRAFT → SUBMITTED → HEAD → FINANCE → APPROVER → PAID
- **Claim resubmission** — rejected claims can be amended and resubmitted with full history link
- **Annual allocation tracking** — per-user MYR limit with pro-rata support for mid-year joiners
- **Claim for dependants** — mark each receipt for self, spouse, or child (with child number)
- **Voucher number recording** — finance records payment voucher no. at PAID step
- **Approval timeline** — full step history with actor, timestamp, and comment on claim detail page

### Approval & Workflow

- **6-role access model** — CLAIMANT, HEAD, FINANCE, APPROVER, YDP, ADMIN
- **Approval delegation** — admins can delegate approval authority for a date range
- **SLA tracking** — configurable per-step deadlines with cron-based reminders
- **SLA overdue dashboard widget** — role-aware red banner shows overdue counts on login
- **Bulk mark-as-paid** — finance can mark multiple claims paid in one action
- **Bulk export** — checkbox selection in claim lists, export to Excel or PDF (summary + cover sheets)
- **Comments** — approvers can leave notes on any claim (all add/delete actions audit-logged)
- **Claim withdrawal** — claimants can retract submitted claims before approval

### Search & Navigation

- **Global search** — full-text search across claims, receipts, users (admin), audit log (admin); role-scoped results; keyboard shortcut; GIN-indexed on PostgreSQL

### Notifications

- **Real-time in-app** — SSE stream, live unread badge, sonner toast pop-ups on approval events
- **Email** — SMTP, triggered on status changes; SMTP connection testable from admin panel
- **WhatsApp** — Evolution API integration with rate limiting, quiet hours, per-day cap; connection test and test message send from admin panel
- **WhatsApp outbox** — admin page (`/admin/whatsapp`) showing sent/pending/failed queue with status filter and pagination

### Reports & Export

- **Excel export** — full claim listing with year/month/status/department filters
- **PDF audit report** — landscape A4, signature block, per-department breakdown
- **PDF cover sheets** — bulk per-claim cover sheets for finance filing
- **PDPA data export** — admin can export all user/claim/receipt data as JSON for PDPA compliance
- **Audit log CSV export** — filtered export matching current filter state, streamed in 1 000-row chunks, 50 000-row cap

### Security

- **TOTP two-factor authentication** — self-enrolment in profile, QR scan, 8 single-use recovery codes, disable with code confirmation
- **2FA enforcement** — admin can require 2FA for all ADMIN-role users; layout gate redirects to profile
- **Password expiry** — configurable expiry period (days); expired users redirected to `/profil` with banner
- **Login lockout** — configurable max attempts and lockout duration, DB-driven
- **Password policy** — min length, uppercase, number, symbol; enforced server-side on all change paths; hints shown in UI
- **Session timeout** — DB-configured expiry with idle-detection hook and warning modal before logout
- **Rate limiting** — sliding window per-IP: 30 req/min on `/api/search`, 10 req/min on export routes
- **Audit log** — every create/update/approve/reject/delete action recorded with IP, actor, meta
- **Audit log retention** — configurable `log_retention_years`; cron purge job at `/api/cron/purge-audit`
- **Audit log filter + export** — filter by action, entity, actor, date range; paginated; CSV export
- **Pending 2FA token** — stateless HMAC-SHA256, 5-minute TTL, timing-safe verification
- **Cron endpoint protection** — all cron routes accept `Authorization: Bearer` header (query-string fallback kept for backwards compat)

### Admin Panel (10 tabs)

| Tab | Controls |
|-----|----------|
| Am | Organisation name |
| Peruntukan | Default annual limit, pro-rata toggle |
| Peraturan | Claim cutoff days, receipt max age, SLA days |
| Kalendar | Public holidays |
| Blacklist | Non-eligible item keywords |
| Notifikasi | WhatsApp toggle, rate limits, quiet hours, WA connection test, WA test send, SMTP test |
| AI / OCR | Provider (Ollama/Gemini), model, confidence threshold, timeout, retry; live test extract |
| Keselamatan | Login lockout, session timeout, password policy, password expiry, 2FA enforcement, upload size limit |
| Sistem | Maintenance mode, PDPA export, system stats (DB size, storage, counts), log retention |
| Ref No | Claim reference number prefix, padding, counter, live preview |

### Dashboard (management view)

- Personal allocation bar + usage percentage
- Pending actions card (role-aware: HEAD / FINANCE / APPROVER)
- SLA overdue alert banner
- Personal monthly spending chart + personal status breakdown chart
- System-wide monthly trend + status breakdown (FINANCE / APPROVER / YDP / ADMIN)
- Per-department claim breakdown horizontal bar chart (FINANCE / APPROVER / YDP / ADMIN)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma 7 |
| Auth | Auth.js v5 (NextAuth) — JWT strategy, Credentials provider |
| UI | shadcn/ui + Tailwind CSS v4 + Radix UI |
| Charts | Recharts |
| PDF | @react-pdf/renderer |
| Excel | ExcelJS |
| OCR / AI | Ollama (local) or Google Gemini |
| 2FA | otplib (RFC 6238 TOTP) + qrcode |
| WhatsApp | Evolution API |
| Email | Nodemailer (SMTP) |
| Cron | node-cron |
| Deployment | Coolify (self-hosted) |

---

## Roles

| Role | Description |
|------|-------------|
| `CLAIMANT` | Submit claims, upload receipts, view own history |
| `HEAD` | First approval — department head |
| `FINANCE` | Finance review — verify amounts, mark paid |
| `APPROVER` | Final approval |
| `YDP` | Yang DiPertua — view reports and summaries |
| `ADMIN` | Full system access, user and settings management |

A user can hold multiple roles simultaneously.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- (Optional) Ollama running locally with a vision model

### Setup

```bash
git clone <repo>
cd medclaim
npm install
cp .env.example .env
# fill in .env
npx prisma migrate deploy
npx prisma generate
npm run seed
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Secret for JWT signing and HMAC tokens (min 32 chars) |
| `NEXTAUTH_URL` | ✅ | App base URL (e.g. `https://mediklaim.mds.gov.my`) |
| `AI_PROVIDER` | ✅ | `ollama`, `gemini`, or `manual` |
| `OLLAMA_BASE_URL` | if Ollama | Ollama API base URL |
| `OLLAMA_MODEL` | if Ollama | Vision model name (e.g. `qwen2.5vl:7b`) |
| `OLLAMA_REASONING_MODEL` | optional | Text model for eligibility reasoning (falls back to `OLLAMA_MODEL`) |
| `GEMINI_API_KEY` | if Gemini | Google Gemini API key |
| `SMTP_HOST` | ✅ | SMTP server hostname |
| `SMTP_PORT` | ✅ | SMTP port |
| `SMTP_SECURE` | optional | `true` for TLS (default `false`) |
| `SMTP_USER` | ✅ | SMTP username |
| `SMTP_PASS` | ✅ | SMTP password |
| `SMTP_FROM_NAME` | optional | Display name for outgoing email |
| `WA_ENABLED` | optional | `true` to enable WhatsApp via Evolution API |
| `EVOLUTION_BASE_URL` | if WA | Evolution API base URL |
| `EVOLUTION_INSTANCE` | if WA | Evolution API instance name |
| `EVOLUTION_API_KEY` | if WA | Evolution API key |
| `CRON_SECRET` | ✅ | Bearer token for cron endpoint protection |
| `DEFAULT_ANNUAL_LIMIT` | optional | Default MYR limit if DB setting absent (default `1200`) |
| `TZ` | ✅ | Timezone (e.g. `Asia/Kuala_Lumpur`) |

---

## Cron Jobs

All cron endpoints require `Authorization: Bearer <CRON_SECRET>` (or `?token=<CRON_SECRET>` fallback).

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/cron/reminder` | Daily | Send SLA reminder notifications |
| `GET /api/cron/wa-worker` | Every 5 min | Flush WhatsApp outbox queue |
| `GET /api/cron/reset-allocation` | 1 Jan annually | Create annual allocation records |
| `GET /api/cron/purge-audit` | Monthly | Delete audit logs older than `log_retention_years` |

---

## Database Scripts

```bash
npm run db:migrate    # Create and apply a new migration (dev)
npm run db:studio     # Open Prisma Studio
npm run seed          # Seed default admin user and settings
```

---

## Deployment (Coolify)

1. Add all environment variables from `.env.example`
2. Build command: `npm run build`
3. Start command: `npx prisma migrate deploy && npm start`
4. PostgreSQL can be provisioned directly in Coolify
5. Mount a storage volume at `/app/storage` for uploaded receipts
6. Wire cron jobs via Coolify's scheduler or an external cron, authenticated with the `Authorization: Bearer` header

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, forgot password, reset password
│   ├── (app)/           # Authenticated app shell + layout gates
│   │   ├── dashboard/   # Personal + management charts, SLA banner
│   │   ├── tuntutan/    # Claims list + detail + approval timeline
│   │   ├── resit/       # Receipt management
│   │   ├── sokongan/    # HEAD approval queue
│   │   ├── semakan/     # FINANCE review queue
│   │   ├── kelulusan/   # APPROVER / YDP approval queue
│   │   ├── laporan/     # Reports with filter + export
│   │   ├── analitik/    # System-wide analytics charts
│   │   ├── notifikasi/  # In-app notification list
│   │   ├── profil/      # Profile + 2FA enrolment + password change
│   │   └── admin/       # Users, departments, delegations, audit log, WA outbox, settings
│   └── api/             # OCR background, file serve, cron, exports, search, SSE, PDPA
├── components/          # Shared UI components (sidebar, search, modals, charts)
├── hooks/               # useSessionTimeout, useNotifications
├── jobs/                # Cron job implementations (reminders, allocation, WA queue, audit purge)
├── lib/                 # Auth, DB, audit, TOTP, permissions, SLA, rate-limit, password policy
└── server/
    └── actions/         # Server actions (claims, receipts, admin, totp, profile)
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

---

## Claim Workflow

```
DRAFT → SUBMITTED → HEAD_APPROVED → FINANCE_REVIEWED → APPROVED → PAID
                                                      ↘ REJECTED → (resubmit as new claim)
              WITHDRAWN (claimant retracts before HEAD approval)
```

---

## License

Internal system — Majlis Daerah Setiu. Not for public distribution.
