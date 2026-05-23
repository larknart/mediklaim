import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma";

export interface ActiveDelegation {
  id: string;
  delegatorId: string;
  delegatorDeptId: string | null;
}

export async function getActiveDelegation(
  userId: string,
  role: Role,
  departmentId?: string | null
): Promise<ActiveDelegation | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delegation = await prisma.approvalDelegation.findFirst({
    where: {
      delegateId: userId,
      role,
      fromDate: { lte: today },
      toDate: { gte: today },
    },
    include: { delegator: { select: { departmentId: true } } },
  });

  if (!delegation) return null;

  // HEAD delegation is department-scoped
  if (role === Role.HEAD && departmentId !== undefined) {
    if (delegation.delegator.departmentId !== departmentId) return null;
  }

  return {
    id: delegation.id,
    delegatorId: delegation.delegatorId,
    delegatorDeptId: delegation.delegator.departmentId,
  };
}
