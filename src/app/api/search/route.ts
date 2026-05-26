import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma";

// ─── Shared types (imported by GlobalSearch component) ────────────────────────

export type SearchResult = {
  id: string;
  type: "claim" | "receipt" | "user" | "audit";
  label: string;     // Primary line: "TUN-2026-0042"
  sublabel: string;  // Secondary line: "Ahmad Razali · RM 340.00"
  status?: string;   // Badge: "APPROVED", "SUBMITTED", etc.
  link: string;      // Navigation: "/tuntutan/<id>"
};

export type SearchResponse = {
  claims: SearchResult[];
  receipts: SearchResult[];
  users: SearchResult[];   // empty for non-ADMIN
  audit: SearchResult[];   // empty for non-ADMIN
};

const EMPTY: SearchResponse = Object.freeze({ claims: [], receipts: [], users: [], audit: [] }) as SearchResponse;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 3) {
    return NextResponse.json(EMPTY);
  }

  const trimmed = q.trim();
  const { id: userId, roles, departmentId: deptId } = session.user;

  const isAdmin     = roles.includes(Role.ADMIN);
  const isHead      = roles.includes(Role.HEAD);
  // isSupervisor: broad claims/receipts access — FINANCE, APPROVER, YDP, ADMIN
  const isSupervisor =
    isAdmin ||
    roles.includes(Role.FINANCE) ||
    roles.includes(Role.APPROVER) ||
    roles.includes(Role.YDP);

  const [claims, receipts, users, audit] = await Promise.all([
    searchClaims(trimmed, userId, deptId, isHead, isSupervisor),
    searchReceipts(trimmed, userId, deptId, isHead, isSupervisor),
    isAdmin ? searchUsers(trimmed)  : Promise.resolve([]),
    isAdmin ? searchAudit(trimmed)  : Promise.resolve([]),
  ]);

  return NextResponse.json({ claims, receipts, users, audit } satisfies SearchResponse);
}

// ─── Claim + Receipt FTS ──────────────────────────────────────────────────────

// Raw row type — $queryRaw returns Decimal as string, cast::text in SQL
type RawClaim = {
  id: string;
  refNo: string;
  status: string;
  totalClaimedMyr: string;  // Decimal → string via ::text cast
  forMonth: number;
  forYear: number;
  claimantName: string;
};

async function searchClaims(
  q: string,
  userId: string,
  deptId: string | null,
  isHead: boolean,
  isSupervisor: boolean
): Promise<SearchResult[]> {
  let rows: RawClaim[];

  if (isSupervisor) {
    // FINANCE / APPROVER / YDP / ADMIN — no scope filter
    rows = await prisma.$queryRaw<RawClaim[]>`
      SELECT c.id, c."refNo", c.status::text, c."totalClaimedMyr"::text,
             c."forMonth", c."forYear", u.name AS "claimantName"
      FROM "Claim" c
      JOIN "User" u ON u.id = c."claimantId"
      WHERE (
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
          @@ plainto_tsquery('simple', ${q})
        OR u.name ILIKE ${'%' + q + '%'}
      )
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
        plainto_tsquery('simple', ${q})
      ) DESC NULLS LAST
      LIMIT 5
    `;
  } else if (isHead && deptId) {
    // HEAD with a department — own claims + jabatan claims
    rows = await prisma.$queryRaw<RawClaim[]>`
      SELECT c.id, c."refNo", c.status::text, c."totalClaimedMyr"::text,
             c."forMonth", c."forYear", u.name AS "claimantName"
      FROM "Claim" c
      JOIN "User" u ON u.id = c."claimantId"
      WHERE (
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
          @@ plainto_tsquery('simple', ${q})
        OR u.name ILIKE ${'%' + q + '%'}
      )
      AND (c."claimantId" = ${userId} OR c."departmentId" = ${deptId})
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
        plainto_tsquery('simple', ${q})
      ) DESC NULLS LAST
      LIMIT 5
    `;
  } else {
    // CLAIMANT or HEAD without departmentId — own claims only
    rows = await prisma.$queryRaw<RawClaim[]>`
      SELECT c.id, c."refNo", c.status::text, c."totalClaimedMyr"::text,
             c."forMonth", c."forYear", u.name AS "claimantName"
      FROM "Claim" c
      JOIN "User" u ON u.id = c."claimantId"
      WHERE (
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
          @@ plainto_tsquery('simple', ${q})
        OR u.name ILIKE ${'%' + q + '%'}
      )
      AND c."claimantId" = ${userId}
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
        plainto_tsquery('simple', ${q})
      ) DESC NULLS LAST
      LIMIT 5
    `;
  }

  return rows.map((r) => ({
    id: r.id,
    type: "claim" as const,
    label: r.refNo,
    sublabel: `${r.claimantName} · RM ${Number(r.totalClaimedMyr).toFixed(2)}`,
    status: r.status,
    link: `/tuntutan/${r.id}`,
  }));
}

type RawReceipt = {
  id: string;
  vendor: string | null;
  status: string;
  totalMyr: string | null;  // Decimal → string via ::text cast
  ownerName: string;
};

async function searchReceipts(
  q: string,
  userId: string,
  deptId: string | null,
  isHead: boolean,
  isSupervisor: boolean
): Promise<SearchResult[]> {
  let rows: RawReceipt[];

  if (isSupervisor) {
    rows = await prisma.$queryRaw<RawReceipt[]>`
      SELECT r.id, r.vendor, r.status::text, r."totalMyr"::text, u.name AS "ownerName"
      FROM "Receipt" r
      JOIN "User" u ON u.id = r."ownerId"
      WHERE to_tsvector('simple', coalesce(r.vendor,''))
        @@ plainto_tsquery('simple', ${q})
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `;
  } else if (isHead && deptId) {
    // HEAD — own receipts + receipts attached to jabatan claims
    rows = await prisma.$queryRaw<RawReceipt[]>`
      SELECT r.id, r.vendor, r.status::text, r."totalMyr"::text, u.name AS "ownerName"
      FROM "Receipt" r
      JOIN "User" u ON u.id = r."ownerId"
      LEFT JOIN "Claim" c ON c.id = r."claimId"
      WHERE to_tsvector('simple', coalesce(r.vendor,''))
        @@ plainto_tsquery('simple', ${q})
      AND (r."ownerId" = ${userId} OR c."departmentId" = ${deptId})
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `;
  } else {
    rows = await prisma.$queryRaw<RawReceipt[]>`
      SELECT r.id, r.vendor, r.status::text, r."totalMyr"::text, u.name AS "ownerName"
      FROM "Receipt" r
      JOIN "User" u ON u.id = r."ownerId"
      WHERE to_tsvector('simple', coalesce(r.vendor,''))
        @@ plainto_tsquery('simple', ${q})
      AND r."ownerId" = ${userId}
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `;
  }

  return rows.map((r) => ({
    id: r.id,
    type: "receipt" as const,
    label: r.vendor ?? "(Tiada nama)",
    sublabel: `${r.ownerName} · RM ${r.totalMyr ? Number(r.totalMyr).toFixed(2) : "?"}`,
    status: r.status,
    link: `/resit/${r.id}`,
  }));
}

async function searchUsers(_q: string): Promise<SearchResult[]> { return []; }

async function searchAudit(_q: string): Promise<SearchResult[]> { return []; }
