# MediKlaim MDS

**Sistem Tuntutan Perubatan Majlis Daerah Setiu**

A full-stack medical claims management system for Malaysian local government staff. Handles the complete lifecycle from receipt upload through AI-assisted OCR extraction, multi-step approval workflow, and payment tracking — with audit trails, notifications, and a comprehensive admin panel.

---

## Features

### Claims & Receipts
- **Receipt upload** — photo or PDF, SHA-256 dedup, per-receipt beneficiary (self / spouse / child)
- **AI OCR extraction** — Ollama (local) or Gemini; extracts vendor, date, line items, total
- **AI eligibility reasoning** — second-pass LLM flags non-medical items after blacklist check
- **OCR confidence indicator** — visual warning when AI confidence is below threshold
- **Multi-step approval workflow** — DRAFT → SUBMITTED → HEAD → FINANCE → APPROVER → PAID
- **Claim resubmission** — rejected claims can be amended and resubmitted with full history link
- **Annual allocation tracking** — per-user MYR limit with pro-rata support for mid-year joiners
- **Claim for dependants** — mark each receipt for self, spouse, or child (with child number)
- **Voucher number recording** — finance records payment voucher no. at PAID step

### Approval & Workflow
- **6-role access model** — CLAIMANT, HEAD, FINANCE, APPROVER, YDP, ADMIN
- **Approval delegation** — admins can delegate approval authority for a date range
- **SLA tracking** — configurable per-step deadlines with cron-based reminders
- **Comments** — approvers can leave notes on any claim
- **Claim withdrawal** — claimants can retract submitted claims before approval

### Notifications
- **In-app notifications** — unread badge, mark all read
- **Email** — SMTP, triggered on status changes
- **WhatsApp** — Evolution API integration with rate limiting and quiet hours

### Reports & Export
- **Excel export** — full claim listing with filters
- **PDF audit report** — landscape A4, signature block, per-department breakdown
- **PDPA data export** — admin can export user data in compliance with PDPA

### Security
- **TOTP two-factor authentication** — self-enrolment in profile, QR scan, 8 single-use recovery codes
- **2FA enforcement** — admin can require 2FA for all ADMIN-role users
- **Login lockout** — configurable max attempts and lockout duration
- **Password policy** — min length, uppercase, number, symbol requirements
- **Audit log** — every create/update/approve/reject/delete action recorded
- **Pending 2FA token** — stateless HMAC-SHA256, 5-minute TTL, timing-safe verification

### Admin Panel (10 tabs)
| Tab | Controls |
|-----|----------|
| Am | Organisation name |
| Peruntukan | Default annual limit, pro-rata toggle |
| Peraturan | Claim cutoff days, receipt max age, SLA days |
| Kalendar | Public holidays |
| Blacklist | Non-eligible item keywords |
| Notifikasi | WhatsApp toggle, rate limits, quiet hours |
| AI / OCR | Provider (Ollama/Gemini), model, confidence threshold, timeout |
| Keselamatan | Login lockout, session timeout, password policy, 2FA enforcement |
| Sistem | Maintenance mode, PDPA export, system stats |
| Ref No | Claim reference number prefix, padding, counter |

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
| PWA | next-pwa, service worker, offline page |
| Deployment | Coolify (self-hosted) |

---

## Roles

| Role | Description |
|------|-------------|
| `CLAIMANT` | Submit claims, upload receipts, view own history |
| `HEAD` | First approval — department head |
| `FINANCE` | Finance review — verify amounts |
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
```

Copy and fill environment variables:

```bash
cp .env.example .env
```

Run database migrations and seed:

```bash
npx prisma migrate deploy
npx prisma generate
npm run seed
```

Start dev server:

```bash
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
| `OLLAMA_REASONING_MODEL` | optional | Text model for eligibility reasoning |
| `GEMINI_API_KEY` | if Gemini | Google Gemini API key |
| `SMTP_HOST` | ✅ | SMTP server hostname |
| `SMTP_PORT` | ✅ | SMTP port |
| `SMTP_USER` | ✅ | SMTP username |
| `SMTP_PASS` | ✅ | SMTP password |
| `WA_ENABLED` | optional | `true` to enable WhatsApp via Evolution API |
| `EVOLUTION_BASE_URL` | if WA | Evolution API base URL |
| `EVOLUTION_API_KEY` | if WA | Evolution API key |
| `CRON_SECRET` | ✅ | Bearer token for cron endpoint protection |
| `TZ` | ✅ | Timezone (e.g. `Asia/Kuala_Lumpur`) |

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
2. Set build command: `npm run build`
3. Set start command: `npx prisma migrate deploy && npm start`
4. PostgreSQL service can be provisioned directly in Coolify
5. Attach a storage volume at `/app/storage` for uploaded receipts

Cron jobs (`/api/cron/reminders`, `/api/cron/wa-flush`) should be wired to an external cron or Coolify's scheduler, authenticated with `Authorization: Bearer <CRON_SECRET>`.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, forgot password, reset password
│   ├── (app)/           # Authenticated app shell
│   │   ├── dashboard/
│   │   ├── tuntutan/    # Claims list + detail
│   │   ├── resit/       # Receipt management
│   │   ├── semakan/     # Approval queue
│   │   ├── laporan/     # Reports
│   │   ├── notifikasi/
│   │   ├── profil/      # Profile + 2FA enrolment
│   │   └── admin/       # Admin panel (users, departments, settings)
│   └── api/             # OCR, file serve, cron, PDPA export
├── components/          # Shared UI components
├── lib/                 # Auth, DB, audit, TOTP, permissions, OCR
└── server/
    └── actions/         # Server actions (claims, receipts, admin, totp)
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
                         WITHDRAWN (claimant retracts before approval)
```

---

## License

Internal system — Majlis Daerah Setiu. Not for public distribution.
