import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReceiptStatus, Decision } from "@/generated/prisma";
import { NewClaimForm } from "./_components/new-claim-form";
import { BackButton } from "@/components/back-button";

type ResubmitContext = {
  claimId: string;
  refNo: string;
  rejectionComment: string | null;
  originalReceiptIds: string[];
};

export default async function BuatTuntutanPage({
  searchParams,
}: {
  searchParams: Promise<{ resubmitFrom?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();

  let resubmitContext: ResubmitContext | null = null;

  if (sp.resubmitFrom) {
    const original = await prisma.claim.findUnique({
      where: { id: sp.resubmitFrom, claimantId: session.user.id },
      include: {
        receipts: { select: { id: true } },
        approvals: {
          where: { decision: Decision.REJECTED },
          orderBy: { decidedAt: "desc" },
          take: 1,
        },
      },
    });
    if (original) {
      resubmitContext = {
        claimId: original.id,
        refNo: original.refNo,
        rejectionComment: original.approvals[0]?.comment ?? null,
        originalReceiptIds: original.receipts.map((r) => r.id),
      };
    }
  }

  const [unsortedReceipts, allocation] = await Promise.all([
    prisma.receipt.findMany({
      where: { ownerId: session.user.id, status: ReceiptStatus.UNSORTED },
      include: { items: true },
      orderBy: { receiptDate: "desc" },
    }),
    prisma.annualAllocation.findUnique({
      where: { userId_year: { userId: session.user.id, year: currentYear } },
    }),
  ]);

  const limit = Number(allocation?.limitMyr ?? 1200);
  const used = Number(allocation?.usedMyr ?? 0);
  const remaining = limit - used;

  return (
    <div className="space-y-6 max-w-2xl">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {resubmitContext ? "Hantar Semula Tuntutan" : "Buat Tuntutan Baru"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {resubmitContext
            ? `Resubmit dari ${resubmitContext.refNo}`
            : "Pilih resit dan hantar tuntutan"}
        </p>
      </div>
      <NewClaimForm
        receipts={unsortedReceipts.map((r) => ({
          ...r,
          totalMyr: r.totalMyr ? Number(r.totalMyr) : null,
          items: r.items.map((i) => ({
            ...i,
            unitMyr: Number(i.unitMyr),
            amountMyr: Number(i.amountMyr),
          })),
        }))}
        remaining={remaining}
        limit={limit}
        resubmitContext={resubmitContext}
      />
    </div>
  );
}
