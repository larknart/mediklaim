import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReceiptInbox } from "./_components/receipt-inbox";
import { ExtractionStatus, ReceiptStatus } from "@/generated/prisma";

export default async function ResitPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const receipts = await prisma.receipt.findMany({
    where: {
      ownerId: session.user.id,
      status: ReceiptStatus.UNSORTED,
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const serialized = receipts.map((r) => ({
    ...r,
    totalMyr: r.totalMyr ? Number(r.totalMyr) : null,
    items: r.items.map((i) => ({
      ...i,
      unitMyr: Number(i.unitMyr),
      amountMyr: Number(i.amountMyr),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resit Saya</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload dan simpan resit di sini sebelum buat tuntutan.
        </p>
      </div>
      <ReceiptInbox receipts={serialized} />
    </div>
  );
}
