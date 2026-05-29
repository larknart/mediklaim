"use server";

import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { isAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";
import { checkPasswordPolicy } from "@/lib/password-policy-server";
import bcrypt from "bcryptjs";

function requireAdmin(user: { id: string; roles: Role[]; isAhliMajlis: boolean; departmentId: string | null }) {
  if (!isAdmin(user)) throw new Error("UNAUTHORIZED");
}

// ─── Department ───────────────────────────────────────────────────────────────

export async function createDepartment(name: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  const dept = await prisma.department.create({ data: { name } });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.DEPT_CREATED, entity: "Department", entityId: dept.id, meta: { name } });
  return dept;
}

export async function updateDepartment(id: string, data: { name?: string; headId?: string | null }) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  await prisma.department.update({ where: { id }, data });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.DEPT_UPDATED, entity: "Department", entityId: id, meta: data });
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  const members = await prisma.user.count({ where: { departmentId: id } });
  if (members > 0) throw new Error("DEPT_HAS_MEMBERS");
  await prisma.department.delete({ where: { id } });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.DEPT_DELETED, entity: "Department", entityId: id });
  return { ok: true };
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function createUser(data: {
  email: string;
  name: string;
  staffNo?: string;
  phone?: string;
  password: string;
  departmentId?: string;
  roles: Role[];
  isAhliMajlis?: boolean;
  joinDate?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const policyError = await checkPasswordPolicy(data.password);
  if (policyError) throw new Error(policyError);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      staffNo: data.staffNo || undefined,
      phone: data.phone || undefined,
      departmentId: data.departmentId || undefined,
      isAhliMajlis: data.isAhliMajlis ?? false,
      joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
      roles: { create: data.roles.map((r) => ({ role: r })) },
    },
  });

  // Create annual allocation for current year with pro-rata if applicable
  const year = new Date().getFullYear();
  const [limitSetting, proRataSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "default_annual_limit" } }),
    prisma.settings.findUnique({ where: { key: "pro_rata_enabled" } }),
  ]);
  const defaultLimit = Number(limitSetting?.value ?? 1200);
  const proRataEnabled = proRataSetting?.value !== false;
  let limitMyr = defaultLimit;
  if (proRataEnabled && data.joinDate) {
    const jd = new Date(data.joinDate);
    if (jd.getFullYear() === year) {
      const monthsRemaining = 12 - jd.getMonth(); // getMonth() is 0-indexed; July=6 → 6 remaining
      limitMyr = Math.round((monthsRemaining / 12) * defaultLimit * 100) / 100;
    }
  }
  await prisma.annualAllocation.create({ data: { userId: user.id, year, limitMyr, usedMyr: 0 } });

  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.USER_CREATED, entity: "User", entityId: user.id, meta: { email: data.email, roles: data.roles } });
  return user;
}

export async function updateUser(userId: string, data: {
  name?: string;
  phone?: string;
  departmentId?: string | null;
  roles?: Role[];
  isAhliMajlis?: boolean;
  isActive?: boolean;
  joinDate?: string | null;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const { roles, joinDate, ...rest } = data;
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...rest,
      ...(joinDate !== undefined && { joinDate: joinDate ? new Date(joinDate) : null }),
    },
  });

  if (roles !== undefined) {
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.userRole.createMany({ data: roles.map((r) => ({ userId, role: r })) });
  }

  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.USER_UPDATED, entity: "User", entityId: userId, meta: rest });
  return { ok: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const policyError = await checkPasswordPolicy(newPassword);
  if (policyError) throw new Error(policyError);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, loginFailCount: 0, lockedUntil: null, passwordChangedAt: new Date() } });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.USER_PASSWORD_RESET, entity: "User", entityId: userId });
  return { ok: true };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  const row = await prisma.settings.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function updateSetting(key: string, value: string | number | boolean | null) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonValue = value as any;
  await prisma.settings.upsert({
    where: { key },
    create: { key, value: jsonValue },
    update: { value: jsonValue },
  });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.SETTINGS_UPDATED, entity: "Settings", entityId: key, meta: { value: String(value) } });
  return { ok: true };
}

export async function testSmtp() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  const { testEmailConnection } = await import("@/lib/notify/channels/email");
  return { ok: await testEmailConnection() };
}

export async function testWaConnection() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  const { checkEvolutionConnection } = await import("@/lib/notify/channels/whatsapp");
  return checkEvolutionConnection();
}

export async function testWaSend(toPhone: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);
  const clean = toPhone.replace(/\s/g, "");
  if (!/^60[0-9]{9,10}$/.test(clean)) throw new Error("Format nombor tidak sah. Guna format 60XXXXXXXXX.");
  const { sendWhatsAppDirect } = await import("@/lib/notify/channels/whatsapp");
  const result = await sendWhatsAppDirect(clean, "Test mesej dari MediKlaim MDS — abaikan jika diterima.");
  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "Settings",
    entityId: "wa_test_send",
    meta: { test: "wa_send", toPhone: clean },
  });
  return result;
}

// ─── Blacklist keywords ───────────────────────────────────────────────────────

export async function addBlacklistKeyword(keyword: string, reason?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const kw = await prisma.blacklistKeyword.create({
    data: { keyword: keyword.toLowerCase().trim(), reason, addedById: session.user.id },
  });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.BLACKLIST_UPDATED, entity: "BlacklistKeyword", entityId: kw.id, meta: { keyword, reason } });
  return kw;
}

export async function deleteBlacklistKeyword(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  await prisma.blacklistKeyword.delete({ where: { id } });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.BLACKLIST_UPDATED, entity: "BlacklistKeyword", entityId: id, meta: { deleted: true } });
  return { ok: true };
}

// ─── Public Holidays ─────────────────────────────────────────────────────────

export async function addPublicHoliday(date: string, name: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error("INVALID_DATE");
  const year = d.getFullYear();

  const holiday = await prisma.publicHoliday.upsert({
    where: { date: d },
    create: { date: d, name: name.trim(), year },
    update: { name: name.trim() },
  });

  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.HOLIDAY_ADDED, entity: "PublicHoliday", entityId: holiday.id, meta: { date, name } });
  return { id: holiday.id };
}

export async function deletePublicHoliday(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  await prisma.publicHoliday.delete({ where: { id } });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.HOLIDAY_DELETED, entity: "PublicHoliday", entityId: id });
  return { ok: true };
}

// ─── Approval Delegation ──────────────────────────────────────────────────────

export async function createDelegation(data: {
  delegatorId: string;
  delegateId: string;
  role: Role;
  fromDate: string;
  toDate: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  if (data.delegatorId === data.delegateId) throw new Error("SAME_USER");
  const from = new Date(data.fromDate);
  const to = new Date(data.toDate);
  if (to < from) throw new Error("INVALID_DATE_RANGE");

  const delegation = await prisma.approvalDelegation.create({
    data: {
      delegatorId: data.delegatorId,
      delegateId: data.delegateId,
      role: data.role,
      fromDate: from,
      toDate: to,
    },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.DELEGATION_CREATED,
    entity: "ApprovalDelegation",
    entityId: delegation.id,
    meta: data,
  });

  return { id: delegation.id };
}

export async function deleteDelegation(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  await prisma.approvalDelegation.delete({ where: { id } });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.DELEGATION_DELETED,
    entity: "ApprovalDelegation",
    entityId: id,
  });

  return { ok: true };
}

// ─── System Stats ─────────────────────────────────────────────────────────────

async function storageSizeBytes(dir: string): Promise<number> {
  try {
    await fs.promises.access(dir);
  } catch {
    return 0;
  }
  let total = 0;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += await storageSizeBytes(full);
      } else {
        const stat = await fs.promises.stat(full);
        total += stat.size;
      }
    } catch { /* skip inaccessible */ }
  }
  return total;
}

export async function getSystemStats() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const [dbResult, claimCount, userCount, receiptCount] = await Promise.all([
    prisma.$queryRaw<{ size: string }[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size
    `,
    prisma.claim.count(),
    prisma.user.count(),
    prisma.receipt.count(),
  ]);

  const storageDir = path.join(process.cwd(), "storage");
  const storageBytes = await storageSizeBytes(storageDir);
  const storageMb = (storageBytes / 1024 / 1024).toFixed(1);

  return {
    dbSize: dbResult[0]?.size ?? "N/A",
    storageMb,
    claimCount,
    userCount,
    receiptCount,
    version: "0.1.0",
  };
}

