"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { isAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";
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
}) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

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
      roles: { create: data.roles.map((r) => ({ role: r })) },
    },
  });

  // Create annual allocation for current year
  const year = new Date().getFullYear();
  const limitSetting = await prisma.settings.findUnique({ where: { key: "default_annual_limit" } });
  const limitMyr = Number(limitSetting?.value ?? 1200);
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
}) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const { roles, ...rest } = data;
  await prisma.user.update({ where: { id: userId }, data: rest });

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

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, loginFailCount: 0, lockedUntil: null } });
  await logAction({ actorId: session.user.id, actorName: session.user.name ?? undefined, action: AuditAction.USER_PASSWORD_RESET, entity: "User", entityId: userId });
  return { ok: true };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string) {
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

