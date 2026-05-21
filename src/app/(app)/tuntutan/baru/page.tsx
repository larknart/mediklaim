import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReceiptStatus } from "@/generated/prisma";
import { NewClaimForm } from "./_components/new-claim-form";

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buat Tuntutan Baru</h1>
        <p className="text-gray-500 text-sm mt-1">Pilih resit dan hantar tuntutan</p>
      </div>
      <NewClaimForm
        receipts={unsortedReceipts as Parameters<typeof NewClaimForm>[0]["receipts"]}
        remaining={remaining}
        limit={limit}
      />
    </div>
  );
}
