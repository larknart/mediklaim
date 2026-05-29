<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# MediKlaim MDS — Agent Rules

Project-specific rules that override defaults. These are hard-won — violating them causes build failures or silent bugs.

## Prisma

- **Always run `npx prisma generate` after any schema change**, before `tsc --noEmit`. The generated client is gitignored; agents start with a stale copy.
- **Prisma 7 requires `PrismaPg` adapter** in `src/lib/db.ts` and `seed.ts`. Do not instantiate `new PrismaClient()` bare.
- **Decimal fields** — `$queryRaw` returns Decimal/BigInt as strings. Always `Number(r.field)` before passing to Client Components.
- **`Prisma.sql` / `Prisma.empty` fragment composition is broken** with `@prisma/adapter-pg`. Use branched `if/else` queries instead of composing SQL fragments.
- **Migrations** — `prisma migrate dev` for schema changes. Do not write migration SQL manually unless you need a backfill. After running, commit both `schema.prisma` and the generated `migrations/` files.

## Next.js 16 specifics

- **Middleware is named `src/proxy.ts`**, not `middleware.ts`. It exports `proxy` (not `middleware`). `middleware.ts` is deprecated and causes build warnings in Next.js 16.
- **`headers()` is async** — always `await headers()`. Safe to include in `Promise.all`.
- **`searchParams` in page components is async** — always `await searchParams`.
- **Server Components cannot receive event handler props** — any component with `onClick` etc. needs `"use client"`.

## "use server" files

- **No re-exports** — `export { fn } from "..."` in a `"use server"` file breaks Turbopack. Only `export async function` declarations.
- **Dynamic imports for heavy libs** — use `await import("@/lib/notify/channels/email")` inside server actions to avoid pulling Node-only modules into the wrong bundle.

## Password policy module split

- `src/lib/password-policy.ts` — **pure functions only**, no DB imports. Safe for client bundles.
- `src/lib/password-policy-server.ts` — has DB import. **Server-side only** (server actions, page server components).
- Never import `password-policy-server.ts` from a Client Component — it pulls `pg`/`dns`/`net` into the browser bundle.

## shadcn Select gotcha

`SelectValue` renders the `value` prop (the ID), not the label. Fix: replace `<SelectValue />` with `<span>{lookup}</span>` inside `SelectTrigger`.

## Security invariants — do not break

- **`getSetting` requires admin** — it's a server action and gated with `requireAdmin`. Do not remove this gate.
- **Rate limiting** — `src/lib/rate-limit.ts` is wired to `/api/search` and `/api/export/**`. Keep it.
- **Cron auth** — all cron routes must check `Authorization: Bearer` header (or `?token=` fallback) against `CRON_SECRET`.
- **loginFailCount reset** — reset only AFTER all factors (password + TOTP) succeed. Never reset before TOTP verification.
- **`passwordChangedAt`** — set this field on every password change path (`profile.ts`, `password-reset.ts`, `admin.ts` resetUserPassword). Missing it breaks password expiry enforcement.

## Audit log

Every sensitive mutation must call `logAction()` from `src/lib/audit.ts`. Check `AuditAction` constants before adding new ones — many categories already exist.

## File storage

`storage/` is gitignored. Uploaded receipts live there. Never commit it.
