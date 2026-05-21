import { Role } from "@/generated/prisma";

type SessionUser = {
  id: string;
  roles: Role[];
  isAhliMajlis: boolean;
  departmentId: string | null;
};

export function hasRole(user: SessionUser, ...roles: Role[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}

export function isAdmin(user: SessionUser) {
  return hasRole(user, Role.ADMIN);
}

export function isFinance(user: SessionUser) {
  return hasRole(user, Role.FINANCE);
}

export function isHead(user: SessionUser) {
  return hasRole(user, Role.HEAD);
}

export function isApprover(user: SessionUser) {
  return hasRole(user, Role.APPROVER);
}

export function isYdp(user: SessionUser) {
  return hasRole(user, Role.YDP);
}

export function canViewClaim(
  user: SessionUser,
  claim: { claimantId: string; departmentId: string | null }
): boolean {
  if (isAdmin(user) || isFinance(user) || isApprover(user) || isYdp(user)) return true;
  if (claim.claimantId === user.id) return true;
  if (isHead(user) && claim.departmentId === user.departmentId) return true;
  return false;
}

export function canApproveAsHead(
  user: SessionUser,
  claim: { claimantId: string; departmentId: string | null }
): boolean {
  if (!isHead(user)) return false;
  // Self-claim: skip step (handled at submission)
  if (claim.claimantId === user.id) return false;
  return claim.departmentId === user.departmentId;
}

export function shouldSkipHeadStep(
  claimant: { isAhliMajlis: boolean; roles: Role[] }
): boolean {
  return (
    claimant.isAhliMajlis ||
    claimant.roles.includes(Role.HEAD) ||
    claimant.roles.includes(Role.APPROVER) ||
    claimant.roles.includes(Role.YDP) ||
    claimant.roles.includes(Role.ADMIN)
  );
}

export function shouldSkipApproverStep(
  claimant: { roles: Role[] },
  hasYdp: boolean
): boolean {
  const isClaimantApprover = claimant.roles.includes(Role.APPROVER);
  if (!isClaimantApprover) return false;
  return !hasYdp; // if no YDP exists, skip; else route to YDP
}
