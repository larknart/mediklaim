import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [users, claims, receipts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, email: true, name: true, staffNo: true, phone: true,
        isAhliMajlis: true, isActive: true, joinDate: true, createdAt: true,
        roles: { select: { role: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.claim.findMany({
      select: {
        id: true, refNo: true, claimantId: true, forMonth: true, forYear: true,
        status: true, totalClaimedMyr: true, totalEligibleMyr: true,
        totalApprovedMyr: true, submittedAt: true, paidAt: true, createdAt: true,
      },
    }),
    prisma.receipt.findMany({
      select: {
        id: true, ownerId: true, receiptDate: true, vendor: true,
        totalMyr: true, status: true, claimFor: true, createdAt: true,
        items: {
          select: { description: true, qty: true, unitMyr: true, amountMyr: true, isEligible: true },
        },
      },
    }),
  ]);

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? undefined,
    action: "PDPA_EXPORT",
    entity: "System",
    entityId: "pdpa-export",
    meta: { exportedAt: new Date().toISOString(), userCount: users.length, claimCount: claims.length },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    users,
    claims,
    receipts,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mediklaim-pdpa-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
