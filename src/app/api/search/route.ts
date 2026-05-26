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

// ─── Stub functions (replaced in Tasks 3 & 4) ────────────────────────────────

async function searchClaims(
  _q: string, _userId: string, _deptId: string | null,
  _isHead: boolean, _isSupervisor: boolean
): Promise<SearchResult[]> { return []; }

async function searchReceipts(
  _q: string, _userId: string, _deptId: string | null,
  _isHead: boolean, _isSupervisor: boolean
): Promise<SearchResult[]> { return []; }

async function searchUsers(_q: string): Promise<SearchResult[]> { return []; }

async function searchAudit(_q: string): Promise<SearchResult[]> { return []; }
