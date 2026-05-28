"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { canViewClaim } from "@/lib/permissions";

export async function addComment(claimId: string, body: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("EMPTY_BODY");
  if (trimmed.length > 2000) throw new Error("TOO_LONG");

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { claimantId: true, departmentId: true },
  });
  if (!claim) throw new Error("NOT_FOUND");
  if (!canViewClaim(session.user, claim)) throw new Error("UNAUTHORIZED");

  const comment = await prisma.claimComment.create({
    data: { claimId, authorId: session.user.id, body: trimmed },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.CLAIM_COMMENT_ADDED,
    entity: "Claim",
    entityId: claimId,
    meta: { commentId: comment.id },
  });

  return { id: comment.id };
}

export async function deleteComment(commentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const comment = await prisma.claimComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });
  if (!comment) throw new Error("NOT_FOUND");
  if (comment.authorId !== session.user.id) throw new Error("UNAUTHORIZED");

  await prisma.claimComment.delete({ where: { id: commentId } });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.CLAIM_COMMENT_DELETED,
    entity: "ClaimComment",
    entityId: commentId,
  });

  return { ok: true };
}
