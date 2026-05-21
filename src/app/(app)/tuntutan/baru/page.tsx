import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReceiptStatus } from "@/generated/prisma";
import { NewClaimForm } from "./_components/new-claim-form";
import { BackButton } from "@/components/back-button";

export default async function BuatTuntutanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentYear = new Date().getFullYear();

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
        <h1 className="text-2xl font-bold text-gray-900">Buat Tuntutan Baru</h1>
        <p className="text-gray-500 text-sm mt-1">Pilih resit dan hantar tuntutan</p>
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
      />
    </div>
  );
}
