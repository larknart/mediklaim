import { prisma } from "@/lib/db";
import { headers } from "next/headers";

interface LogActionParams {
  actorId?: string;
  actorName?: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export async function logAction(params: LogActionParams): Promise<void> {
  let ip: string | undefined;
  let userAgent: string | undefined;

  try {
    const h = await headers();
    ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined;
    userAgent = h.get("user-agent") ?? undefined;
  } catch {
    // headers() may not be available in cron/worker context
  }

  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorName: params.actorName,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      meta: params.meta as object | undefined,
      ip,
      userAgent,
    },
  });
}

// ─── Action constants ─────────────────────────────────────────────────────────

export const AuditAction = {
  // Auth
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  // Receipts
  RECEIPT_UPLOADED: "RECEIPT_UPLOADED",
  RECEIPT_EXTRACTED: "RECEIPT_EXTRACTED",
  RECEIPT_EXTRACTION_FAILED: "RECEIPT_EXTRACTION_FAILED",
  RECEIPT_EDITED: "RECEIPT_EDITED",
  RECEIPT_DELETED: "RECEIPT_DELETED",
  RECEIPT_DUPLICATE_BLOCKED: "RECEIPT_DUPLICATE_BLOCKED",

  // Claims
  CLAIM_CREATED: "CLAIM_CREATED",
  CLAIM_SUBMITTED: "CLAIM_SUBMITTED",
  CLAIM_WITHDRAWN: "CLAIM_WITHDRAWN",
  CLAIM_RESUBMITTED: "CLAIM_RESUBMITTED",
  CLAIM_RESUBMIT_INITIATED: "CLAIM_RESUBMIT_INITIATED",
  HEAD_APPROVED: "HEAD_APPROVED",
  HEAD_REJECTED: "HEAD_REJECTED",
  HEAD_SKIPPED_SELF_CLAIM: "HEAD_SKIPPED_SELF_CLAIM",
  FINANCE_REVIEWED: "FINANCE_REVIEWED",
  CLAIM_APPROVED: "CLAIM_APPROVED",
  CLAIM_REJECTED: "CLAIM_REJECTED",
  CLAIM_OVERRIDDEN: "CLAIM_OVERRIDDEN",
  CLAIM_PAID: "CLAIM_PAID",

  // Allocation
  LIMIT_RESET: "LIMIT_RESET",
  LIMIT_UPDATED: "LIMIT_UPDATED",
  ALLOCATION_CREATED: "ALLOCATION_CREATED",

  // Admin
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  DEPT_CREATED: "DEPT_CREATED",
  DEPT_UPDATED: "DEPT_UPDATED",
  DEPT_DELETED: "DEPT_DELETED",
  DEPARTMENT_CREATED: "DEPARTMENT_CREATED",
  DEPARTMENT_UPDATED: "DEPARTMENT_UPDATED",
  BLACKLIST_ADDED: "BLACKLIST_ADDED",
  BLACKLIST_REMOVED: "BLACKLIST_REMOVED",
  BLACKLIST_UPDATED: "BLACKLIST_UPDATED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
} as const;
